import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * The shell every signed-in-or-not page of the app renders into.
 *
 * It exists to be the thing that *doesn't* remount. Every page used to mount
 * its own SiteHeader, so walking the drivetrain from one page to the next tore
 * the header down and built a new one — and three separate bugs came out of
 * that one fact: the unread wheel blinking dark, the chain never shifting, and
 * the panel snapping shut mid-animation. A layout is reused across the
 * navigations below it, so the header now survives the trip and the state
 * inside it survives with it.
 *
 * It must be a layout, not a template: templates are keyed per route and reset
 * their children on every navigation, which is precisely the bug.
 *
 * Login and signup sit outside this group. They're the two pages with no
 * chrome — a header offering "Log in" above the log-in form, with a gearbox
 * whose gears all want an account, is furniture in the way of the one thing
 * the page is for.
 */
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

  // The wheel's opening count, rendered into the HTML so a hard load doesn't
  // arrive with it dark and light it a moment later. ADR 0001 turned this down
  // as a prop through seven call sites and seven queries; there is one of each
  // now, which is what having a layout bought. The count matches what
  // /api/messages/unread returns — conversations waiting, not messages — and is
  // a count against an indexed column rather than that route's findMany.
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
