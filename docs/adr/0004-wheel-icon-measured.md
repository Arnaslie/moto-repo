# ADR 0004 — The wheel, measured off the reference

- **Status:** Implemented
- **Date:** 2026-08-25
- **Supersedes / superseded by:** revises the `WheelIcon` section of
  [0001](./0001-app-wide-notifications.md)
- **Touches:** `src/components/icons.tsx`, `src/components/messages/MessagesLink.tsx`

---

## Context

[ADR 0001](./0001-app-wide-notifications.md) specified the header icon as a
motorcycle wheel rather than a bell, gave a table of geometry, and named the
reference: the Ninja H2R press photo kept in `assets/`. The table's own column
says how each number was arrived at — "derived", "picked", "read off the photo".

Three of those numbers were read off the photo by eye. This record is what
happened when they were measured instead, and it revises 0001's icon section on
two counts. Everything else in 0001 — the wheel rather than a bell, the accent
coming off the rim stripe rather than a badge, `currentColor`, the 22–24px
target — is unchanged and is what got built.

---

## Decision

### The geometry is measured, and it holds

Fit a circle to the tyre's outer silhouette, then read every radius as a
fraction of it: the rim's inner edge is a hard brightness step at 0.595, the
green pinstripe peaks at 0.70, the rim lip is 0.72. Dividing through by the lip
puts the icon in units of the rim, which is what gets drawn — 0001 already
traded the tyre away, and that call stands.

Blade widths came from walking outward from each spoke axis until white sky
showed through the window on *both* sides, at every radius the photo leaves
unoccluded. The first attempt measured the windows instead and came out ~40%
too wide, because the brake rotor and sprocket sit behind them and stopped the
walk early.

The result worth keeping: **the widths fall on a straight line**, half-width
`0.193 - 0.254r` in rim units. Flat-sided blades, so the spider is a true
five-pointed star, and extrapolating to where adjacent blades touch puts the
valleys at 0.318. Checked against the photo the model holds to 0.5°, which is
better than the photo can be read.

0001's guesses came out well: five spokes and 72° pitch are the object, and the
hub at ~0.22 of the rim lands on the bolt circle.

### Deviation 1 — the blade roots stay open

0001 has the blades merging into the star the casting actually has. Measured,
that star's waist is 0.385 of its points. A five-pointed star with a 0.385
waist is *geometrically* a sheriff's badge — the classic star is 0.382 — and
filled at 24px that is exactly what it reads as. Rendered and looked at, there
was no argument: a badge, not a wheel.

So the measured taper runs from the rim in to 0.47, and inside that the blade
runs to the hub at constant width, leaving the five windows open to the hub
ring. It costs the interlocking roots, which the photo only shows because it's
340px wide. This is the same trade 0001 already made for the tyre, the disc and
the blade twist, one item further along.

Worth being plain: this is the one place the icon is *not* the object. The
windows pinch shut on the real wheel at 0.23, barely outside the bolt circle,
and here they don't.

### Deviation 2 — a blade at twelve o'clock, not a window

0001 picked a window at twelve, to keep the icon from reading as a badge. That
rotation puts a blade pointing straight down and two pointing up, which on a
filled star is an inverted pentagram — 0001's own concern, arrived at the other
way round. Once the windows are open neither phase reads as a badge, so the
reason no longer decides it, and the tie goes to the reference: a blade at
twelve, three degrees off vertical, the angle the photographed wheel is stopped
at.

### The stripe is drawn wide

The green line is 0.042 of the rim. At header size that is a half-pixel, and an
unread mark nobody can see isn't one, so it's drawn at roughly twice scale.
Position is honest; width is not.

### It lights the Messages link, not a separate tell-tale

0001 puts the wheel in `RiderTelltale.tsx` and keeps a separate inbox link
beside it. The tell-tale needs the notification layer, which
[0003](./0003-direct-messages-polled.md) did not build, and 0003 noted what the
header carried instead: "a plain Messages link with a count, which is a link
with a number on it, not an instrument".

The wheel goes on that link. Same states, narrower source — unread DMs rather
than everything waiting. When the notification layer lands the wheel keeps its
place and widens what feeds it, which is a change to one `fetch`.

One consequence: the link lost its word. It is now icon and count, with an
`aria-label`, which is what 0001 designed and what `WaveButton` already does.

**The link keeps the header's text ramp in both states.** The version before
this turned the whole link orange on unread, which would have painted the wheel
in exactly the colour the stripe is and hidden the signal inside itself. The
count beside it carries the orange; the wheel doesn't.

---

## Consequences

**Accepted:**

- The header has an instrument rather than a labelled link, and the unread state
  is a part of the object doing what that part does.
- The numbers are in the source with how they were got, so the next person can
  disagree with the reading rather than with a taste.

**Costs and risks:**

- **The roots are wrong**, knowingly. Anyone who reads the icon as a claim about
  the casting is being misled about one detail — hence this record.
- **Below ~18px the windows silt up** and it goes to a disc. 0001 said the
  windows would be first to go and they are; there is no separate small-size
  form, just a floor.
- **The word "Messages" is gone** from the header. An icon in a control cluster
  is a guess for anyone who hasn't clicked it once.
- The measurement rig — circle fit, polar unwrap, angular walks — was scratch
  work and is not in the repo. Re-deriving means rebuilding it. **The method is
  the "geometry is measured" section above**; `icons.tsx` carries the resulting
  numbers with a source note on each, and points back here. (It once carried the
  derivation too, which made this line true when it was written; the prose was
  cut when the repo's comments were, and the record is the right home for it.)

---

## Verification

`tsc --noEmit`, `eslint` and `next build` clean.

Rendered and looked at, which is the only test that decides an icon: quiet and
lit, at 96 / 40 / 28 / 24 / 22 / 18px, on both the light and dark ground, with
the real stylesheet so `--drive-accent` resolves the way it will in the app.
Also rendered in the real header, signed in as a rider with mail waiting, at the
size it actually ships at.

Two things that check found and the geometry didn't: the whole-link orange
hiding the stripe, and that the first three treatments tried — filled star,
outlined star, filled star with a round core — all read as badges.

**Not verified:** the hover state on an unread wheel, which takes the icon
orange and merges the stripe into it. It matches every other link in the header
cluster, so it's left alone, but it does mean hovering costs you the signal.
