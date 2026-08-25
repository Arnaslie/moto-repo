# ADR 0001 — App-wide notifications, on top of direct messages

- **Status:** Accepted. The DM half is implemented — see
  [0003](./0003-direct-messages-polled.md), which ships it polled rather than
  streamed and without `Block`. The notification layer (steps 4–6) is not built,
  and this record remains the design for it.
- **Date:** 2026-08-24
- **Supersedes / superseded by:** —
- **Touches:** `prisma/schema.prisma`, `src/lib/`, `src/app/api/`, `src/components/SiteHeader.tsx`

---

## Context

The app has no way to tell a rider that anything happened. Someone waves at your
post, someone comments on it — you find out by scrolling back to the post. There
is no `Notification` model, no unread state anywhere, no inbox, and a repo-wide
grep for `notif|unread|mention|badge` returns zero hits.

Two sources should notify:

1. **DMs** — direct messages between two riders.
2. **Activity on your posts** — waves and comments.

DMs don't exist yet. There is no thread model, no message model, no inbox; Comms
(`/comms`) is group voice rooms, not 1:1 text. So most of the work below is
**building DMs**, and the notification layer is the smaller piece sitting on top
of them plus the two existing activity events.

Two constraints shape everything that follows.

**The working tree is dirty with the Comms feature.** `prisma/schema.prisma` and
`src/lib/drivetrain.ts` are modified, and `src/lib/comms.ts`, `src/lib/rooms.ts`,
`src/app/comms/`, `src/app/api/comms/`, `src/components/comms/` and
`prisma/migrations/20260817120000_comms_rooms/` are untracked. This work adds a
*second* uncommitted schema edit and a migration that must sequence after
`20260817120000_comms_rooms`. Comms lands first, or the migration history tangles.

**Serverless instances share no memory.** `RoomDirectory.tsx:40` already says it:
*"there's no socket to hold on serverless anyway."* That's right about sockets,
and Next 16 does support streaming route handlers on Vercel
(`node_modules/next/dist/docs/01-app/02-guides/streaming.md` names SSE
explicitly) — but one rider's write cannot reach another rider's open stream
through process memory. Any "push" design here is push to the browser and poll
behind the curtain. Stated plainly rather than implying a fanout that isn't there.

---

## Decision

Build 1:1 direct messages, then an in-app notification layer over DMs plus waves
and comments, delivered live over **Server-Sent Events**, surfaced as a
**motorcycle-wheel tell-tale** in the header control cluster.

**In-app only.** No web push, no email, no service worker, no new env vars. The
app has zero PWA scaffolding and sends no mail today, not even password resets;
both are separate decisions for a later ADR.

### Decisions worth stating, and why

**No Server Actions.** `DEPLOYMENT.md` states every mutation goes through an API
route, and grep confirms zero `"use server"` in the repo. That rules out Next
16's new `refresh()` and `updateTag()`, both Server-Action-only
(`docs/01-app/03-api-reference/04-functions/refresh.md`) — amusingly, the upgrade
guide's own worked example for `refresh()` is a notification badge. We keep the
route-handler convention and invalidate client-side.

**The wheel self-streams; no prop threading.** `SiteHeader` is mounted
individually by 7 call sites across 6 pages (`app/page.tsx:27`, `riders:18`,
`profile/[handle]:59`, `showroom/[id]:33`, `comms/page:27`, `comms/[id]:30` and
`:51`) — `layout.tsx` carries no chrome at all. Rather than thread an
`initialUnreadCount` prop through all seven, the tell-tale is a client component
that opens the stream itself and takes its opening count from the stream's first
`snapshot` event. Zero refactor, and it matches `RidersView.tsx:35-47`, which
self-fetches.

**Messages do not take a drivetrain gear.** Gears 3 and 4 are unbuilt
placeholders whose labels aren't confirmed, and the gearbox is fixed at six. The
inbox lives in the header cluster beside the wheel. Reversible: a gear is one
array in `src/lib/drivetrain.ts` plus an `href`.

**DM unread is a denormalized counter; activity unread is a row flag.** A
40-message burst should read as one unread conversation, not 40 notifications,
while a wave and a comment are genuinely separate items. They're modelled
differently and the badge sums two cheap counts. Denormalizing a counter follows
the existing `Post.author` precedent.

**Conversations are keyed by a canonical pair key.** `Conversation.pairKey` is
the two user ids sorted and joined, `@@unique` — so "open a DM with @x" is an
`upsert` that cannot race into two conversations. Same idempotency-via-unique-
constraint move as `Wave`'s `@@unique([postId, userId])`. A `Participant` join
table is kept anyway (rather than `aId`/`bId` columns) so per-side read state has
somewhere to live and group DMs stay possible later.

---

## Data model

Appended to `prisma/schema.prisma`, following house conventions: `cuid()` ids,
categorical fields as bare `String` with allowed values in a comment plus a type
guard in `src/lib/`, no enums, every `@@index` shaped like the one query that
uses it and justified in a comment.

```prisma
model Conversation {
  id            String   @id @default(cuid())
  // The two user ids sorted and joined with ":". Unique, so "start a DM with
  // @x" is an upsert that can't race into two conversations for one pair.
  // Nullable later if group DMs ever land; required while it's strictly 1:1.
  pairKey       String   @unique
  createdAt     DateTime @default(now())
  // Denormalized so the inbox sorts without touching Message.
  lastMessageAt DateTime @default(now())
  participants  Participant[]
  messages      Message[]
  @@index([lastMessageAt])
}

model Participant {
  id             String   @id @default(cuid())
  conversationId String
  userId         String
  lastReadAt     DateTime?
  // Bumped on the recipient's row when a message lands, zeroed when they open
  // the thread. Denormalized because the badge reads it on every stream tick.
  unreadCount    Int      @default(0)
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([conversationId, userId])
  // The inbox query: my conversations, newest first.
  @@index([userId])
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  senderId       String
  body           String
  createdAt      DateTime @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender         User         @relation(fields: [senderId], references: [id], onDelete: Cascade)
  // Thread render, and the stream's "since this cursor" tick.
  @@index([conversationId, createdAt])
}

model Notification {
  id          String   @id @default(cuid())
  recipientId String
  // Null when a guest waved — there's no account to name or link to.
  actorId     String?
  // "wave" | "comment" — see NOTIFICATION_TYPES in src/lib/notifications.ts
  type        String
  postId      String?
  commentId   String?
  createdAt   DateTime @default(now())
  readAt      DateTime?
  recipient   User  @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor       User? @relation("NotificationActor", fields: [actorId], references: [id], onDelete: SetNull)
  // The panel query and the stream cursor: my notifications, newest first.
  @@index([recipientId, createdAt])
}

model Block {
  id        String   @id @default(cuid())
  blockerId String
  blockedId String
  createdAt DateTime @default(now())
  blocker   User @relation("BlockBlocker", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked   User @relation("BlockBlocked", fields: [blockedId], references: [id], onDelete: Cascade)
  @@unique([blockerId, blockedId])
  @@index([blockedId])
}
```

`User` gains: `conversations Participant[]`, `messages Message[]`,
`notificationsReceived`, `notificationsActed`, `blocksMade`, `blocksReceived`.

**On `Block`:** DMs are open to any signed-in rider, which is a spam and
harassment surface the app has never had. `Block` is ~15 lines of schema and two
`findFirst` guards — cheaper to ship with DMs than after the first incident. It
can be cut to make v1 smaller, but then DMs probably shouldn't ship publicly.

**Migration.** The local `.env` still holds the pre-Postgres SQLite URL, so
nothing here can reach a database. The migration is generated offline:

```bash
npx prisma migrate diff \
  --from-schema-datamodel <schema-at-HEAD-plus-comms> \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_messages_notifications/migration.sql
```

---

## New modules

Following the repo's two-tier split — pure modules import nothing from
React/Next/Prisma so a future mobile client can share them; Prisma-touching
helpers sit beside them, exactly like `comms.ts` / `rooms.ts`.

| File | Tier | Holds |
| --- | --- | --- |
| `src/lib/messages.ts` | pure | `MAX_MESSAGE_LENGTH`, `pairKey(a, b)`, `parseMessageInput`, `parseStartConversationInput`, `MessageDTO` / `ConversationSummary` types |
| `src/lib/conversations.ts` | Prisma shapes | `conversationSelect`, `messageSelect`, `serializeConversation`, `serializeMessage`, `inboxQuery` |
| `src/lib/notifications.ts` | pure | `NOTIFICATION_TYPES` (`as const`), `isNotificationType`, `NotificationDTO`, `notificationLine(n)` → the sentence the panel renders |
| `src/lib/notify.ts` | server | `emitWave`, `emitComment`, `emitMessage`. The first write-performing module in `src/lib` — worth a header comment saying why it isn't inline in the routes: three call sites need the same suppression rules (no self-notify, no notify on an authorless post, no duplicate on a repeat wave), and duplicating them is how they drift. |
| `src/lib/stream.ts` | pure | SSE framing — `sseEvent(name, id, data)`, `HEARTBEAT`, `RETRY_MS`, `STREAM_TICK_MS` |

All parsers return the house discriminated union
`{ ok: true; value } | { ok: false; error: string }`, where `error` is a
user-facing sentence rendered verbatim — matching `auth.ts:18`,
`motorcycles.ts:46`, `comms.ts:60`.

---

## API routes

Each follows the observed convention: auth 401 first, body parse in try/catch →
400, pure parser → 400, existence 404 → ownership 403, single-key JSON response,
201 on create.

| Route | Methods | Notes |
| --- | --- | --- |
| `src/app/api/messages/conversations/route.ts` | `GET` inbox, `POST` start | POST takes `{ handle }`, resolves the user, checks `Block` both directions, `upsert` on `pairKey`, returns `{ conversation }` 201 (200 if it already existed) |
| `src/app/api/messages/conversations/[id]/route.ts` | `GET` | Thread + messages, participant-only (403 otherwise) |
| `src/app/api/messages/conversations/[id]/messages/route.ts` | `POST` | Create message; one `$transaction`: insert, bump `Conversation.lastMessageAt`, `increment` the *other* participant's `unreadCount` |
| `src/app/api/messages/conversations/[id]/read/route.ts` | `POST` | Zero `unreadCount`, set `lastReadAt`. `{ ok: true }` |
| `src/app/api/notifications/route.ts` | `GET` | Panel page, newest first, `?before=` cursor |
| `src/app/api/notifications/read/route.ts` | `POST` | `{ ids?: string[] }` — omit `ids` to mark all read |
| `src/app/api/stream/route.ts` | `GET` | The SSE stream, below |
| `src/app/api/blocks/route.ts` | `POST` / `DELETE` | Only if `Block` stays in scope |

### Emit points

Three existing writes gain a notification, all inside `after()` from
`next/server` so mutation response time is unchanged and a failed notification
insert can't corrupt a successful wave.

- **`src/app/api/posts/[id]/comments/route.ts:80`** — after the `comment.create`.
  Line 75 currently selects only `{ id: true }`; **widen to
  `{ id: true, userId: true }`** or there's no recipient to name. Skip when
  `post.userId` is null (anonymous post) or equals the commenter.
- **`src/app/api/posts/[id]/waves/route.ts:63,69`** — the current `upsert` with
  `update: {}` is silently idempotent and returns the existing row
  indistinguishably from a new one, so a naive emit duplicates on a double tap.
  Swap the signed-in branch to
  `prisma.wave.createMany({ data: [...], skipDuplicates: true })` and emit only
  when `count === 1`. The same `select` widening applies in `resolve()` at line
  38. Guest waves emit with `actorId: null` and render as "Someone waved".
- **The new message POST** — bumps `unreadCount` rather than writing a
  `Notification` row, per the decision above.

---

## The stream

`src/app/api/stream/route.ts`, `export const maxDuration = 60`.

```
GET /api/stream          (401 if signed out)
Content-Type: text/event-stream
Cache-Control: no-store, no-transform
X-Accel-Buffering: no        ← reverse proxies buffer SSE without this
```

On open: `retry: 3000`, a ≥1KB comment pad (Safari buffers a stream until 1024
bytes — `docs/01-app/02-guides/streaming.md:719`), then `event: snapshot`
carrying `{ unread, conversations: [{ id, unreadCount }] }`.

Then a tick every `STREAM_TICK_MS` (2s): query notifications and messages created
after the cursor, emit `event: notification` / `event: message`, each with an
`id:` line. Heartbeat comment every 15s. Close cleanly at ~50s so the browser
reconnects before Vercel kills the function; on reconnect the browser sends
`Last-Event-ID`, which the handler reads to resume the cursor. Clean up the
interval on `request.signal`'s `abort`.

### How the stream actually gets its data

**The server polls Postgres; the browser gets a push.** Serverless instances
share no memory, so a write in one invocation cannot reach a stream held open in
another. Rejected alternatives:

- **Postgres `LISTEN`/`NOTIFY`** — true push, but it needs a dedicated non-pooled
  connection (`DATABASE_URL_UNPOOLED`) and a raw `pg` client, since Prisma
  doesn't expose it and a transaction-mode pooler won't carry it. Worth
  investigating as a follow-up; Neon's support for it is unverified, so it isn't
  the plan.
- **An external bus** (Upstash / Ably / Pusher) — real fanout, but a new vendor,
  new env vars, and a second thing to run.

Consequence: latency is bounded by the tick, ~2s worst case, and each connected
rider holds a function invocation open. At this app's scale that's fine —
Vercel's Fluid compute shares one instance across many idle connections — but it
is the first thing to break under growth, and it's billed by active time. The
exits are the LISTEN/NOTIFY route, or falling back to the 10s `setInterval` poll
the rest of the app already uses.

### Client

A small context provider (`src/components/StreamProvider.tsx`) mounted inside
`SiteHeader`, so the tell-tale and the thread view share one `EventSource` per
tab. `EventSource` reconnects on its own; the provider exposes
`{ unread, conversationUnread, lastMessage }`. No visibility pause needed — the
browser handles a backgrounded tab — but the thread view filters `message` events
by its own `conversationId`.

---

## UI

**The tell-tale.** `src/components/RiderTelltale.tsx`, in the header's right-hand
control cluster (`SiteHeader.tsx:30-63`) between the `@handle` link and Log out,
rendered only when `user` is non-null.

The icon is a **motorcycle wheel** in `src/components/icons.tsx`, not a bell. It
follows `WaveIcon`'s precedent — `currentColor`, `aria-hidden`, a `size` prop,
and **outline when quiet, accent when something's waiting** rather than bolting
on a separate dot. The count sits beside it in `tabular-nums`, with a
`role="status" aria-live="polite"` announcement the way `WaveButton.tsx:102` does
for its tally.

### `WheelIcon` — geometry, derived from the reference

> **Revised by [0004](./0004-wheel-icon-measured.md).** The icon is built. The
> numbers below were read off the photo by eye; 0004 measured them, kept most,
> and departs on two — the blade roots stay open rather than merging into the
> star, and a blade sits at twelve rather than a window. The states and the
> rim-stripe idea are unchanged.

Reference: [`assets/0001-ninja-h2r.jpg`](./assets/0001-ninja-h2r.jpg), rear wheel
detail at [`assets/0001-h2r-rear-wheel.jpg`](./assets/0001-h2r-rear-wheel.jpg) —
a Kawasaki Ninja H2R press photo, kept as an internal design reference. It is
*not* shipped to users and nothing is traced from it; the numbers below are read
off it and the path is drawn from them.

What the reference actually is: a cast **five-spoke star wheel**. Five broad flat
blades run hub to rim, flaring where they meet the rim; between them sit five
large kite-shaped windows with rounded corners; the blade roots interlock around
the hub so the inner outline reads as a five-pointed star rather than five
separate arms. The only colour anywhere on it is a **thin green pinstripe on the
rim lip** — the Kawasaki signature.

| Quantity | Value | Derived or picked |
| --- | --- | --- |
| Spoke count | 5 | **Derived** — it's what the wheel has |
| Spoke pitch | 72° (360 / 5) | **Derived** from the count |
| Star rotation | offset so a *window*, not a spoke, sits at 12 o'clock | Picked — matches a wheel stopped at an arbitrary angle, and keeps it from reading as a three-pointed badge |
| Rim | two concentric circles (well + outer lip) | **Derived** — that lip is what carries the stripe |
| Hub | filled circle, ~0.22 × rim radius | Read off the photo |
| Windows | painted `var(--background)` | Convention — the drivetrain's sprocket windows do the same so they read as holes *through* the casting rather than shapes drawn on it (`globals.css:15-27`) |

**What's traded away:** the tyre isn't drawn. At icon size a slick's sidewall is
thicker than the rim it wraps and eats the whole box, and the wheel stops being
legible. So this is the wheel, not the wheel-and-tyre. Likewise the disc, the
bosses and the blade twist are all gone — they're detail at 340px that turns to
mush at 24px.

**Size:** render at 22–24px in the header cluster. The five windows are the first
thing to go; below ~20px it should fall back to the spoke silhouette without
them. Same kind of constraint `WaveIcon` documents at its own scale.

**States.** Quiet: outline in `currentColor`, inheriting the header's text ramp.
Unread: **the rim stripe lights** in `--drive-accent`. That's the whole idea —
the real wheel already carries a coloured line on the rim, so the accent comes
off the object rather than being a badge bolted onto it, the same way the
drivetrain's engaged gear is the part turning orange rather than a marker beside
it.

**Motion.** A newly arrived notification indexes the wheel by exactly one spoke
pitch — 72°, ~220ms, then it stops. A wheel that spins freely is a wheel off the
ground; one detent reads as something advancing. Under `prefers-reduced-motion`
there is no rotation and the stripe simply lights, per the `wave-salute`
precedent (`globals.css:99-103`).

Two mechanical notes on placement: the header is `sticky z-[1000]`, so the panel
must beat that or live inside the header's stacking context; and `Drivetrain`
registers a `document` `pointerdown` listener to close itself
(`Drivetrain.tsx:264-289`), so the panel needs the same outside-click discipline
without the two fighting. Opening the panel closes the drivetrain.

**Panel** — anchored dropdown, merged newest-first: activity items ("@x waved at
your post", "@y commented: …") and one row per conversation with unread messages.
Clicking marks read and navigates. Footer link to `/messages`.

**Pages**, all reusing the standard shell
`<main className="mx-auto min-h-screen w-full max-w-xl border-x border-black/10 dark:border-white/10">`
with `export const dynamic = "force-dynamic"`:

- `src/app/messages/page.tsx` — inbox. Server-renders the list and hands
  `initialConversations` to a client component that owns it thereafter, exactly
  like `Feed.tsx:19` and `RoomDirectory`.
- `src/app/messages/[id]/page.tsx` — thread. `redirect("/login")` when signed out
  (the `comms/[id]/page.tsx:19` precedent), `notFound()` for non-participants.
  The composer posts optimistically and adopts the server's message on response,
  per `WaveButton.tsx:54-72`. Fires the read POST on mount.
- Entry point: a **Message** button on `src/app/profile/[handle]/page.tsx`, shown
  to signed-in riders other than the profile's owner.

**Empty states are written properly**, not as fallbacks — an empty inbox and a
quiet wheel are the *normal* state, and `RoomDirectory.tsx:204-230` is the bar.
Styling uses the existing literals (orange accent, `border-black/10
dark:border-white/10` hairlines, `rounded-full` pills, the `text-black/70 → /40`
ramp); anything animated gets a commented block in `globals.css`, a `data-*`
attribute for state, and a `prefers-reduced-motion` branch.

---

## Order of work

0. **Land the Comms WIP** — commit `schema.prisma`, `drivetrain.ts`,
   `lib/comms.ts`, `lib/rooms.ts`, the comms routes/pages/components and the
   `20260817120000_comms_rooms` migration.
1. Schema + offline migration for all five models.
2. `lib/messages.ts`, `lib/conversations.ts` + the four message API routes.
3. DM UI: `/messages`, `/messages/[id]`, the profile Message button.
4. `lib/notifications.ts`, `lib/notify.ts`, the emit points (with the two
   `select` widenings and the wave `createMany` swap).
5. `lib/stream.ts` + `/api/stream` + the client provider.
6. `WheelIcon`, `RiderTelltale`, the panel, `SiteHeader` wiring.
7. Read-state routes, a11y pass, empty states, README + DEPLOYMENT notes.

Steps 1–7 are independently reviewable; 4 can ship before 3 if activity
notifications are wanted sooner than DMs.

---

## Verification

**Without a database** (the local `.env` is still the stale SQLite one, so this
is most of it):

```bash
npx prisma validate                 # schema parses
npx prisma generate                 # client types for the new models
npx tsc --noEmit                    # the whole app typechecks
npm run lint
npm run build                       # Turbopack is the default builder in 16
```

Plus a read-through of the generated `migration.sql` — `migrate diff` output is
exact, but nobody should ship DDL unread.

**With a real database** — `vercel env pull` or a fresh Neon branch, with
`DATABASE_URL_UNPOOLED` filled in, then `npm run db:migrate`:

1. Two accounts in two browsers (one normal, one private).
2. A DMs B from B's profile → B's wheel lights and counts 1 **without a reload**.
   B opens the thread → count clears, A sees nothing spurious.
3. B replies while A has the thread open → A's message appears within ~2s.
4. A waves B's post → B's wheel counts 1. A un-waves and re-waves → still 1
   notification, not 3 (the `createMany` idempotency).
5. A comments on B's post → B notified. B comments on their own post → no
   self-notification.
6. Wave a post with `userId: null` (a seeded post) → no notification, no crash.
7. With `NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES=true`, wave signed-out → B sees
   "Someone waved", no broken profile link.
8. `curl -N http://localhost:3000/api/stream` with a session cookie → watch the
   `snapshot`, the heartbeats, and a clean close at ~50s. Signed out → 401.
9. Leave a tab open past that close: the browser reconnects and does **not**
   replay already-seen events (`Last-Event-ID` resume).
10. If `Block` shipped: block A as B; A can't start a conversation or send into
    an existing one.
11. `prefers-reduced-motion` on → no wheel animation. Keyboard-only → the panel
    opens, traps nothing, closes on Escape.

The SSE path can't be meaningfully verified on `localhost` alone — dev has no
proxy buffering and no function timeout. **Deploy a preview and repeat steps 2, 3
and 9 against it** before calling this done.

---

## Consequences

**Accepted:**

- Riders find out about waves, comments and DMs without hunting for them, live,
  within ~2s.
- The app gains its first messaging primitive, its first unread state, and its
  first streaming endpoint.
- The header cluster gains a second instrument, in the dash vocabulary the
  drivetrain already established.

**Costs and risks:**

- **The stream is the expensive part.** One held-open function per connected
  rider, billed by active time. Fine at current scale; first thing to reconsider
  under growth.
- **~2s latency, not instant.** Inherent to poll-behind-SSE. If DMs need to feel
  instant, that reopens the LISTEN/NOTIFY or external-bus question.
- **DMs are a moderation surface** the app has never had. `Block` is the floor,
  not the ceiling — reporting and rate limiting are follow-ups.
- **Two uncommitted features stacking.** Step 0 exists for this reason.
- **`Notification` denormalizes nothing about the actor**, so a handle change is
  reflected on read — deliberate, matching the newer preference noted in
  `comms.ts:42-44` over the older `Post.author` denormalization.
- **Unrelated finding, worth a separate fix:** `POST /api/locations` is
  unauthenticated (`api/locations/route.ts:39-60`) and `rider` is free text with
  no FK to `User`. Found while mapping write sites; out of scope here.
