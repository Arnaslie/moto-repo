# ADR 0014 — Who owns a row: ending anonymous writes

- **Status:** Split. The wave half is **implemented** in `bd6a3b5`; the post half
  is **proposed** and not built. Recorded after the fact for the implemented
  half, which departs from this directory's write-it-first rule — that change
  shipped as a security fix and its reasoning lived only in a commit message.
- **Date:** 2026-09-16
- **Supersedes / superseded by:** retires the anonymous-waves provisions of
  [0001](./0001-app-wide-notifications.md) (step 38, guest waves emitting with
  `actorId: null`) and [0007](./0007-notifications-polled.md)'s section on the
  same; resolves the `waves.ts` example in
  [0009](./0009-monorepo-for-mobile.md) and the Preview note in
  [0010](./0010-domain-and-environments.md)
- **Touches (implemented):** `apps/web/prisma/schema.prisma`,
  `apps/web/prisma/migrations/20260916120000_waves_require_an_account/`,
  `apps/web/src/app/api/posts/[id]/waves/route.ts`, `apps/web/src/lib/posts.ts`,
  `apps/web/src/lib/session.ts`, `apps/web/src/lib/waves.ts` (deleted),
  `apps/web/src/components/WaveButton.tsx`
- **Touches (proposed):** `apps/web/src/app/api/posts/route.ts`,
  `apps/web/src/components/Composer.tsx`, `apps/web/prisma/seed.ts`, a migration

---

## Context

Three things can be written to another rider's feed — a post, a comment, a wave
— and until today each answered "who did this?" differently. Comments have
always required an account (`Comment.userId` is `NOT NULL`, and the route 401s a
signed-out caller). Waves accepted a cookie. Posts accept nothing at all.

`bd6a3b5` closed the wave half. What follows records why, and then why the post
half is the same question and should not be answered separately.

### The wave half, as shipped

The toggle announced its own expiry — `waves.ts` opened with the word
`TEMPORARY`, and the paragraph under it described a flaw rather than a feature:

> A signed-out visitor is identified only by a random id in the cookie below,
> so clearing cookies makes them a new stranger: the tally is a floor, not a
> headcount.

A floor and no ceiling: the identity was a `moto_guest` cookie the client
controls, a wave cost one cookie clear, and no rate limiting exists on that
route. The counts sit on real riders' posts, which is what made an inflated one
worth caring about.

It was also the most expensive thing in the schema for its size. `Wave` carried
two nullable owner columns and two unique indexes, and the arrangement worked
only by leaning on a Postgres subtlety the model comment had to explain — that a
unique index treats NULLs as distinct, which is what let many signed-in rows
share `guestId = NULL`. That subtlety propagated outward into `postInclude()`, a
three-way `viewerWaveFilter()`, three guest-cookie helpers in `session.ts`, and a
`mint` flag on the wave route's `resolve()`. One optional feature, five files of
conditional.

### The post half, still open

`Post.userId` is now the **only** nullable owner relation left in the schema:

```prisma
// Nullable, with `author` denormalized alongside it, so legacy/seeded and
// anonymous posts still render.
userId String?
user   User?   @relation(fields: [userId], references: [id])
```

That comment names two different reasons wearing one column, and they have
different lifespans. Seeded rows are a fixture problem. Anonymous posting is a
product decision — and unlike guest waves, it is still reachable: `Composer`
renders a free-text `"Your handle (optional)"` input to signed-out visitors, and
`POST /api/posts` accepts it.

Three specifics make it the same problem as the wave, not a milder one:

**The author string is unguarded.** For a signed-out poster the displayed name is
whatever the client sent, trimmed and cut to `MAX_AUTHOR_LENGTH` (40), falling
back to `"anonymous_rider"`:

```ts
const resolvedAuthor = currentUser
  ? currentUser.handle
  : typeof author === "string" && author.trim()
    ? author.trim().slice(0, MAX_AUTHOR_LENGTH)
    : "anonymous_rider";
```

Nothing compares it against `User.handle`. A signed-out visitor can post as
`ada`. The only tell is a missing avatar, because `authorAvatar()` returns null
without a user — a difference a reader has no reason to read as identity.

**The auth gate is already half-drawn.** The same handler 401s a signed-out
caller that attaches an image, on the reasoning that "a post is free to point
`imageUrl` at anything." Text got no equivalent guard, so the route already
holds that signed-out writes are worth restricting — it just stopped at the
cheap half.

**An anonymous post is a dead end anyway.** `Notification` requires an account
at both ends, enforced in the schema. A post with `userId = NULL` can never
notify anyone, so waves and comments on it are silently unreachable to whoever
wrote it. The feature gives a rider a post they cannot be told about.

## Decision

**Every row that appears in someone's feed belongs to an account.** Waves and
comments already satisfy this; posts should.

### The rule belongs in the database, not the handler

This is the part `bd6a3b5` got right and the part worth repeating. "A wave
belongs to an account" was a branch in a route handler, which holds only as long
as every future call site remembers to write it. As `NOT NULL` it holds against
the seed script, a migration, a `prisma studio` session, and handlers not yet
written. Reintroducing guest waves now costs a migration — the correct price for
that decision, rather than an environment variable.

The same migration shape applies to posts, and the wave one is the template:

```sql
DELETE FROM "Wave" WHERE "userId" IS NULL;
DROP INDEX "Wave_postId_guestId_key";
ALTER TABLE "Wave" DROP COLUMN "guestId";
ALTER TABLE "Wave" ALTER COLUMN "userId" SET NOT NULL;
```

The `DELETE` was a no-op in production and was written anyway; a migration
correct only on the database it was tested against is not a migration.

### Posts cannot copy that migration verbatim

Waves were disposable — an unowned wave is a number, and deleting it costs a
count. An unowned **post** is content, and the repo has ten of them locally with
**four** carrying `userId = NULL`. All four are seed rows: `seed.ts` spreads
`samplePosts[i]` with no `userId`, so `trailblazer_tom` and friends exist only as
strings.

So the post migration is a different shape, and this is the open question rather
than a settled one:

1. Give the seeded authors real `User` rows and backfill `Post.userId`, so the
   demo feed keeps working and the column can go `NOT NULL`.
2. Drop the `Composer` handle input and 401 signed-out posts, matching comments.
3. Keep `Post.author` denormalized regardless — it is what lets a handle change
   leave old posts alone, which is a separate concern from ownership.

Option 1 is the load-bearing one: without it `npm run db:seed` fails against a
`NOT NULL` column, and a broken seed is how a fresh clone stops being testable.

### What deliberately does not change

Idempotency is untouched: waves insert with `createMany` + `skipDuplicates`,
**not** an `upsert`, and the comment saying so stays. Notifications still survive
an un-wave, which is what keeps an un-wave/re-wave cycle silent. This record
narrows *who may write*; it does not touch what happens when they do.

## Consequences

`NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES` is gone from code, `.env.example` and
`DEPLOYMENT.md`. It survives only in the prose of 0001, 0007, 0009 and 0010,
which are records of a period when it existed and are left alone on the terms
this directory's README sets out.

0009 is worth naming, because its example now has no file behind it. It cites
`waves.ts` as a module kept out of `packages/core` because a `NEXT_PUBLIC_`
variable is "a web deployment concept with no mobile equivalent." The reasoning
still holds; the specimen is gone. This record is the cross-reference that says
so, rather than an edit to 0009.

A side effect is that the app now has **no** `NEXT_PUBLIC_` variable at all.
`Feed.tsx` already passes `blobUploads` down from the server specifically to
avoid freezing a value into the build, so the pattern 0009 warned about has no
instances left — a future one should read as a deliberate choice to
build-time-freeze something, not a default.

Signed-out riders still see wave tallies; the button becomes a link to `/login`.
That was already production behaviour, so nothing visible changed for anyone not
running the flag locally.

Until the post half lands, the inconsistency is explicit and known: waving at a
post requires an account, writing one does not.
