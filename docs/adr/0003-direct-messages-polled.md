# ADR 0003 — Direct messages, polled

- **Status:** Implemented
- **Date:** 2026-08-24
- **Supersedes / superseded by:** partially implements [0001](./0001-app-wide-notifications.md)
- **Touches:** `prisma/schema.prisma`, `prisma/migrations/20260824120000_direct_messages/`,
  `src/lib/{messages,conversations,thread}.ts`, `src/app/api/messages/`,
  `src/app/messages/`, `src/components/messages/`, `SiteHeader.tsx`,
  `profile/[handle]/page.tsx`

---

## Context

[ADR 0001](./0001-app-wide-notifications.md) specified two things in one record:
direct messages, and a notification layer sitting on top of them delivered over
Server-Sent Events and surfaced as a motorcycle-wheel tell-tale in the header.
Its own order of work separates them — steps 1–3 are DMs, steps 4–6 are
notifications — and notes that they're independently reviewable.

DMs were built. The notification layer was not. That leaves 0001 accurate as a
plan and inaccurate as a description of the repo, which is what this record is
for: 0001 still stands as the design for notifications, and nothing below
changes it.

Two of its decisions were **not** followed. Both were deliberate, both are
reversible, and neither is an improvement on 0001's reasoning — they're
narrower scope, which is a different thing.

---

## Decision

Ship the DM half of 0001 — schema, API, inbox, thread, profile entry point —
with **polling instead of SSE**, and **without `Block`**.

### Live delivery is a poll, not a stream

0001's stream is a real design and the reasoning behind it holds. It just isn't
built yet, and DMs that can't show you a reply until you reload aren't DMs. So
the thread polls `GET /api/messages/conversations/[id]?after=<cursor>` every 3
seconds, the inbox polls every 10, and the header's unread badge every 20.

This is *slower and cheaper* than 0001's design, not a rejection of it. Worth
being precise about the tradeoff, because "poll vs stream" understates it:

- **Latency** is ~3s in the thread against 0001's ~2s. Barely different, because
  0001's stream is itself a server-side poll — the browser gets a push, Postgres
  gets asked on a timer.
- **Cost** is where they actually diverge. The stream holds a function
  invocation open per connected rider, billed by active time; 0001 names this
  "the first thing to break under growth". A poll holds nothing open and costs
  one short query per tick.
- **What's lost** is the tell-tale: no wheel, no panel, no wave and comment
  notifications. The header carries a plain Messages link with a count, which is
  a link with a number on it, not an instrument.

Three seams exist so the swap is a change of source rather than a rewrite:

1. `GET /api/messages/unread` returns exactly 0001's `snapshot` payload —
   `{ unread, conversations: [{ id, unreadCount }] }`, same field names.
2. `mergeMessages` in `Thread.tsx` is idempotent by message id, so a stream that
   re-delivers is as safe as a poll that re-reads.
3. The thread's cursor is a timestamp, which is what a `Last-Event-ID` resume
   would carry.

The cursor is **inclusive** (`gte`, not `gt`): `TIMESTAMP(3)` is
millisecond-precision, two messages can share one, and an exclusive cursor would
drop the second one permanently. The cost is re-sending one already-seen message
per tick, which the merge discards. Losing a message is unacceptable; sending
one twice is free.

### `Block` is cut

0001 argues for it plainly: DMs are the app's first private channel and its
first harassment surface, `Block` is ~15 lines of schema and two guards, and
"cheaper to ship with DMs than after the first incident." That argument is not
answered here — it's deferred, knowingly. Cutting it was an explicit call, and
0001's warning that DMs probably shouldn't ship publicly without it stands as
written. Adding it later is a purely additive migration and two `findFirst`
guards in the two write paths; nothing built here forecloses it.

### Smaller decisions worth stating

**A thread you aren't in answers 404, not 403.** Everywhere else in the app a
403 is safe — you already know the Comms room exists, you just don't host it.
Here the id *is* the private thing, and a 403 confirms a given conversation
exists to anyone walking ids. Not yours reads as not there. (`src/lib/thread.ts`)

**Sending marks your own side read.** You were looking at the thread when you
typed it. Without this, replying to something you hadn't opened leaves your
inbox showing unread mail you've already answered.

**No `author` denormalization on `Message`.** `Post` and `Comment` both copy the
handle onto the row; `Message` joins it. A handle change should not leave a
rider quoted under a name they no longer use, and a thread has two people in it
so the join is free. This follows the preference already noted in `Room`.

**There's no compose screen.** A DM starts from a *rider* — the Message button
on a profile — not from a box asking who you'd like to write to. The empty inbox
points at `/riders` rather than offering a handle field.

**Messages still take no drivetrain gear**, per 0001. The link lives in the
header cluster where the tell-tale will go.

---

## Consequences

**Accepted:**

- The app has its first private channel, its first unread state, and its first
  optimistic-send composer.
- Delivery costs one small query per tick per open tab and holds nothing open.
- The three seams above mean the SSE work in 0001 is additive.

**Costs and risks:**

- **No `Block`.** The one thing 0001 said to ship with DMs. See above.
- **No notifications for waves and comments.** 0001 steps 4–6 remain unbuilt, so
  the only thing that can notify you is a DM, and only via a number in the
  header.
- **Polling multiplies per tab, not per rider.** Four open tabs is four times the
  unread queries. Cheap each, but it's the interval to watch.
- **`unreadCount` is denormalized**, so it can in principle drift from the
  messages actually in the thread. Every write to it is in the same transaction
  as the message, and the read route sets it to a fixed 0 rather than
  decrementing, which is what keeps repeat calls harmless.

---

## Verification

Static checks, all passing: `prisma validate`, `prisma generate`, `tsc --noEmit`,
`eslint`, `next build`.

**Against a real database.** The original version of this record said none of the
Postgres paths had ever been run, because there was no local database and no
Docker to start one. There is now: `brew install postgresql@17`, the four lines
in the README, `prisma migrate deploy`, `db:seed`. Everything below was then
exercised against it with two live sessions (34 API assertions, 18 page
assertions, all green):

- All three migrations apply cleanly to an empty database, and the Comms partial
  unique index survives the DM migration — checked in `pg_indexes`, not assumed.
- Opening a thread returns 201; opening it again returns 200 **and the same id**;
  opening it from the *other* side returns that same id too. Messaging yourself
  is a 400, an unknown handle a 404, signed out a 401.
- **The race actually races.** Twelve concurrent opens — six from each side of a
  fresh pair, fired in parallel — return exactly one conversation id, and the
  database holds one `Conversation` with two `Participant` rows for that pair.
  This is the path the pre-check *cannot* cover, and it's the reason the
  `pairKey` sort and the P2002 catch both exist.
- Unread behaves as designed: the recipient shows 1 waiting, the sender shows 0
  (sending marks your own side read), and the count clears on read and stays
  cleared. Verified in the API and again directly in `Participant`.
- The inclusive cursor returns the sender's own last message *plus* the reply —
  two rows where an exclusive cursor would have returned one. That redundancy is
  the design, and `mergeMessages` is what absorbs it.
- Not-a-participant is a **404 on every one of the three thread routes** and on
  the page, never a 403, so an outsider can't tell a real thread id from a
  fictional one. Their inbox stays empty.
- Pages render server-side with real content: the inbox carries the other
  rider's handle and the last line said, the thread carries both messages, the
  empty inbox writes its own state. `/messages` signed out redirects to
  `/login?next=%2Fmessages`. The Message button appears on someone else's
  profile and on neither your own nor a signed-out view.
- Rejections: empty body 400, 2001 characters 400, malformed `?after=` 400.

**Still unverified:** the browser-side behaviour — that the 3-second poll visibly
lands a reply in an open thread, that the optimistic line appears and is adopted,
that the header badge ticks over on its 20-second timer, and the
`prefers-reduced-motion` and keyboard passes. All of it is now reachable by
opening two browsers at `localhost:3000` and logging in as `ada` and `bex`.

## What's left

0001 steps 4–7, unchanged: `lib/notifications.ts`, `lib/notify.ts`, the emit
points (including the wave `createMany` swap and the two `select` widenings),
`lib/stream.ts`, `/api/stream`, the client provider, `WheelIcon`, the tell-tale
and its panel. Plus `Block`, from 0001's data model section.
