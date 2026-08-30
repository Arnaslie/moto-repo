# ADR 0007 — Notifications, polled

- **Status:** Accepted, not yet implemented
- **Date:** 2026-08-29
- **Supersedes / superseded by:** supersedes [0001](./0001-app-wide-notifications.md)'s
  delivery mechanism and its tell-tale wiring; completes 0001's data model minus
  `Block`
- **Touches:** `prisma/schema.prisma`, a new migration, `src/lib/{notifications,notify}.ts`,
  `src/app/api/unread/`, `src/app/api/notifications/`,
  `src/app/api/posts/[id]/{waves,comments}/route.ts`,
  `src/app/(app)/layout.tsx`, `src/components/messages/MessagesLink.tsx` →
  `src/components/RiderTelltale.tsx`

---

## Context

[ADR 0001](./0001-app-wide-notifications.md) specified DMs and a notification
layer together. [0003](./0003-direct-messages-polled.md) built the DMs and
polled them rather than streaming them. What 0001 called steps 4–7 — waves and
comments actually telling you they happened — has never been built, and it is
the half riders can see the absence of: a wave on your post is still something
you find out by scrolling back to it.

Three things about the repo have changed since 0001 was written, and each of
them retires a piece of its reasoning.

**The header lives in a layout.** [0005](./0005-chrome-in-a-layout.md) moved it.
0001 made the tell-tale open its own stream specifically to avoid threading an
`initialUnread` prop through seven `SiteHeader` call sites — "Zero refactor" was
the whole of that argument. There is one call site now, `src/app/(app)/layout.tsx`,
and it already renders an opening count into the HTML. The prop it was avoiding
exists and is one line.

**DMs proved the poll.** 0003 shipped three timers — 3s in a thread, 10s on the
inbox, 20s on the header badge — and they work. `GET /api/messages/unread` was
written to return 0001's `snapshot` payload verbatim so a stream could take its
place; the more useful thing to notice a year of nothing later is that nothing
has needed to.

**There is a database.** 0001 generated its migration offline with
`prisma migrate diff` because `.env` still held a stale SQLite URL. There is a
local Postgres now with all five migrations applied, so this is ordinary
`migrate dev` work and the schema can be exercised rather than reasoned about.

---

## Decision

Build 0001's notification layer — `Notification`, the emit points, the panel —
and deliver it by **widening the badge poll the header already runs**, not by
building the SSE stream.

`Block` is deferred again, knowingly, for the second record running. See below.

### The stream is not built, and this record says so plainly

0001's SSE design is sound and this does not claim otherwise. It is being turned
down on cost, which is the axis 0003 already identified:

> Cost is where they actually diverge. The stream holds a function invocation
> open per connected rider, billed by active time.

The latency argument that would justify that cost is weaker here than it was for
DMs, not stronger. 0001's stream is itself a server-side poll on a 2s tick, so
the honest comparison for a wave is 2 seconds against the badge's 20. **Nobody
needs to know within two seconds that someone waved at a post they made
yesterday.** A DM is a conversation with a person waiting at the other end; a
wave is a thing that happened. Paying per-rider held-open invocations to shave
18 seconds off the second one is the wrong trade at this app's scale, and the
first one is already served.

The seams 0003 built stay intact and unused. If activity ever needs to feel
live, the swap is still a change of source rather than a rewrite.

### One endpoint, one round trip, on the timer that already exists

`GET /api/messages/unread` becomes **`GET /api/unread`** and answers for
everything waiting, not just mail:

```
{ unread, conversations: [{ id, unreadCount }], activity }
```

The rename is honest bookkeeping — the route stopped being about messages — and
it costs one caller, since `MessagesLink` is the only thing that fetches it.

It stays the cheapest route in the app, which is the property that matters: it
runs on a timer in every open tab, so its cost is the one that multiplies. It
gains exactly one indexed count against `Notification`, in the same handler and
the same round trip. **Not a second timer.** Two polls at 20s cost twice what one
poll returning two numbers costs, and drift into disagreeing with each other
between ticks.

**The badge's two halves count differently, deliberately.** Conversations are
counted, not messages — forty messages from one rider is one conversation
waiting, and a badge reading "40" says something untrue about how much there is
to deal with. Activity is counted per row, because a wave and a comment are
genuinely two things. The asymmetry is already documented in the route and is
the reason the two are modelled differently at all. The wheel shows the sum.

### The notification insert rides the transaction, not `after()`

0001 put the emits inside `after()` from `next/server` so a wave's response time
was unchanged and a failed notification insert couldn't corrupt a successful
wave. That reasoning was load-bearing when the notification had a 2-second
budget to make. It doesn't survive the poll: the badge is 20 seconds away, so
the few milliseconds `after()` saves buy nothing a rider can perceive.

What it costs is atomicity. `after()` runs past the response, and an invocation
killed in between leaves a wave with no notification — invisible, with nobody
knowing to look for it, which is the exact argument the message POST already
makes for its own `$transaction`:

> a message that lands without moving the thread to the top of the recipient's
> inbox — or without counting as unread — is worse than one that doesn't land at
> all

So the wave and its notification go in one transaction, and so do the comment
and its notification. The repo still has no `after()` in it, and this is no
longer the change that introduces one.

### Waves are idempotent; wave *notifications* have to be idempotent separately

The two are not the same guard, and 0001's own verification asks for a property
its stated fix doesn't deliver.

`POST /api/posts/[id]/waves` currently upserts with `update: {}` (lines 63 and
69), which returns an existing row indistinguishably from a new one, so a naive
emit fires on every double tap. 0001's fix — `createMany({ skipDuplicates: true })`
and emit only when `count === 1` — is right and is adopted, in **both** identity
branches.

But `count === 1` is true again after an un-wave, because the DELETE removed the
row that was suppressing it. 0001's step 4 asks for "still 1 notification, not
3" across a wave / un-wave / re-wave cycle, and `skipDuplicates` alone gives 2.
The rule that actually delivers it lives in `notify.ts`, which 0001 already
describes as the home of "no duplicate on a repeat wave": **one wave
notification per (recipient, actor, post), ever** — a `findFirst` before the
insert, inside the same transaction.

Deliberately not a `@@unique`, because the same constraint must not apply to
comments: two comments on your post are two notifications, and collapsing them
is a different feature (grouping) that this record doesn't build.

The distinction the guard turns on is worth naming, because `count === 1` looks
like it should be enough and isn't: **the wave row is state, the notification is
an event.** Deleting the state doesn't delete the event, so the state can't be
the dedupe key across a delete. `count === 1` is kept anyway — it saves the
guard query on a repeat tap, and it closes the smaller wart that the route
currently can't tell whether it created a wave or found one — but the guard is
what delivers the property.

### Both ends of a notification are accounts

0001 has guest waves notifying with `actorId: null`, rendering as "Someone
waved". They don't. **A notification is only ever written when a signed-in rider
acts on a signed-in rider**, and that is a schema invariant here rather than a
convention the emit sites have to remember: `actorId` is required, `recipientId`
already was, and both are real foreign keys to `User`.

Anonymous waves themselves are untouched — `NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES`
still works, the guest's `Wave` row is still written, the tally still moves. It
just doesn't notify.

What that buys, beyond the smaller surface:

- **The griefing vector closes rather than being managed.** A signed-out visitor
  can toggle a wave as often as they like and there is no notification path to
  ride; the dedupe guard is then only ever protecting against a rider who is
  named and accountable.
- **"Someone waved" was a bad row anyway.** It names nobody, links nowhere, and
  is unactionable — the only thing a rider can do with it is wonder. A panel row
  the reader can't follow is a row that shouldn't be written.
- **No collapse question.** With `actorId` nullable, the guard has nothing to
  tell two guests apart by, so every guest would have deduped into one another —
  a rule that has to be explained. Required `actorId` deletes the question.

### `postId` and `commentId` get real foreign keys

0001's model carries them as bare `String?` with no relation. Nothing deletes a
post today — there is no `DELETE /api/posts/[id]` — so it costs nothing now and
leaves a notification pointing at a post that no longer exists the day there is
one, which renders as a row that says someone waved at nothing. `Post` and
`Comment` both cascade everywhere else they're referenced; these do too.

### The tell-tale is the wheel that's already there

`MessagesLink` becomes `RiderTelltale` and moves to `src/components/`. It is
mostly a widening, not a rewrite — the wheel, the lit stripe, the count in
`tabular-nums`, the `role="status"` announcement, the 20s tick and the
module-scope `lastSeen` cache all stay as built, and its own header comment
already anticipates this:

> When the notification layer lands, the wheel keeps its place and widens its
> source from unread DMs to everything waiting.

Two things change. The count it renders is the sum, and the wheel stops being a
`<Link>` to `/messages` and becomes a button that opens a panel — because
activity items have nowhere else to go. The panel's footer keeps the link.

`lastSeen` keeps its handle key and grows to hold both halves. It exists for the
login/signup remount, not for navigation, which the layout already fixed.

### `Block` is deferred, again

0001 argued it plainly and 0003 declined it knowingly. Nothing here answers the
argument either; the notification layer neither needs it nor forecloses it, and
adding it now would put a moderation surface in the middle of a record about
counting waves. It gets its own ADR and its own branch. 0001's warning that DMs
probably shouldn't ship publicly without it stands as written, for the third
record in a row, which is itself worth reading as a signal.

---

## Data model

0001's `Notification`, with the two foreign keys added and `Block` left out.
House conventions: `cuid()` ids, categorical fields as bare `String` with the
allowed values in a comment plus a type guard in `src/lib/`, no enums, every
`@@index` shaped like the one query that uses it.

```prisma
model Notification {
  id          String   @id @default(cuid())
  recipientId String
  // Required, both ends. A notification is a signed-in rider acting on a
  // signed-in rider; a guest wave writes its Wave row and notifies nobody.
  actorId     String
  // "wave" | "comment" — see NOTIFICATION_TYPES in src/lib/notifications.ts
  type        String
  postId      String?
  commentId   String?
  createdAt   DateTime @default(now())
  readAt      DateTime?

  recipient User     @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor     User     @relation("NotificationActor", fields: [actorId], references: [id], onDelete: Cascade)
  post      Post?    @relation(fields: [postId], references: [id], onDelete: Cascade)
  comment   Comment? @relation(fields: [commentId], references: [id], onDelete: Cascade)

  // The panel query and the cursor: my notifications, newest first.
  @@index([recipientId, createdAt])
  // The badge count, which runs in every open tab on a timer.
  @@index([recipientId, readAt])
}
```

`User` gains `notificationsReceived` and `notificationsActed`; `Post` and
`Comment` each gain `notifications Notification[]`.

Nothing about the actor is denormalized onto the row, so a handle change is
reflected on read — 0001's call, matching the preference `comms.ts` and `Message`
already follow over the older `Post.author` copy.

The migration sequences after `20260827214040_rider_inseam`, which is why this
branch is cut from the fit work rather than from `main`.

---

## New modules

| File | Tier | Holds |
| --- | --- | --- |
| `src/lib/notifications.ts` | pure | `NOTIFICATION_TYPES` (`as const`), `isNotificationType`, `NotificationDTO`, `notificationLine(n)` → the sentence the panel renders |
| `src/lib/notify.ts` | server | `emitWave`, `emitComment`, taking a transaction client and a **required** `actorId` — the guest case is refused by the signature rather than by a branch inside. Header comment says why this isn't inline in the routes: both call sites need the same suppression rules — no self-notify, no notify on an authorless post, no duplicate on a repeat wave — and duplicating them is how they drift |

No `stream.ts`. No `conversations.ts` equivalent: the panel's Prisma shapes are
small enough to live beside the two routes that use them, and a third file that
exports one `select` is a file to keep in sync for nothing.

---

## API routes

| Route | Methods | Notes |
| --- | --- | --- |
| `src/app/api/unread/route.ts` | `GET` | The widened badge poll. Moved from `api/messages/unread` |
| `src/app/api/notifications/route.ts` | `GET` | The panel page, newest first, `?before=` cursor |
| `src/app/api/notifications/read/route.ts` | `POST` | `{ ids?: string[] }` — omit `ids` to mark all read. Sets `readAt`, never unsets it, so a repeat call is harmless the way the DM read route's fixed `0` is |

### Emit points

- **`src/app/api/posts/[id]/comments/route.ts:75`** — the existence check selects
  `{ id: true }`. Widen to `{ id: true, userId: true }` or there's no recipient.
  Skip when `post.userId` is null (seeded and anonymous posts) or equals the
  commenter. The `create` at line 80 joins the notification insert in one
  transaction. Line 24's identical select is the GET's and is left alone.
- **`src/app/api/posts/[id]/waves/route.ts`** — the same widening in `resolve()`
  at line 40, the `createMany` swap at lines 63 and 69, and the repeat-wave
  guard above. The guest branch writes its `Wave` row and returns without
  emitting — there is no signed-in actor, so there is nothing to write.

---

## UI

**The panel.** Anchored dropdown under the wheel, merged newest-first: activity
rows ("@x waved at your post", "@y commented: …") and one row per conversation
with unread messages. Clicking a row marks it read and navigates. Footer link to
`/messages`. No `/notifications` page — the panel plus its cursor is the whole
surface, and a page would be a second empty state to write for a list that is
usually four rows long.

Two mechanical constraints, both still live and both moved since 0001 named them:

- The header is `sticky z-[1000]`, so the panel beats that or lives inside the
  header's stacking context.
- `Drivetrain.tsx:344` registers a `document` `pointerdown` to close itself. The
  panel needs the same outside-click discipline without the two fighting.
  Opening the panel closes the drivetrain.

**Motion.** Unchanged from 0001, and still unbuilt — [0004](./0004-wheel-icon-measured.md)
drew the icon, not its behaviour. A newly arrived notification indexes the wheel
by exactly one spoke pitch, 72°, ~220ms, then stops. A wheel that spins freely is
a wheel off the ground; one detent reads as something advancing. Under
`prefers-reduced-motion` there is no rotation and the stripe simply lights, per
the `wave-salute` precedent in `globals.css`.

With a 20-second tick the detent fires on a poll landing rather than on an event
arriving, which is a slower heartbeat than 0001 imagined but the same gesture.

**Empty states written properly.** A quiet wheel and an empty panel are the
*normal* state, not a fallback. `RoomDirectory.tsx:204-230` is the bar.

---

## Order of work

1. Schema + migration for `Notification`, sequenced after `rider_inseam`.
2. `lib/notifications.ts`, `lib/notify.ts`.
3. The emit points: two `select` widenings, the `createMany` swap, the
   repeat-wave guard, both transactions.
4. `api/messages/unread` → `api/unread`, widened; the layout's opening count
   widened to match.
5. `api/notifications`, `api/notifications/read`.
6. `MessagesLink` → `RiderTelltale`, the panel, read-on-click.
7. Motion, a11y pass, empty states, README note.

Steps 1–3 are shippable on their own: notifications accumulate and the badge
counts them before the panel exists to read them. That is a worse product than
the whole thing but not a broken one, and it's the natural review boundary.

---

## Verification

Static: `prisma validate`, `prisma generate`, `tsc --noEmit`, `eslint`,
`next build`. Plus a read-through of the generated `migration.sql` — `migrate
dev` output is exact, but nobody should ship DDL unread.

**Against the local Postgres**, two riders, `ada` and `bex`:

1. The migration applies to a database holding real rows; existing riders,
   posts and conversations survive.
2. `ada` waves `bex`'s post → one `Notification`, `bex`'s badge reads 1 within a
   tick. `ada` un-waves and re-waves → **still one notification, not two**. This
   is the assertion `skipDuplicates` alone fails, so it is the one that proves
   the `notify.ts` guard rather than the constraint.
3. `ada` comments → `bex` notified. Two comments → two notifications, not one:
   the guard must not have leaked from waves to comments.
4. `bex` comments on their own post → nothing. `bex` waves their own post →
   nothing.
5. Wave a seeded post with `userId: null` → no notification, no crash, and the
   wave itself still lands.
6. With `NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES=true`, wave signed out → the `Wave`
   row lands and the tally moves, and `Notification` is untouched. Toggle it ten
   times: still zero notifications, because there is no path rather than a
   guard holding one shut. The control is the same ten toggles signed in, which
   write exactly one.
7. `GET /api/unread` signed out is 401. Signed in it returns both halves, and
   the sum is what the wheel renders. The old `/api/messages/unread` path is
   gone, not left as a duplicate.
8. Mark one read, then mark all read; call both again and confirm the counts
   don't move. `readAt` is never unset.
9. The panel's `?before=` cursor pages without dropping or repeating a row.
   Malformed cursor → 400.
10. A notification pointing at a post deleted directly in the database is gone,
    not dangling — the cascade, checked rather than assumed.

**In a real browser**, both riders signed in, per the standard this repo now
holds itself to — probe scrolled, with a real cursor, and always with a control:

- The wheel lights and counts within one tick of a wave landing, without a
  reload, and the number is the sum of mail and activity rather than either one.
- The panel opens, closes on outside click and on Escape, and opening it closes
  the drivetrain rather than fighting it. It renders above the sticky header.
- Clicking a row marks it read, navigates, and the count comes back down —
  checked against the database, not just the badge.
- `prefers-reduced-motion` on → no rotation, stripe still lights. Keyboard-only
  → the panel opens, traps nothing, closes on Escape.
- The control for all of it: a rider with nothing waiting sees an unlit wheel, no
  count, and a panel that writes its own empty state.

---

## Consequences

**Accepted:**

- Riders find out about waves and comments without hunting for them, which is
  the half of 0001 that has been missing since it was written.
- It costs one extra indexed count on a timer that already runs. No new
  endpoint on a new interval, no held-open invocations, no new vendor, no new
  env vars.
- The wave route stops being silently non-idempotent about a thing it will now
  act on.
- 0001's data model lands, minus `Block`, so the record stops being a plan.

**Costs and risks:**

- **Up to 20 seconds late.** Accepted deliberately for activity, and it is worth
  being clear this is the one thing the stream would have bought.
- **Polling multiplies per tab**, not per rider. Four tabs is four times the
  count. Cheap each; it stays the interval to watch.
- **`Notification` grows without bound.** No retention, no archival, no
  grouping — a popular post writes a row per waver. Fine at this scale and the
  first thing to revisit; the `(recipientId, readAt)` index is what keeps the
  badge cheap while the table isn't.
- **No `Block`.** Third record. See above.
- **Grouping is not built**, so ten waves on one post is ten rows in the panel.
  0001 didn't specify it either. It becomes worth building at roughly the same
  volume the retention question does.
- **A read is a row write.** Opening the panel and clicking through marks rows
  read one navigation at a time. Cheap, but it is the first write path in the
  app that a rider triggers by reading rather than by acting.
