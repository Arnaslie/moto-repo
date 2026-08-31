import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// The header lives here so it survives navigation. See ADR 0005.
//
// It must stay a layout, not a template: templates are keyed per route and
// reset their children on every navigation, which is the bug this fixed.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Deduped with the pages' own call by React's cache() in lib/session, so the
  // header costs no extra query.
  const user = await getCurrentUser();
  const headerUser = user
    ? { handle: user.handle, displayName: user.displayName }
    : null;

  // The wheel's opening counts, rendered into the HTML so a hard load doesn't
  // arrive with it dark and light it a moment later. ADR 0001 turned this down
  // as a prop through seven call sites and seven queries; there is one of each
  // now, which is what having a layout bought.
  //
  // Same two halves /api/unread returns — conversations waiting, and unread
  // activity rows — batched into one round trip. Both are counts against an
  // indexed column rather than the route's findMany, because the layout only
  // needs the numbers, not the per-conversation breakdown.
  const [conversations, activity] = user
    ? await prisma.$transaction([
        prisma.participant.count({
          where: { userId: user.id, unreadCount: { gt: 0 } },
        }),
        prisma.notification.count({
          where: { recipientId: user.id, readAt: null },
        }),
      ])
    : [0, 0];

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl border-x border-black/10 dark:border-white/10">
      <SiteHeader user={headerUser} initialWaiting={{ conversations, activity }} />
      {children}
    </main>
  );
}
