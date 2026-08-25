# moto-repo

Social media platform curated for motorcycle hobbyists and enthusiasts.

A [Next.js](https://nextjs.org) (App Router) app: a feed you post rides to, accounts
with customizable rider avatars, a garage of your real bikes with a 3D showroom, and a
live map of riders sharing their position. Backed by Postgres via
[Prisma](https://www.prisma.io/), with images in Vercel Blob (or on local disk in dev),
styled with Tailwind CSS.

## Features

- **Feed** — post text, an image, or both. Signed-out visitors can still post anonymously.
- **Waves** — this app's like, drawn as the two-finger salute riders give each other on the
  road: an outlined hand that fills orange and tips left-right when you wave. One wave per
  rider per post, enforced by a unique pair in the database, so a double tap can't inflate
  the count. Waving normally requires an account, but
  `NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES` temporarily opens it to signed-out visitors, who
  wave under a random id kept in a cookie. The tally is public either way.
- **Comment ticker** — comments run along the bottom of each post as an ESPN-style
  broadcast bottom line, crawling right-to-left. Click the strip to freeze it and expand
  the full thread with a reply box. Commenting requires an account.
- **Six-speed nav** — the page nav is a gearbox. At rest it's a 40px gear-position
  readout; hover, focus or tap drops the drivetrain down over the feed — cast sprockets
  with a chain running between them — and scrolling packs it back up. See
  [The drivetrain](#the-drivetrain) below.
- **Accounts** — email + handle signup, password hashing with `bcryptjs`, sessions in an
  encrypted cookie via `iron-session`.
- **Rider avatars** — layered SVG paper-doll drawn in code (no binary assets), customizable
  across four slots: background, jacket, helmet, visor. Your avatar shows up on every post.
- **Garage** — add your real bikes (year / make / model / nickname) to your profile.
- **Showroom** — each bike gets a three.js convention-floor page with a spinning platform.
  Route-split so the ~900 KB 3D bundle only loads on `/showroom`.
- **Rider map** — Leaflet map of riders currently sharing their location, with a toggle to
  go invisible.
- **Messages** — 1:1 direct messages between riders, started from the Message button on
  someone's profile. A thread is keyed by the two rider ids sorted and joined, unique in
  the database, so two people opening one on each other at the same moment land in the
  same conversation rather than two. Unread is a per-side counter on the thread, not a
  flag per message: forty messages from one rider is one conversation waiting for you, and
  that's what the header badge counts. Sending is optimistic; new messages arrive on a
  3-second poll (see [docs/adr/0003](./docs/adr/0003-direct-messages-polled.md) for why
  that isn't a socket, and what would replace it).
- **Image uploads** — straight from the browser to Vercel Blob in production, to a private
  local directory in dev (see [Uploads](#uploads) below).

## Getting started

The app targets Postgres everywhere — there's no SQLite fallback, so local dev needs a
connection string too: a free Neon/Supabase branch, a local `docker run postgres`, or
`vercel env pull` to borrow the deployed one.

```bash
npm install            # postinstall also generates the Prisma client
cp .env.example .env   # then fill in the two DB URLs and SESSION_SECRET
npm run db:migrate     # apply migrations
npm run db:seed        # gear catalog (idempotent) + sample posts
npm run dev            # http://localhost:3000
```

| Variable                             | Notes                                                        |
| ------------------------------------ | ------------------------------------------------------------ |
| `DATABASE_URL`                       | Postgres connection string. On Vercel use the **pooled** one — serverless opens a connection per invocation and the direct endpoint will exhaust the server's limit |
| `DATABASE_URL_UNPOOLED`              | The **direct** endpoint, dialed by migrations only. Still required locally — every `prisma migrate` command fails with `P1012` if it's unset. Against a plain local Postgres, set it to the same value as `DATABASE_URL` |
| `SESSION_SECRET`                     | Cookie encryption key, **must be ≥ 32 characters** or startup throws |
| `BLOB_READ_WRITE_TOKEN`              | Optional. Set (Vercel adds it once a Blob store is connected) and uploads go to Blob; unset and they go to disk. Read at runtime, so switching needs no rebuild |
| `NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES`  | Optional. `"true"` lets signed-out visitors wave; unset requires an account. Inlined at build time |

## Stack

- **Next.js 16** — React 19, App Router, server components, Turbopack
- **Prisma 6 + Postgres** — queries through the pooler, migrations through the direct
  endpoint (`directUrl` in the schema)
  (pinned to 6 — Prisma 7 dropped `url = env()` in the schema datasource)
- **Vercel Blob** — image storage in production, with a local-disk fallback
- **Tailwind CSS 4** — utility-first styling
- **iron-session + bcryptjs** — stateless encrypted-cookie auth; both are pure JS, so
  they work on serverless runtimes
- **three.js / @react-three/fiber / drei** — the bike showroom
- **Leaflet** — the rider map

## Project layout

```
src/
  app/
    page.tsx                     # feed (server component, reads from DB)
    login/ · signup/             # auth pages
    profile/[handle]/            # profile: avatar, customizer, garage, posts
    riders/                      # live rider map
    messages/ · messages/[id]/   # DM inbox and thread
    showroom/[id]/               # 3D bike showroom
    media/[file]/route.ts        # serves disk-backed uploads at request time
    api/
      posts/                     # GET (list) + POST (create)
      posts/[id]/comments/       # GET the thread, POST a comment
      posts/[id]/waves/          # POST to wave, DELETE to take it back
      uploads/                   # POST an image — the disk backend
      uploads/token/             # mints a Blob client-upload token
      auth/{signup,login,logout}/
      avatar/                    # POST: save skin + equipped gear
      motorcycles/ · [id]/       # POST add a bike, DELETE remove one
      locations/                 # GET riders sharing, POST your position
      messages/conversations/    # GET the inbox, POST to open a thread
        [id]/                    # GET the thread (?after= for the poll)
        [id]/messages/           # POST a message
        [id]/read/               # POST to clear your unread count
      messages/unread/           # GET what the header badge polls
  components/
    Feed.tsx · Composer.tsx · PostCard.tsx
    PostFooter.tsx                        # action row + ticker (shared state)
    WaveButton.tsx · icons.tsx            # the wave hand, optimistic toggle
    CommentTicker.tsx                     # scrolling comment strip + thread
    Drivetrain.tsx                        # the six-speed nav
    Avatar.tsx · AvatarCustomizer.tsx     # SVG paper-doll + slot picker
    Garage.tsx · showroom/                # bikes + three.js canvas
    RiderMap.tsx · RidersView.tsx         # Leaflet (dynamic import, no SSR)
    AuthForm.tsx · SiteHeader.tsx
    messages/                             # Inbox, Thread, the profile button,
                                          #   and the header's unread link
  lib/
    prisma.ts · session.ts · uploads.ts · thread.ts   # server-only
    auth.ts · comments.ts · conversations.ts · drivetrain.ts · format.ts
    gear.ts · locations.ts · messages.ts · motorcycles.ts · posts.ts
    types.ts · waves.ts
prisma/
  schema.prisma                  # Post, Wave, Comment, User, GearItem, UserGear,
                                 #   Motorcycle, Location, Room, Conversation,
                                 #   Participant, Message
  migrations/                    # the Postgres init, then one per feature
  gear-catalog.ts                # the catalog rows, shared by both seeds
  seed.ts                        # catalog + sample posts (local)
  seed-catalog.ts                # catalog only, run on deploy
```

Everything in `lib/` except `prisma.ts`, `session.ts` and `uploads.ts` deliberately
imports nothing from Next, React, or Prisma — so a future mobile client can share those
modules as-is. `drivetrain.ts` gets a second benefit from it: the nav's geometry is
computed on the server too, so its resting state ships in the HTML.

## Data model

| Model        | What it holds                                                          |
| ------------ | ---------------------------------------------------------------------- |
| `Post`       | Author, content, optional `imageUrl`, optional link to a `User`        |
| `Wave`       | A wave on a post — from a `User`, or a cookie `guestId` when anonymous |
| `Comment`    | A reply on a post — always tied to a real `User`                       |
| `User`       | Email, handle, password hash, bio, avatar skin tone                    |
| `GearItem`   | Cosmetic catalog entry — slot, name, brand, rarity, SVG asset key      |
| `UserGear`   | Who owns which gear item, and whether it's equipped                    |
| `Motorcycle` | A bike in someone's garage                                             |
| `Location`   | A rider's most recent shared position (one row per rider, upserted)    |
| `Conversation` | A 1:1 DM thread, keyed by a unique sorted pair of user ids           |
| `Participant`  | One side of a thread — holds that side's unread count and read mark  |
| `Message`      | A line in a thread, always tied to a real `User`                     |

`Post.author` is denormalized and `Post.userId` is nullable so seeded and anonymous posts
still render. `Message` goes the other way and joins its sender rather than copying the
handle onto every row, so a rider who changes handle isn't quoted under the old one — the
newer of the two preferences, and the one to follow in new models.

The eight SQLite migrations were replaced by a single Postgres init migration when storage
moved — nothing was lost, as they held only DDL. The move is one-way: Prisma binds a
schema to one provider.

## Uploads

Two backends, picked at runtime by whether `BLOB_READ_WRITE_TOKEN` is set:

- **Vercel Blob** — the browser uploads straight to Blob, having first fetched a token
  from `/api/uploads/token`, which authenticates the rider and pins the allowed types and
  size for Blob to enforce. Direct upload isn't a flourish: Vercel caps function request
  bodies at 4.5 MB and we allow 5 MB images, so routing bytes through `/api/uploads` would
  413 on large photos.
- **Local disk** — bytes go to a private `./uploads` directory and come back through the
  `/media/[file]` route handler, **not** `public/` (Next only static-serves what existed
  at build time). Keeps `npm run dev` zero-config.

`isValidUploadUrl()` in `src/lib/uploads.ts` is the gate both funnel into: it accepts a
`/media` path or an https URL on our own Blob store's host — derived from the token — so
an arbitrary remote URL can't be persisted on a post.

## The drivetrain

The nav's geometry is derived, not drawn. Pitch is the only number picked by eye; the
pitch radius falls out of it and the tooth count, which is what seats the rollers in the
valleys. Shifting runs the chain the real distance between two sprockets, and each
sprocket turns at the rate the chain feeds it — so with nothing engaged, the return run
goes slack.

Three of the six gears have no page yet and render as dashed blanks that grind instead of
navigating, which keeps the roadmap on screen. **Their labels are placeholders, not
decided.** Renaming one is a single array in `src/lib/drivetrain.ts`; shipping a page is
that plus an `href`. Signed out, the sixth gear stays whole but dimmed and sends you to
log in, the way the wave button does.

It's called Drivetrain because "gear" in this repo already means the riding kind.

## Gear, and what this product is not

Gear is **cosmetic only**. The plan is that owning real-world equipment unlocks the
matching avatar item through brand-issued redemption codes — the `UserGear.source` field
already anticipates this (`starter` today, `code` later). moto-repo is a social platform,
never a store; nothing here is or will be for sale.

## Handy scripts

| Command                   | Description                                             |
| ------------------------- | ------------------------------------------------------- |
| `npm run dev`             | Start the dev server                                    |
| `npm run build`           | Production build                                        |
| `npm run start`           | Serve the production build                              |
| `npm run lint`            | ESLint                                                  |
| `npm run db:migrate`      | Create/apply a migration (`prisma migrate dev`)          |
| `npm run db:seed`         | Seed the gear catalog and sample posts                  |
| `npm run db:seed:catalog` | Seed the gear catalog only — no demo posts              |
| `npm run db:studio`       | Open Prisma Studio to browse the DB                     |

`postinstall` regenerates the Prisma client, which Vercel's dependency cache would
otherwise skip. `vercel-build` runs `migrate deploy` and the catalog-only seed before the
build, so a fresh database has the schema and can accept signups.

## Deploying

See [DEPLOYMENT.md](./DEPLOYMENT.md). Short version: Vercel, with Postgres (Neon) for the
database and Blob for images — both swaps are done, so a deploy is now env vars plus a
push. A persistent host (Railway, Fly.io, a VPS) still works too, and can keep uploads on
disk.

## Next ideas

Pages for the three empty gears, deleting your own comments, tags/hashtags, feed
pagination, a list of who waved at a post, real `.glb` models in the showroom, and the
brand code redemption flow for gear.
