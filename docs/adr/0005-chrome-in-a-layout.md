# ADR 0005 — The chrome moves into a layout

- **Status:** Implemented
- **Date:** 2026-08-26
- **Supersedes / superseded by:** revises the "no prop threading" reasoning in
  [0001](./0001-app-wide-notifications.md); does not change what 0001 decided
  to build
- **Touches:** `src/app/(app)/layout.tsx`, all eight app pages,
  `src/components/SiteHeader.tsx`, `src/components/Drivetrain.tsx`,
  `src/components/messages/MessagesLink.tsx`, `src/lib/session.ts`

---

## Context

`src/app/layout.tsx` carried no chrome. Every page in the app mounted its own
`<SiteHeader>` inside its own copy of the standard shell, so a client-side
navigation tore the header down and built a new one on the far side.

That one fact produced three separate bugs, each fixed separately:

- **The unread wheel blinked dark at every stop.** The fresh `MessagesLink`
  started at `useState(0)` with nothing waiting, so the wheel went out until the
  fetch landed. Fixed by keeping the last count at module scope and seeding the
  next mount from it — module scope being the only thing that outlives a
  remount.
- **The drivetrain's chain never shifted.** A gear click navigated immediately,
  unmounting the component the animation was running in. Fixed by running the
  shift first and navigating when it finished.
- **The panel snapped shut mid-animation**, for the same reason from the other
  end.

Each fix is sound on its own terms and each one is working around the same
thing. The remount was never wanted; it was inherited from where the header
happened to be mounted.

0001 chose that arrangement deliberately, and its reasoning was about cost:
threading an unread count through seven call sites and seven server queries, to
avoid which the tell-tale fetches its own. That reasoning was correct about
prop threading and silent about remounting, which is what actually bit.

## Decision

Put the chrome in a layout, and put the pages that wear it in a route group.

```
src/app/(app)/layout.tsx      <main> shell + <SiteHeader>, {children} below it
src/app/(app)/…               the eight pages, now rendering only themselves
src/app/login, /signup        outside the group, no chrome, unchanged
```

A layout is reused across the navigations below it rather than remounted, so the
header — and everything holding state inside it — survives the trip. URLs are
unchanged: a parenthesised folder is organisational and contributes no path
segment.

**A layout, never a `template.tsx`.** Templates are keyed per route and reset
their children on every navigation. That is precisely the bug, dressed as the
fix, and it is one file name away.

**Login and signup stay outside.** They are the two pages with no chrome. A
header offering "Log in" above the log-in form, over a gearbox whose gears all
want an account, is furniture in the way of the one thing the page is for.
Keeping them out of the group is also what keeps the shell honest: it is the
signed-in-or-browsing shell, not a global one.

**`getCurrentUser` is wrapped in React's `cache()`.** The layout asks for the
header's rider and the page below it usually asks again for its own reasons.
Without deduping that is two identical session decrypts and two identical
queries on every render of every page.

**Logout navigates first and refreshes second.** This is the one thing the move
breaks if you don't watch for it, and it is worth stating rather than leaving in
the code as an ordering that looks arbitrary. A layout is cached on the client —
that is what stops it blinking, and it is also what will show a signed-out rider
their own handle and unread count. `router.refresh()` issued *before*
`router.push()` is cancelled by the push and the stale tree comes back out of
the cache. Issued after, it invalidates the tree you landed on. Measured both
ways: six logouts from four different pages, stale six times out of six with the
old order, clean six times out of six with the new one. The login path in
`AuthForm` was measured on the same rig and is unaffected either way, so it is
left as it was.

**The opening count is rendered by the layout.** 0001 turned this down
explicitly — "rather than thread an `initialUnreadCount` prop through all seven
… zero refactor" — and the count of call sites was the whole of that argument.
There is one now. The layout counts the rider's waiting conversations and hands
the number down through `SiteHeader`, so the wheel is already lit in the HTML
instead of arriving dark and lighting a fifth of a second later. That blink is
the one case module scope cannot cover: on a hard load there is no module to
have cached anything yet.

It is `participant.count()` against an indexed column — cheaper than the
`findMany` the polling route runs every twenty seconds in every open tab —
and it matches that route's definition of unread: conversations waiting, not
messages.

Where the two disagree, **the tab's own last answer wins**. Both are current on
a hard load, where there is no cached count at all, but the layout is cached on
the client, so a header rebuilt from that cache can carry a number from whenever
the cache was filled. What this tab last saw cannot be older than that.

### What this does not change

0001's decision that the tell-tale **owns its count after first paint** stands.
It still polls, it is still the component that decides what the wheel shows, and
it still needs no prop to keep working — `initialUnread` seeds it and the first
fetch corrects it. Only the opening frame changed hands.

The module-scope cache in `MessagesLink` stays. In-app navigation no longer
remounts anything, but login and signup sit outside the group, so signing in and
landing on the feed does build a fresh header, and that is a common enough trip
to be worth not blinking through.

The drivetrain's shift-then-navigate order also stays. The teardown it was
avoiding no longer happens, but running the shift where you can watch it finish
is the behaviour that was wanted; it just no longer depends on the remount to
enforce it. The panel is now closed explicitly on the way out, which is what a
layout that persists requires.

## Consequences

**Accepted:**

- The header is mounted once and stays mounted. The whole class of bug — state
  in the chrome not surviving a route change — is gone rather than worked
  around three times.
- Eight pages lose their copy of the shell and their `SiteHeader` import. Two of
  them (`riders`, `showroom`) no longer need a session lookup at all.
- One session query per request instead of two.
- Anything added to the header from here — the notification panel from 0001,
  a live stream connection, an audio element for Comms — gets continuity for
  free, which is the thing that would have been hardest to add later.

**Costs and risks:**

- **A cached layout can go stale.** Logout is the case that exists today and it
  is handled; anything else that changes who the viewer is must invalidate the
  layout, not just the page. The failure is quiet — a correct-looking header
  describing the wrong rider — so it is worth a deliberate check whenever a new
  session boundary appears.
- **A layout cannot read the pathname or search params**, by design, because it
  does not re-render. Everything in the header that needs the current route
  already reads it client-side (`Drivetrain` uses `usePathname`), and anything
  added to the shell must do the same.
- **Two pages with no chrome are now defined by their position** in the tree
  rather than by what they render. Moving `login/` into the group would silently
  give it a header. The layout's own comment says so.

---

## Verification

Driven over CDP against a real browser and the local Postgres, signed in as a
seeded rider with mail waiting, sampling the rendered stripe every animation
frame across three client-side navigations — `/messages → /riders → /comms → /`,
clicking the drivetrain's gears with real mouse events.

The measurement that matters is not the stripe but **how many wheel DOM nodes
the trip produces**, stamped on first sight and counted at the end:

| | wheel DOM nodes | dark frames |
| --- | --- | --- |
| Before (HEAD, chrome in the pages) | **4** — a fresh one at every stop | 0 |
| After (chrome in the layout) | **1** | 0 |

Zero dark frames on both sides, because the module-scope cache was already
hiding the blink. That is the point: it was hiding a remount that is now simply
not happening.

Hard loads were measured the same way, with the sampler installed before the
document runs so the first painted frame is in the record — five loads across
four pages:

| | dark frames over 5 hard loads | first frame lit |
| --- | --- | --- |
| Without the layout's count | **59** (10–14 each, ~200ms of dark wheel) | no |
| With it | **0** | yes |

Also verified: logout from `/`, `/messages`, `/riders` and `/comms` (six runs,
no stale header); signing in from a feed that was already sitting in the client
cache signed out; `/login` and `/signup` render no header at all; and the served
HTML for three viewers — a rider with one conversation waiting (wheel lit,
count 1), a rider with none (wheel present, unlit, no count), and a signed-out
visitor (no wheel at all). `tsc --noEmit`, `eslint` and `next build` clean, with
every route resolving to the same URL it had before.
