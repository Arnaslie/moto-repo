# ADR 0011 — Chalk: crowdsourced road annotations on gear 2

- **Status:** Proposed.
- **Date:** 2026-09-05
- **Supersedes / superseded by:** —
- **Touches (planned):** `apps/web/prisma/schema.prisma` (`Stretch`,
  `StretchVote`, `TagTrend`), `packages/core/src/stretches.ts`,
  `apps/web/src/app/api/stretches/route.ts`,
  `apps/web/src/app/api/stretches/[id]/route.ts`,
  `apps/web/src/app/api/stretches/[id]/vote/route.ts`,
  `apps/web/src/app/api/stretches/trends/route.ts`,
  `apps/web/src/app/api/cron/trends/route.ts`, `apps/web/vercel.json`,
  `apps/web/src/components/RiderMap.tsx`,
  `apps/web/src/components/RidersView.tsx`,
  `apps/web/src/components/StretchComposer.tsx`,
  `apps/web/src/components/StretchTrends.tsx`,
  `apps/web/src/app/globals.css` (`--chalk-*`)

---

## Context

Gear 2 is **Riders** — a Leaflet map of live rider pins, fed by
`GET /api/locations` on a 5 s poll (`RidersView.tsx`). `Location` is one
upserted row per rider handle with a
`sharing` flag and an active window, so the map shows exactly the people
broadcasting right now.

That is the page's weakness. Nobody is sharing at 3am in February, and the
page is then a world map with nothing on it. Gear 2 has no resting state.

The pitch is Hoodmaps for roads: a stretch of road carries a description the
community wrote, and you read it before you go. Hoodmaps works because the
knowledge is local, subjective, and unwritable by any authority — which is
exactly the knowledge riders trade in car parks and forums and lose every time
a thread dies.

### Why this isn't the Routes idea that ADR 0008 rejected

0008 dropped Routes because turn-by-turn navigation belongs to the intercom and
the phone mount, and this app is deliberately the one used parked or at home.
Chalk does not route anybody. It is reference material about roads, read before
the ride and written after it — the same shape as Anatomy, on a map instead of
a diagram. The off-the-bike constraint is a *reason for* this feature, not
against it: you do not tag a gravel patch while riding over it.

### The other rejection this has to stay clear of

0008 also dropped leaderboards, because ranking speed on public roads means
publishing a scoreboard for it. Chalk is one step from that: "best road to send
it on" is a description, and it is also a recommendation. The line taken here is
that the vocabulary describes a road's **character and condition**, never a
rider's performance on it — no times, no speeds, no "how fast this corner
goes". Half the vocabulary is hazards, which is the safety-positive half of the
same feature.

## Decision

A community annotation layer on gear 2's existing map, named **Chalk** — what
riders chalk onto a stretch.

### The unit is a stretch of road, not a Hoodmaps blob

This is the one place the design deliberately departs from its inspiration.
Hoodmaps' primitive is a rectangle dragged over a neighbourhood, because a
neighbourhood *is* an area. A road is not. A rectangle over a canyon pass also
covers the town below it, the valley floor, and the dual carriageway on the far
side — none of which share the pass's character, and all of which would inherit
its label.

So the primitive is a **polyline drawn along the road**: an ordered array of
points, rendered as a thick coloured casing that follows the tarmac. It is a
worse fit for a mouse and a much better fit for the thing being described. This
is the same move as ADR 0004 and 0008 — take the shape from the real object.

### Schema — three models, ledger stored, score derived

```prisma
// A stretch of road somebody has chalked. The geometry is an ordered point
// array; the four bbox floats are what the viewport query actually reads.
model Stretch {
  id       String @id @default(cuid())
  authorId String

  // What sort of claim this is: surface | hazard | character | stop. Carries
  // the colour and the half-life — see STRETCH_KINDS. A bare String with a
  // type guard beside it, per house convention; no enums.
  kind  String
  // What the rider actually wrote, as they wrote it. 32 characters.
  label String
  // The same thing normalised — lowercased, trimmed, inner whitespace
  // collapsed, trailing punctuation dropped. Nothing renders it; it exists so
  // "Gravel", "gravel" and "gravel!" count as one tag when they're aggregated.
  slug  String

  path   Json  // [{lat,lng}, ...], 2..40 points
  minLat Float
  maxLat Float
  minLng Float
  maxLng Float

  createdAt DateTime @default(now())

  author User          @relation(fields: [authorId], references: [id], onDelete: Cascade)
  votes  StretchVote[]

  // The viewport query: everything whose box overlaps the visible box.
  @@index([minLat, maxLat])
  @@index([minLng, maxLng])
  @@index([authorId])
  // The nightly aggregation walks the table by slug.
  @@index([slug])
}

// A rider's ± on a stretch. Unique per pair, so a double tap or an offline
// retry can't inflate the score — the same idempotency-via-unique-constraint
// move Wave makes.
model StretchVote {
  id        String   @id @default(cuid())
  stretchId String
  userId    String
  value     Int // +1 confirms, -1 disputes
  createdAt DateTime @default(now())

  stretch Stretch @relation(fields: [stretchId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([stretchId, userId])
  @@index([stretchId])
}

// What riders call a patch of the world, recomputed on a schedule rather than
// on read. This is a cache with a clock, not a source of truth: every row is
// derivable from Stretch, and dropping the table costs one night.
model TagTrend {
  id   String @id @default(cuid())
  // Lat/lng floored to CELL_DEG and joined — "52.0:-3.5". A string because it
  // is only ever an equality lookup, and two floats would need a compound key
  // to say the same thing.
  cell String
  slug String
  // The most common surface form of this slug in this cell, so the panel shows
  // "Gravel After The Bridge" the way riders write it rather than the key.
  label String
  kind  String
  count Int

  computedAt DateTime @default(now())

  @@unique([cell, slug])
  // The panel's one query: this cell's tags, most-used first.
  @@index([cell, count])
}
```

Score and freshness are **derived, never stored** — the split already agreed for
anything cumulative in this repo. `score` is the sum of `value`; `lastConfirmed`
is the newest `+1`, falling back to `createdAt`. `TagTrend` is the one stored
aggregate, and it is stored because it is a scheduled snapshot rather than a
running total: nothing increments it, the job replaces it.

No PostGIS. Four float columns and two b-tree indexes answer the only spatial
question this feature asks — "which boxes overlap this box" — and adding an
extension to buy a `geography` column would be paying a migration and a Neon
dependency for a query we can already write.

### Vocabulary — riders write the label, the kind carries the clock

The first draft of this record had a closed set of eight tags. That was wrong,
and it was wrong for the reason the whole feature exists: Hoodmaps reads the way
it does because the labels are what people actually say, and a fixed list can
only ever offer what somebody anticipated. *Sheep everywhere*, *camera van on
the straight*, *closed in winter* — none of those are a tag anyone would have
thought to enumerate, and all of them are exactly what a rider would write.

So the label is **free text, 32 characters**. The limit is doing real work
rather than being a database convenience: these render as permanent tooltips
stacked on a map at zoom 12, and anything longer overlaps its neighbours into
mush. 32 is the width of "gravel in the third right-hander", which is about the
longest thing worth saying.

What a fixed list *was* buying is a half-life, and a free string cannot tell the
renderer whether it has three weeks or a decade of truth in it. So the taxonomy
shrinks to four **kinds** — one tap, before the text — and the kind carries both
the colour and the clock:

| kind | the claim | half-life |
| --- | --- | --- |
| `surface` | what the road is made of right now — gravel, frost heave, diesel | 21 days |
| `hazard` | what will hurt you that isn't the surface — livestock, blind crest, a camera van | 45 days |
| `character` | what the road is like to ride, which is a property of the road | none |
| `stop` | somewhere worth pulling into — fuel, coffee, a viewpoint | 365 days |

Render opacity falls off as a stretch goes unconfirmed past its half-life. A
stale warning fades out of the map rather than being deleted, and one `+1` from
anybody puts it back at full strength. This is what stops the map filling with
last spring's gravel while leaving a good road good.

Four kinds rather than eight tags is also fewer decisions at the point of
writing, which matters more than it looks: the thing being asked for is a
sentence about a road, and every extra field is a reason to close the composer.

`enforcement` stops being a taxonomy question and becomes what it always really
was — something riders write. The position is unchanged and worth restating: we
do not filter it. It is what Waze has done for fifteen years, and a vocabulary
that excluded it would not stop anyone writing *camera van on the straight*.

There is still no way to record a speed, a lap time, or how fast a corner takes,
and with free text that is now a moderation position rather than a schema one.
The absence is the decision either way.

### What riders call a place, once a day

The nightly job groups every stretch by `(cell, slug)`, counts, and replaces
`TagTrend` wholesale. `cell` is lat/lng floored to **0.5°** — roughly 55 km
north-south, less east-west as you leave the equator, which is imprecise in
exactly the way a "what do people call this area" panel can afford to be.

It runs on **Vercel Cron**, which is new machinery for this repo: notifications,
DMs and locations are all client-polled on timers (ADRs 0003 and 0007), and
nothing has ever run server-side on a schedule. A poll cannot do this one — the
aggregation is over every rider's writing, not the viewer's, so there is no
client whose tick is the right tick.

Daily rather than live is a deliberate lag. A trending panel that updated on
every vote would be a scoreboard, and would invite the gaming that ADR 0008
rejected leaderboards to avoid; a day-old snapshot is a description.

The job is idempotent — it computes and replaces, holding no state between runs
— so a missed night costs nothing and a double run costs nothing.
### Writing requires an account

`RidersView` identifies a rider by a free-text handle in `localStorage`
(`moto:rider`), which is fine for a pin that expires out of an
active window and is not fine for durable public content on a shared map.
Chalk goes through `getCurrentUser()`: signed-out visitors read the layer,
accounts write and vote. `Stretch.authorId` is a real foreign key with
`onDelete: Cascade`.

Moderation is derived too — a stretch below a score floor stops rendering rather
than being deleted, and an author can delete their own. There is no admin role
in this codebase, so there is no takedown path beyond that. That is a known gap,
recorded here rather than papered over.

### Rendering and drawing

Both layers live on the **one existing Leaflet instance** in `RiderMap.tsx`.
Live pins and chalk are the same map; the alternative — a second map page —
splits gear 2 in half and doubles the tile traffic.

- Each stretch draws as a casing (`weight+4`, dark) under a core polyline in the
  kind's colour, so it reads against both OSM tiles and the dark theme. Colours go
  in `globals.css` as `--chalk-*`, matching the `--drive-*` / `--anat-*` habit.
- The label renders as a permanent `L.tooltip({ direction: "center" })` at the
  polyline midpoint. Permanent, not hover: text sitting on the map is the whole
  reason Hoodmaps reads the way it does.
- **Zoom floor of 11.** Below it the layer is hidden entirely — a stretch is
  illegible at country scale, and the floor doubles as the guard that stops the
  viewport query asking for a continent.
- Drawing is click-to-drop-vertex on the existing map, Escape to cancel, then
  the kind/label form — one tap and one line, and it closes. No
  `leaflet-draw`: it is an unmaintained plugin with its own CSS and icon
  assets, and what it buys is about fifty lines of click handler.

### API

- `GET /api/stretches?minLat=&maxLat=&minLng=&maxLng=` — bbox overlap, capped at
  200 rows ordered by score. Fetched on map `moveend`, not on a timer; this is
  reference data, and the 5 s location poll stays the only thing on a clock.
- `POST /api/stretches` — `{ kind, label, path }`. Server derives the bbox and
  the slug from what it is sent; neither is accepted from the client, because a
  slug that disagreed with its label would silently split a tag in two.
  Validation (point count, label length, kind membership, coordinate range)
  lives in `packages/core/src/stretches.ts` beside the existing
  `parseLocationInput`, so the future mobile app gets it for free (ADR 0009).
- `POST /api/stretches/[id]/vote` — `{ value: 1 | -1 }`, upserted on the unique
  pair.
- `DELETE /api/stretches/[id]` — author only.
- `GET /api/stretches/trends?minLat=&maxLat=&minLng=&maxLng=` — the `TagTrend`
  rows for the cells the viewport covers, most-used first. Reads the snapshot
  only; it never aggregates on the fly, which is the point of having it.
- `GET /api/cron/trends` — the nightly job. `GET` because that is what Vercel
  Cron issues, and guarded by a `CRON_SECRET` bearer check, because a route on
  a public domain is reachable by anyone who guesses the path. Scheduled from
  `apps/web/vercel.json`; the secret is Production- and Preview-scoped the way
  ADR 0010 scopes the rest.

## Consequences

- **Gear 2 gets a resting state.** The map is worth opening with nobody live on
  it, which is most of the time.
- **Gear 2's name gets shakier.** "Riders" describes the pins, not the roads. A
  rename touches the six-gear scheme and is not decided here.
- **A cold map is an empty map.** Chalk is worthless until a corridor has enough
  annotations to be worth panning to, and there is no seeding strategy in this
  record. Seeding a handful of real stretches near the seeded riders is the
  cheapest way to see whether the rendering holds up.
- **Bbox overlap is coarse.** A long diagonal road has a box far larger than
  itself, so the viewport query over-fetches. At this scale that is the right
  trade; PostGIS is the answer if it ever isn't.
- **Antimeridian is not handled.** A stretch crossing ±180° gets a bbox spanning
  the globe. Noted, not solved.
- **Decay is a render-time computation**, so a stale hazard still occupies a row
  and still comes back in the query. Fine until the table is large.
- **Free text is the moderation surface.** A closed vocabulary could only be
  misapplied; an arbitrary 32-character string rendered permanently on a shared
  map is the thing that actually needs watching, and the score floor plus author
  delete is the whole of the defence. This is the cost of the freedom and it is
  worth paying, but it is the first thing that will need revisiting.
- **`enforcement` is a product position**, not a tag any more. If it ever needs
  to go, it goes by a new ADR — and with free text, going means filtering, which
  is a harder thing to do well than leaving a row out of a table.
- **The first server-side schedule in the repo.** Everything else is client
  polling. A cron that silently stops is invisible — the panel just goes
  stale — so `computedAt` is on every row and the panel renders its own age.
- **`TagTrend` can disagree with the map.** A stretch chalked this morning is
  not in the panel until tonight, which is the lag being bought deliberately and
  will still read as a bug to somebody.
