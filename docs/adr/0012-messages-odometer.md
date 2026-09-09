# ADR 0012 — The odometer: giving messages their own instrument

- **Status:** Proposed.
- **Date:** 2026-09-09
- **Supersedes / superseded by:** revises [0007](./0007-notifications-polled.md)'s
  header cluster, which folded direct messages into the wheel; restores the
  entry point [0003](./0003-direct-messages-polled.md) shipped
- **Touches (planned):** `apps/web/src/components/RiderTelltale.tsx`,
  `apps/web/src/components/SiteHeader.tsx`,
  `apps/web/src/components/NotificationPanel.tsx`,
  `apps/web/src/components/OdometerLink.tsx` (new),
  `apps/web/src/components/icons.tsx`,
  `packages/core/src/odometer.ts` (new),
  `apps/web/src/app/globals.css` (`--odo-*`)

---

## Context

Direct messages are built and have been since 0003 — an inbox at `/messages`
with avatars, previews and per-thread counts, a thread at `/messages/[id]`
polling every three seconds, an optimistic composer, and a Message button on
every other rider's profile. None of that is in question here.

**What's missing is the way in.** 0003 put a `MessagesLink` in the header: a
link with a count on it, deliberately sited in "the header cluster where the
tell-tale will go". 0007 then built the tell-tale and put it exactly there — by
converting that component. `RiderTelltale.tsx` says so in its own header
comment:

> Was MessagesLink, which counted unread DMs and linked to /messages. It counts
> everything waiting now, and opens a panel instead of navigating.

So the only route to your own inbox is now: click the wheel, open the
notification panel, read past the waves and comments, and find **"All messages"**
in the panel's footer. Four interactions to reach a page the app already has,
behind an instrument that is about something else. Someone using the app
reasonably concludes DMs aren't in it.

Two smaller things went with it:

**The badge sums two unlike things.** `waitingTotal` adds unread conversations
to unread activity rows and shows one number. 0007 is careful that the two
halves are *counted* differently — conversations for DMs, because forty
messages from one rider is one thing waiting for you; rows for activity, because
a wave and a comment are genuinely two things — and then adds them anyway. A
badge reading `5` could be five conversations, five waves, or any mix, and there
is no way to tell which without opening it.

**The data was never the problem.** `/api/unread` already returns `unread` and
`activity` as separate fields, and `(app)/layout.tsx` already computes both
server-side in one `$transaction` and passes them to the header as
`initialWaiting`. Everything a second instrument needs is already on the wire
and already in the HTML. This record proposes no schema, no route, and no query.

## Decision

A second instrument in the header cluster, beside the wheel: **a digital
odometer reading unread conversations, which navigates straight to
`/messages`.** The wheel drops back to activity alone.

### It reads conversations, not messages

The odometer inherits 0007's distinction rather than reopening it. The digits
count *conversations with something waiting in them*, which is the `unread`
field, not a message total. Forty messages from one rider still reads `001`,
because it is one thing to go and deal with.

### Digital means the segments switch, not roll

Two real odometers, and they behave differently:

A **mechanical drum** odometer rolls. Digits are printed on barrels geared to
each other, so a change puts digits in transit — you catch them mid-roll, half
of one and half of the next, and a nine cascading into a zero drags the drum to
its left round with it.

An **LCD** doesn't roll. It has fixed segments that switch on and off, so a
change is instantaneous and there is no in-between state to draw.

The instrument here is digital, so **there is no rolling animation.** A rolling
LCD is a mechanism that does not exist, and this repo has a standing preference
for the real constraint over the appealing approximation — 0004 measured the
wheel off a reference rather than drawing a wheel-ish thing, 0008 built the
anatomy from published MT-07 geometry, and 0011 took a polyline over a
rectangle for the same reason. The MT-07 is already this app's reference
machine and its dash odometer is an LCD, so the digital reading is also the
consistent one.

The drum is the better-looking option and it loses on those grounds. Worth
recording that it was close: `ada`, one of the two seeded riders, wrenches on a
CB550, which would have had exactly that drum.

### "Filling up" is the ghost segments, and that part is real

On a real LCD every segment is physically present whether it is driven or not.
The unlit ones don't vanish; they sit there faintly, which is why a car dash at
night shows the shadow of an `88:88` behind the time.

That is the fill. The readout is **never blank**: at rest it is `000` lit over a
ghosted `888`, and as conversations pile up more segments switch on and the
glyph gets denser. Nothing needs to be invented to make the instrument respond
to the count — the count already lights it.

```
   nothing waiting        three waiting         twelve waiting

    ▛▘▛▘▛▘  ← ghost         ▛▘▛▘▗▖               ▛▘▗▖▗▖
    ▙▖▙▖▙▖                  ▙▖▙▖▝▌               ▙▖▝▌▄▌
     000                     003                  012
```

### Three digits, not six

A real odometer is five or six digits because a bike covers six figures of
miles. Nobody will ever hold 100,000 unread conversations, and six digits is a
lot of header on a `max-w-xl` column.

So it is compressed to three, with the leading zeros kept. This is a deliberate
departure from the referent and the only one in the drawing; the leading zeros
are what makes the filling legible, so they stay even though a modern dash
often suppresses them.

### One poll feeds both instruments

This is the part that is actually a refactor rather than a drawing.

`RiderTelltale` owns the 20-second `/api/unread` tick, and its own comment is
emphatic about why that number is what it is: *"this runs in every open tab, so
it's the interval whose cost multiplies."* A second instrument that fetched for
itself would double the app's most-multiplied query to show a number the first
fetch already returned.

So the poll lifts out. The component that owns the tick, the `lastSeen`
module-scope cache and the handle it is keyed to becomes the cluster, and it
renders two presentational children — the wheel and the odometer — from one
`Waiting`. Neither child fetches.

The `lastSeen` cache keeps its current job unchanged: the app layout is client
cached (0005), so a header rebuilt from that cache can carry stale counts, and
the cache keyed by handle is what stops a rider seeing the previous rider's
numbers after a re-login.

### The odometer navigates; the wheel still opens a panel

Asymmetric, on purpose. Activity rows have nowhere to go — there is no
`/notifications` page — so the wheel has to open something. Conversations have
somewhere to go, and it already exists.

The odometer is therefore a `Link` to `/messages` and not a dropdown: one click
from anywhere in the app, prefetched, with no panel in between. That is the
whole complaint this record answers.

### The panel gives the conversations back

With messages carrying their own instrument, the conversation rows leave
`NotificationPanel` and the "All messages" footer link goes with them. The
wheel's badge becomes `activity` alone and finally means one thing.

Leaving them would give the inbox two front doors and keep the wheel counting
two unlike things, which is the ambiguity this record exists to remove.

`waitingTotal` loses its caller in the badge. It stays for the aria sentence,
which still wants to describe everything waiting in one breath.

### Zero is a reading, not an absence

The odometer is always on the dash for a signed-in rider, dim, reading `000`.
Instruments do not disappear when their value is zero — a fuel gauge at empty
is still a fuel gauge — and a control that appears and vanishes is a moving
target for the cursor. Signed out it is not rendered at all, exactly like the
wheel.

## Consequences

**Accepted:**

- One click to the inbox from anywhere, which is the ask.
- Both badges mean exactly one thing each, for the first time since 0007.
- No schema, no migration, no new route, and no new query: the layout and
  `/api/unread` already carry both halves.
- The most-multiplied query in the app does not get more frequent.

**Costs and risks:**

- **The header cluster grows a control** on a `max-w-xl` column that already
  carries a logo, a pod filter, an avatar, a handle, a log-out button and the
  wheel. The narrow breakpoint needs checking with a real two-digit count in
  place, not an empty one.
- **Ghost segments can read as a broken display** to anyone who has not looked
  at an LCD in daylight. The contrast between lit and ghost is the whole
  mechanic and it is the thing most likely to need tuning after seeing it on a
  real screen in both themes.
- **The wheel's meaning narrows**, so a rider used to one badge covering
  everything now has two to look at. That is the point, but it is a change to
  something that already worked.
- **Three digits is a departure from every real odometer.** A rider who notices
  will notice.
- **Lifting the poll touches the component 0007 built** and the `lastSeen`
  cache's remount behaviour, which is subtle and was written against a specific
  bug: logging out and back in as someone else. Whatever the refactor does, that
  case has to still hold.
- **`RiderTelltale` is left holding a name that no longer describes it** once
  it owns two instruments. Renaming it is churn across the layout and the
  header; not renaming it leaves the same trap 0007 already walked into once,
  where the component's name and its job had drifted apart.
