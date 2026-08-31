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

  // Must match what /api/messages/unread counts — conversations waiting, not
  // messages — or the wheel changes value on its first poll.
  const initialUnread = user
    ? await prisma.participant.count({
        where: { userId: user.id, unreadCount: { gt: 0 } },
      })
    : 0;

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl border-x border-black/10 dark:border-white/10">
      <SiteHeader user={headerUser} initialUnread={initialUnread} />
      {children}
    </main>
  );
}
