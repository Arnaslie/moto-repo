# ADR 0008 — Anatomy, drawn to a real machine

- **Status:** Implemented. Written after the code rather than before it, which is
  not the habit this directory asks for — recorded here because gear 4's long
  search is the part worth keeping, and it would otherwise survive only in a
  chat log.
- **Date:** 2026-09-03
- **Supersedes / superseded by:** —
- **Touches:** `src/lib/anatomy.ts`, `src/components/anatomy/BikeSkeleton.tsx`,
  `src/app/(app)/anatomy/page.tsx`, `src/lib/drivetrain.ts` (gear 4),
  `src/app/globals.css` (`--anat-*`)

---

## Context

Gear 4 was the last blank on the drivetrain, and it stayed blank longest. The
nav draws an unassigned gear as a dashed, uncut sprocket, so the vacancy was on
screen on every page — which is the right pressure, but it had been there since
gear 3 became Fit.

Several candidates were worked through and dropped, and the reasons are the
useful part:

**Routes.** The original placeholder. Dropped: turn-by-turn navigation belongs to
the intercom and the phone mount, and this app is deliberately the one you use
parked or at home.

**Kit and Wrench.** Real gear tracking (helmet expiry, what to wear for the
forecast) and maintenance intervals (chain slack, tread, service by odometer).
Both are good and both survive as future work. Neither was chosen.

**A leaderboard — miles, top speed, fastest time on a course.** Dropped on two
counts. First, there is nothing to rank: `Motorcycle` carries year/make/model,
and `Location` is a single overwritten position row per rider, not a track log.
Ranking anything needs ride recording, which is the in-motion case this app does
not take. Second, ranking speed on public roads means publishing a scoreboard
for it, which is the Strava KOM problem with worse consequences.

**A virtual lap of the Isle of Man Mountain Course, paying out a boosted post.**
The best of the rejected ideas: distance-only progress structurally cannot
reward speed. It died on the reward rather than the mechanic — the feed is a
bare `findMany` ordered by `createdAt` with no `where`, and there is no `Follow`
model, so "everyone sees it even if they don't follow you" is already the
default and the prize was worth nothing.

**Aura.** Mileage accruing into rider status. Parked, not killed: the mechanic
is agreed and the formula deliberately is not, so building it now would freeze
the part that was explicitly left open.

Every one of those needs a data pipeline that does not exist. What finally took
the gear needs none: a labelled anatomical diagram of a motorcycle. It is
reference material, it is read while parked, and it fits an app whose audience
includes people learning what the parts are called.

## Decision

A static, server-rendered side view of a naked bike, in one weight of the brand
orange, with every major part named and pointed at.

### The geometry is computed from a real machine

Published Yamaha MT-07 figures, not a bike-shaped sketch. Tyre radii come off
the sidewall markings (`120/70-17`, `180/55-17`) rather than being picked; the
steering axis is built from rake and trail, with the triple-clamp offset solved
out of them —

    trail = (R·sin ε − offset) / cos ε

— which lands on 42 mm against the real bike's ~40 mm, the difference being that
published rake and trail are quoted with the suspension settled. The chain runs
on the external tangents between a 16-tooth and a 43-tooth sprocket, each sized
from the tooth count and the ⅝-inch pitch of 525 chain.

This is the same discipline as `lib/drivetrain.ts` and `PodFilter.tsx`, and it
is not decoration: the derived trail comes back out at exactly 90 mm, so the
drawing checks its own arithmetic. A naked bike was chosen precisely because
nothing is behind a fairing.

The bodywork — tank, seat, tail, headlight — is a likeness hung on those hard
points, and is marked as such in the source. Nobody publishes a section through
a fuel tank, and pretending otherwise would be the kind of approximated
mechanism this codebase avoids.

### Nothing is drawn where another part hides it

The frame spar leaves the steering head *under* the tank, and the subframe runs
*under* the seat. Drawn in full they read as loose diagonals crossing the bike;
drawn only where they emerge, they read as structure. The exhaust header is
split at the radiator for the same reason. `A.FRAME_SPAR` keeps the whole
member, because it is the true geometry — the component draws the visible run.

### The figure breaks out of the feed column

The app layout caps every page at `max-w-xl`. That is right for a feed and
wrong for a reference figure: twenty-six labels inside 544 px are unreadable.
The figure alone breaks out to the viewport while the prose around it stays in
the column, and below tablet width it holds a floor of 1100 px and pans, rather
than shrinking its labels past legibility.

## Consequences

Every gear now has a page. `notBuilt` in `Drivetrain.tsx` — the dashed,
unclickable blank — has nothing left to draw, and the `grind` interaction it
guarded is now unreachable. Both stay: the next idea that outgrows a page will
want them, and deleting them would cost more than leaving them.

The page has no session, no query and no client JS of its own. It is still
served on demand rather than prerendered: the shared `(app)` layout reads the
session cookie to render the header, which makes every route under it dynamic.
Making this one static would mean lifting it out of that layout, and losing the
nav is not worth it.

Bikes other than the MT-07 are not supported and the diagram is not driven by
the `Motorcycle` table. Making it so is a real feature and a different ADR;
every model has its own rake, wheelbase and frame type, and the honest version
would need per-model geometry the app does not have.

Aura, Kit and Wrench remain unbuilt, and gear 4 is no longer available to any
of them.
