# ADR 0006 — Seat height fit, measured off the rider

- **Status:** Partly implemented — steps 1–4 of the order of work below; reports (5) and prose (6) unbuilt
- **Date:** 2026-08-27
- **Supersedes / superseded by:** —
- **Touches:** `prisma/schema.prisma`,
  `prisma/migrations/20260827214040_rider_inseam/`,
  `src/lib/{bikes,fit,measure,inseam}.ts`, `src/lib/drivetrain.ts` (gear 3),
  `src/app/api/fit/inseam/route.ts`, `src/app/(app)/fit/page.tsx`,
  `src/components/fit/{FitView,PhotoMeasure}.tsx`

---

## Context

Gear 3 on the drivetrain is unassigned. This takes it.

Buying a motorcycle when you are short is a research problem with bad tools. At
a stop the bike's weight goes through your legs, and whether you can get a foot
down decides whether a bike is a pleasure or a liability. The number everyone
reaches for is published seat height, and it is the wrong number twice over.

**On the rider's side, height is not the measurement.** Inseam is. Two riders at
5'8" can differ by three inches of inseam depending on torso-to-leg ratio, and
three inches is the entire distance between flat-footing a bike and tiptoeing
it. Riders already know this — forum answers are quoted as "30in inseam," never
as a height — but height is what a profile would naively collect.

**On the bike's side, the spec sheet lies in a specific direction.** Published
seat height is unladen. Sit on it and rider sag gives up 25–35mm. And a wide
seat splays the thighs, so the leg travels outward instead of straight down and
the effective reach shortens — a narrow 32in dirt-style seat is routinely easier
to flat-foot than a wide 31in adventure seat. Manufacturers publish the height.
They publish neither the sag nor the seat width.

So the honest version of this feature cannot be built out of spec sheets, and
the useful sentence it should be able to say — *"the number says 31.5in, but
it's a wide seat and it will ride taller than that"* — is exactly the sentence
the available data can't support.

---

## Decision

Build a one-bike-at-a-time fit check, driven by the rider's **inseam**, scored
against **crowdsourced rider outcomes** with a physics estimate as the cold-start
fallback.

### Inseam, not height, stored in millimetres

One number on the profile: inseam in whole millimetres, as an `Int`. Riders quote
inches in the US and centimetres elsewhere and seat heights are published both
ways; storing canonical millimetres and converting at display avoids float drift
and rounding arguments. Height is never persisted — on the photo path it exists
only as the scalar that converts pixels to millimetres, and once the inseam is
derived it has no further use.

### Two ways to get the number, and the provenance of each is recorded

**Typed**, for riders who have measured against a wall. **Photographed**, for
everyone else — which is most people, since almost nobody knows their inseam
offhand.

A tape measurement and a photo estimate do not deserve equal confidence, so the
source is stored alongside the value, the way `UserGear.source` already
distinguishes `starter` from `code`. This is what lets a borderline verdict say
*"go sit on one"* instead of committing to a number it hasn't earned.

### Three photos, and the spread is the point

Side, front, and a second front from further back.

Averaging three shots of the *same* pose is close to worthless here. It cancels
random error — landmark jitter, slight sway — but the dominant error in this
capture is systematic: a phone held at eye level and angled down foreshortens
the legs, consistently, in the same direction every time. Three identically
framed photos average to the same wrong answer with more confidence attached,
which is worse than one.

The three shots are therefore chosen to *disagree* when something is wrong. The
side view is the only one that sees lean and posture. The distance change on the
far front perturbs the perspective foreshortening. So the deliverable is not the
mean but the **spread**: a tight cluster earns a committed verdict, a scattered
one asks for a retake rather than silently returning a bad number. A ±5mm spread
can call a borderline bike; a ±20mm spread cannot.

Capture guidance, in order of how much it moves the measurement:

1. **Camera at hip height.** The single largest error source, worse than posture.
2. Square to the camera, feet together, standing straight, weight even.
3. Full body in frame including feet; plain background helps landmark detection.
4. **Barefoot or socks.** See below.

### Pose estimation runs client-side; the photo is never uploaded

Extracting hip and ankle landmarks is a pose-estimation problem, not a language
problem. A browser-side pose model (MediaPipe or equivalent) returns exactly the
landmarks needed, costs nothing per use, and depends on no API key — which
matters, since the app has no LLM provider wired and a Max subscription cannot
serve one (subscriptions are per-seat for Claude.ai and Claude Code; a deployed
function needs Console API credentials billed per token).

The privacy consequence is the bigger one. A full-body photo of a rider is the
most sensitive thing this app would ever handle, and the right amount of it to
retain is none. The image is processed in the browser, the millimetre figure is
what crosses the network, and no photo is ever written to Blob or disk.

### Footwear is counted once, on the bike side

Pose estimation measures to whatever touches the floor. Photographed in boots,
the derived inseam silently absorbs an inch of sole; add a boot allowance to the
fit calculation afterwards and the same inch is counted twice — enough to flip a
tiptoe verdict to flat-foot and lose the rider's trust on the first bike they
try.

So: capture barefoot or in socks, store true inseam, and treat footwear as a
separate variable where it belongs, at calculation and report time. The typed
path carries the same instruction.

### The verdict is five bands, scored on one foot

Riders stop with one foot down and the other covering the rear brake. Both feet
flat is a comfort bonus, not the threshold, so the scale is built around one-foot
reach:

`both flat` → `one flat` → `balls of one foot` → `tiptoe` → `cannot reach`

### Rider reports are the primary source; the physics estimate is cold start

The data that decides a fit is not seat width in millimetres. It is outcomes:
*"30in inseam, flat-foots a Rebel 500."* That requires no measuring equipment, it
is what riders already volunteer unprompted, and it is ground truth rather than a
model. With enough of them the sag and splay never need to be known — the bike
that rides taller than its number reveals itself in the reports without anyone
having to explain why.

So the estimate is the fallback, not the plan:

- **Fewer than 3 comparable reports** — estimate from specs.
  `effective = published − sag(category)`, compared against inseam with a
  penalty from a hand-classified seat-width class (narrow / medium / wide).
  Sag is a per-category default (cruiser, sport, ADV, standard) with a per-bike
  override where it's actually known, rather than pretending to a measured
  figure for each.
- **3 or more comparable reports** — read the boundary off the reports.

The band thresholds in the estimate are empirical, not derivable. They need
calibrating against bikes a real rider has thrown a leg over, and they are
expected to be wrong until they are.

The UI must always say which it is showing — *"estimated from specs"* versus
*"based on 14 rider reports"*. The honesty is also the recruitment: a rider who
sees an estimate is being told, accurately, that their report would improve it.

### N = 3, which works only because reports are filtered before they are counted

At three reports an outlier cannot be detected. Three reports containing one
lowered bike look identical to three reports with honest variance. The report
form's flags are therefore not metadata attached to a report — they are what
makes a threshold this low survivable. **Filter first, then count.** A report
tagged *lowered* does not count toward the stock boundary; it counts toward the
lowered one. N=3 means three *comparable* reports.

The form asks:

- **Footwear** — barefoot/socks, sneakers, riding boots. Not optional; it is the
  systematic inch.
- **Bike as configured** — stock, lowered suspension, low seat option, raised.
- **Verdict** — one of the five bands.
- Possibly **"I slide forward to reach"**, which is a real technique on tall
  bikes and a materially different answer from flat-footing while seated
  normally. Undecided; see open questions.

The reporter's inseam is attached automatically from their profile rather than
asked again.

### Inseam is private, by the strictest available default

Body data. It is stored private and stays private; what a rider may want to share
is the *result* — "flat-foots a Rebel 500" — which is the social currency, not
the raw measurement.

Layered view permissions are a real feature and belong to a separate branch. This
record commits only to the strictest default now, so that the permissions work
later is a widening of access rather than a retrofit onto something already
leaking.

### `Motorcycle` is a garage, not a catalogue

The existing model is ownership — `userId`, `nickname`, no specs. Nothing in it
can be compared against. A fit check needs a separate catalogue row carrying
year/make/model, published seat height, sag category, and seat-width class,
seeded the way `GearItem` already is through `seed-catalog.ts`.

The exact schema is the database agent's call, not this record's. What this
record commits to is the separation: the catalogue is not `Motorcycle`, and
reports hang off the catalogue entry rather than off anyone's garage.

---

## Consequences

**Accepted:**

- The app gets a genuine reason for a rider to enter private data, and a genuine
  reason to come back and contribute once they've sat on something.
- No LLM provider is required to ship it. The feature is unblocked by the absence
  of an API key.
- No photo ever leaves the device, so the most sensitive input in the app has no
  storage, no serving route, and no breach surface.
- The estimate degrades gracefully into real data instead of being replaced by it.

**Costs and risks:**

- **The estimate will be wrong at launch,** on every bike, because no reports
  exist and the thresholds are uncalibrated. The UI's honesty about which source
  it is using is the only thing keeping that from reading as a bug.
- **N=3 is thin.** It is a bootstrapping figure for a small community, chosen
  knowing that three comparable reports is a weak basis for a boundary. It should
  be revisited once real report volume exists.
- **Pose estimation accuracy is unproven here.** Nothing in this record has been
  tested against a real body; the ±spread thresholds that decide "commit" versus
  "retake" are guesses until measured.
- **Self-reported outcomes carry self-reported inseams,** most of which will be
  photo-derived. Errors on the rider side and the report side are correlated.
- **A catalogue invites moderation.** Rider-submitted data is a write path from
  strangers into shared state; the security agent should look at it before it
  ships, not after.
- **Inseam is private with no permission layer yet,** so the only safe setting is
  the strictest one, and riders cannot share it even if they want to.

---

## Explicitly deferred

- **Layered view permissions** on inseam — separate branch.
- **Footwear variance detection** from the photo. Riders are instructed barefoot
  or socks; detecting and correcting for shoes is a later feature.
- **Scraping a bike catalogue.** Seed data first. Published heights vary by trim,
  seat option and suspension setting, and the two fields that matter most are not
  published at all, so scraping buys less than it appears to.
- **An explanation layer** — prose describing *why* a bike rides taller than its
  number. Genuinely useful, genuinely an LLM job, and not on the critical path.
  Revisit when a provider exists.

---

## Open questions

- Does the report form carry **"I slide forward to reach"**? Real signal, but it
  splits an already-thin pool at N=3.
- What is the retake threshold, in millimetres of spread, between a committed
  verdict and "go sit on one"? Needs measurement against real captures.
- Do the five bands need a sixth for *"flat-foots both, but only just"*, or does
  the borderline flag carry that?

---

## Order of work

1. Catalogue model + seed data for a hand-classified starter set (~20–30 popular
   bikes, seat-width class and sag category entered by hand). **database.**
2. Inseam on the profile — private, millimetres, with provenance. **database.**
3. Typed-inseam entry and the fit calculation against the estimate, gear 3 wired
   on the drivetrain. **programmer.**
4. Browser-side pose capture: three shots, spread-as-confidence, no upload.
   **programmer.**
5. Report form and the filter-then-count boundary. **programmer**, with a
   **security** pass on the write path before it ships.
6. Explanation prose. **ai-engineer**, once a provider exists.

---

## Revised while building

**No pose model — the rider marks the points.** This record's photo path assumed
a browser-side pose estimator. It doesn't use one. A pose model returns the *hip
joint*, roughly the greater trochanter, which sits well above the crotch; taking
that as an inseam overestimates it on every rider in the same direction, which
is the one error shape this feature cannot afford. The rider marks head, crotch
and floor by hand instead. That needs no model, no download and no dependency,
and it keeps the stated privacy property intact — see `src/lib/measure.ts`.

**The catalogue is a const, not a table.** Nothing holds a foreign key to a bike
until reports land, so `BIKE_CATALOG` lives in `src/lib/bikes.ts` and there is no
`BikeSpec` model, no seed script and no migration for it. Editing a seat height
is a one-line diff. When reports arrive they can carry the slug as a plain
string, the way `GearItem` ids already work, or the catalogue gets promoted then
— that choice is still open.

The whole database footprint is consequently three nullable columns on `User`.

---

## Verification

Static: `tsc --noEmit`, `eslint`, `next build` — all clean.

**Against the local Postgres**, with the dev server running:

- The migration is three bare `ADD COLUMN`s — no default, no backfill, no table
  rewrite. Applied to a database holding the seeded riders; `ada` and `bex`
  survived with NULLs.
- 18 API assertions. Both verbs 401 signed out. `/fit` signed out redirects to
  `/login?next=%2Ffit`. The unit-slip guard rejects an inseam sent as inches
  (30) or centimetres (76) rather than accepting it and returning a confident
  wrong verdict. Spread is required on the photo path and refused on the typed
  one. Floats round. `DELETE` clears all three columns.
- **The privacy claim was tested, not asserted.** A distinctive inseam was
  stored for `ada`, then every page that renders a rider — her profile, the
  riders list, the feed, the locations API — was fetched as `bex`, signed out,
  and as `ada` herself, and grepped for the value. All clean; the control (her
  own `/fit`) found it, which is what makes the negatives worth anything. An
  earlier run of this probe reported all-clean *including* the control — the
  probe itself was broken. A leak test whose control doesn't fire is measuring
  nothing.
- 16 geometry assertions on `measure.ts`: scale- and position-invariance,
  every degenerate mark ordering returning null rather than dividing by
  something near zero, the median resisting one bad shot, half-range spread.

**In a real browser**, driven with a cursor:

- Gear 3 engages, labelled Fit; gear 4 remains a dashed blank.
- Typed entry saves and the verdict renders. Photo path exercised end to end
  with three injected figures of known proportions: the marks landed, the per
  shot estimate came back 767mm against an expected 768 (click precision, not
  arithmetic), the median held at 758 against a deliberate 666 outlier, and the
  ±51mm spread tripped both the retake warning and the borderline verdict.
- **Nothing was uploaded.** The dev server log carries no upload, blob or media
  traffic for the whole photo session — only the millimetre figure, on
  `POST /api/fit/inseam`.
- Layout is clean from 360px up. At 320px two elements overflow, both in the
  shared `SiteHeader`; the same overflow reproduces on `/riders`, which this
  branch never touched.

**Not verified:** `prefers-reduced-motion`, a keyboard-only pass, real camera
capture on a phone, and — the big one — whether any published seat height in
`BIKE_CATALOG` is correct. They were drafted from memory and are marked as
unverified in the file.
