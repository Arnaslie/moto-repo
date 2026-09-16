# ADR 0013 — Tricks: a catalog, with the anatomy pointing at the controls

- **Status:** Proposed.
- **Date:** 2026-09-14
- **Supersedes / superseded by:** takes gear 4 from [0008](./0008-anatomy-diagram.md);
  keeps 0008's diagram and repurposes it
- **Touches (planned):** `packages/core/src/tricks.ts` (new),
  `packages/core/src/drivetrain.ts` (gear 4),
  `packages/core/src/anatomy.ts` (fork dive),
  `apps/web/src/components/anatomy/BikeSkeleton.tsx`,
  `apps/web/src/components/tricks/TrickSequence.tsx` (new),
  `apps/web/src/app/globals.css` (`bike-*`),
  `apps/web/src/app/(app)/tricks/page.tsx` (new),
  `apps/web/src/app/(app)/tricks/[slug]/page.tsx` (new),
  `apps/web/src/app/(app)/anatomy/page.tsx` (removed)

---

## Context

Anatomy filled gear 4 as a reference page: a labelled MT-07, drawn to published
geometry. It is accurate and it is finished, and that is the problem with it as
a gear — there is nothing to come back for. A rider reads it once.

A catalog of tricks gives the gear a reason to be revisited. Each trick — a
wheelie, a stoppie — is something a rider works toward over weeks, and what
stands between them and it is concrete: how strong they need to be, what they
have to be able to do first, and what they should be wearing and have fitted to
the bike.

It also suits how the app is used. Nobody reads a stunt progression mid-ride;
they read it parked, or at home the night before going to a car park to practise.

The diagram 0008 built is not thrown away. It is the right tool for the one
thing a text list does badly: showing *which controls* a trick is done with.

## Decision

Gear 4 becomes **Tricks**, at `/tricks`. `/anatomy` goes; its diagram moves onto
the trick pages.

### The catalog is code, not rows

`packages/core/src/tricks.ts` holds the catalog as plain data, the same way
`gear.ts` holds the avatar catalog — no React, Next or Prisma imports, so the web
app and a future mobile app read the same file. Nothing in this record needs
the database.

```ts
type Control = "throttle" | "frontBrake" | "clutch" | "rearBrake" | "shifter" | "footpegs" | "tank";

type Trick = {
  slug: string;
  name: string;
  family: "foundations" | "wheelies" | "stoppies" | "slides";
  summary: string;
  requires: string[];                        // slugs of other tricks
  strength: { area: string; test: string }[];
  kit: { protective: string[]; bike: string[] };
  sequence: [Beat, ...Beat[]];               // one attempt, beat by beat
  progression: string[];                     // the stages across weeks
  bailOut: string;
};
```

### Prerequisites are other tricks

Every prerequisite is a slug, so the catalog is a graph rather than a list. The
basic skills a trick depends on — holding the clutch in the friction zone,
riding with a foot covering the rear brake — are entries in their own right,
in a **Foundations** family. That keeps one kind of prerequisite instead of
two, and a foundation gets its own page, strength needs and bail-out like
anything else.

| Trick | Requires |
| --- | --- |
| Slow-speed U-turn | friction zone, covering the rear brake |
| Power wheelie | covering the rear brake |
| Clutch-up wheelie | power wheelie, friction zone |
| Stoppie | front brake modulation |
| Burnout | friction zone, front brake modulation |
| Rear-brake slide | covering the rear brake, friction zone |

A power wheelie needs no clutch — it is done on the throttle alone — so the
friction zone is a prerequisite of the clutch-up wheelie only.

### Difficulty is derived, not picked

There is no `difficulty` field. A trick's difficulty is the length of its
longest prerequisite chain, computed from `requires`. A hand-set number drifts
the moment a prerequisite is added; the chain can't. It is the same split the
repo already agreed for mileage: store the facts, derive the score.

### Strength is a test, not a grade

"Medium grip strength" means nothing a rider can check. Each strength need is a
body area and a test that can be done off the bike — *forearms: dead hang for
30 seconds*. These numbers are **picked**, from common coaching advice, not
derived from anything, and the page should not pretend otherwise.

### Kit is Trick Kit

What to wear and what to fit is called **Trick Kit** in code (`kit`). The word
"gear" already means two things here, and this would have been the third.
Trick Kit has two halves, because they solve different problems:

- **Protective** — what the rider wears: full-face helmet, armoured jacket,
  gloves, boots, a back protector for anything that leaves the front wheel.
- **Bike** — what gets fitted: frame sliders or crash cages, a 12 o'clock bar,
  a hand-operated rear brake, a sprocket change.

### Every trick has a bail-out

The bail-out is its own required field, not a line in the progression. For a
wheelie it is the rear brake, which drops the front before the bike loops; for
a stoppie it is releasing the front brake. A trick the rider cannot abort
reliably is one they have not got the prerequisites for, which is why the
foundations exist.

### Every trick follows one template

The first draft's progressions mixed two things in one list: stages that take
weeks ("short lifts from 25 km/h") and what the hands and feet do inside a
single attempt ("feed the clutch until the bike pushes against the brake"). Read
as text, neither made sense, and words like "lever" and "feed" assumed the
reader already knew the controls. Every trick — these nine and any added later —
now carries both, separately:

- **Sequence** — one attempt, beat by beat. Each beat lists its inputs and says
  in plain words what the bike does. An input names a control, and the control
  carries the body part that works it, so a beat reads "Right hand · Front
  brake: squeeze gently".
- **Progression** — the stages across weeks, in plain words, with no control
  jargon. Each step is read on its own, so every action in it names its
  control — "let go of the rear brake", never just "let go". The same holds
  for summaries and bail-outs.

The type is the template: `sequence` and each beat's `inputs` are non-empty
tuples, and a beat without a bike description or a motion does not compile.
A trick's controls are no longer a separate field; they are whatever its
sequence uses.

```ts
type Beat = {
  inputs: [{ control: Control; action: string }, ...];
  bike: string;
  motion: "still" | "rolling" | "burnout" | "skid";
  pitch?: number;  // degrees; + front wheel up, − rear wheel up
  dive?: number;   // share of fork travel, 0–1
};
```

### The diagram plays the sequence on a loop

`TrickSequence` steps through the beats on a timer and hands each one to
`BikeSkeleton`, which lights the controls that beat uses and moves the bike to
match. Choosing a beat from the list pauses on it.

The movement comes from the geometry, not keyframes drawn by eye:

- **Pitch pivots on an axle.** A wheel turns about its axle, so that is the
  point the bike rotates around while the tyre stays on the ground. A wheelie
  pivots on the rear axle, a stoppie on the front.
- **Fork dive** slides the front wheel up the fork axis by a share of the
  MT-07's 130 mm of travel, and rotates the rest of the bike about the rear
  axle by exactly the angle that keeps the front tyre on the ground. The
  wheelbase shortens as the fork compresses, as it does on the real bike.
- **Wheel speed follows tyre size.** At the same road speed the smaller front
  tyre turns faster than the rear, and the ground scrolls at the rear tyre's
  surface speed, so the tyre neither slips nor drags — until a burnout spins it
  with the ground still, or a skid stops it with the ground moving.

Picked, not derived: the beat length, the road speed the animation plays at,
and each beat's pitch angle and dive share. The pitch angles are illustrative,
not a claim about where any bike balances.

**A side view can't show everything.** The handlebars turned in a U-turn and the
rear swinging out in a slide both happen across the bike, out of this view.
Those beats say so in words instead of faking it.

### The far side is dashed

0008 drew the bike from its **right** side: exhaust, front caliper, the
throttle-side bar. From the right the throttle, front brake lever, rear brake
pedal and footpeg are visible. The clutch lever and gear shifter are on the
**left**, behind the bike.

A wheelie is clutch, throttle and rear brake — both sides. The two honest
options are a second, mirrored view, or drawing far-side parts the way a
technical drawing draws any hidden edge: as a **dashed line**. This record takes
the dashed line. It is a real drafting convention, it keeps one diagram per
page, and it doesn't hide the fact that the clutch is on the other side.

The diagram drew the bar and footpeg but no levers or pedals, so the throttle
grip, front brake lever, rear brake pedal, clutch lever and shifter are new
parts. There are no published positions for them, so unlike the rest of the
drawing they are **placed by eye** against the bar and footpeg. From the side
the clutch lever sits directly behind the front brake lever, so the two share
one outline, and the clutch is drawn dashed over it only while it is in use.

The labels and leader lines 0008 drew are gone with the page; the trick pages
name controls in the beat list instead, and git keeps the labelled version.

### Practice is on closed ground

Each trick page says the trick is practised on closed or private ground. 0008
turned down a speed leaderboard for publishing a scoreboard for public roads;
a stunt catalog has the same problem, and saying so costs one line.

### The first catalog

Nine entries, enough to show the graph has depth:

| Family | Tricks | Controls |
| --- | --- | --- |
| Foundations | Friction zone · Covering the rear brake · Front brake modulation · Slow-speed U-turn | clutch, throttle, front brake, rear brake |
| Wheelies | Power wheelie · Clutch-up wheelie | throttle, clutch, rear brake, footpegs |
| Stoppies | Stoppie | front brake, footpegs |
| Slides | Burnout · Rear-brake slide | front brake, clutch, throttle, rear brake |

## Not in this record

**Checking off tricks on a profile.** Riders will mark a trick *learning* or
*landed*, and that shows on their profile. It needs a model, so it is built on
its own branch with its own record. The expected shape is a row per rider per
trick slug, with the slug checked against the catalog in code, so tricks stay
code data and never become rows. Landed tricks are shown, not ranked — no
leaderboard, for the same reason as above.

**The gear renames.** Avatar gear becomes `AvatarGear` (the `GearItemDef` type,
and later the `GearItem` and `UserGear` models) and the nav's `Gear` type
becomes `DrivetrainGear`. They land together as one separate change, and the
Prisma half does not justify a migration of its own yet.

## Consequences

**Accepted:**

- Gear 4 becomes something a rider comes back to, not a page read once.
- 0008's geometry work survives and does more: it now explains a trick instead of
  just labelling a part.
- No schema, no migration, no API route. The catalog is a file.
- Difficulty can't go stale, because nothing stores it.

**Costs and risks:**

- **The content is the hard part, not the code.** Bail-outs and progressions
  are safety advice. They need a rider's review before they ship, and wrong
  advice here is worse than no page.
- **Strength tests are picked numbers** and will be argued with.
- **`/anatomy` stops existing.** Anyone with it bookmarked gets a 404; the
  unlabelled diagram only appears in a trick's context from now on.
- **Five new parts are placed by eye**, in a drawing that is otherwise computed.
  A rider who knows the MT-07 may spot a pedal a few centimetres off.
- **Motion is costlier than a static highlight**: a client component, a timer,
  and CSS transforms nested three deep. Reduced-motion users get the beats
  without the tweening or spinning.
- **Every new trick costs more to add.** A sequence with timed beats and poses
  is real authoring work on top of the text, and that is deliberate.
- **Derived difficulty only ranks by depth.** It first flattened the stoppie
  level with the friction zone, which is why front brake modulation exists as a
  foundation. Any new trick with no honest prerequisite will rate as easy
  whatever it actually takes.
