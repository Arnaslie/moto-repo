# moto-repo

Social media platform curated for motorcycle hobbyists and enthusiasts.

A [Next.js](https://nextjs.org) (App Router) app: a feed you post rides to, accounts
with customizable rider avatars, a garage of your real bikes with a 3D showroom, and a
live map of riders sharing their position. Backed by SQLite via
[Prisma](https://www.prisma.io/), styled with Tailwind CSS.

## Features

- **Feed** — post text, an image, or both. Signed-out visitors can still post anonymously.
- **Waves** — this app's like, drawn as the two-finger salute riders give each other on the
  road: an outlined hand that fills orange and tips left-right when you wave. One wave per
  rider per post, enforced by a unique pair in the database, so a double tap can't inflate
  the count. Waving requires an account; the tally is public.
- **Comment ticker** — comments run along the bottom of each post as an ESPN-style
  broadcast bottom line, crawling right-to-left. Click the strip to freeze it and expand
  the full thread with a reply box. Commenting requires an account.
- **Accounts** — email + handle signup, password hashing with `bcryptjs`, sessions in an
  encrypted cookie via `iron-session`.
- **Rider avatars** — layered SVG paper-doll drawn in code (no binary assets), customizable
  across four slots: background, jacket, helmet, visor. Your avatar shows up on every post.
- **Garage** — add your real bikes (year / make / model / nickname) to your profile.
- **Showroom** — each bike gets a three.js convention-floor page with a spinning platform.
  Route-split so the ~900 KB 3D bundle only loads on `/showroom`.
- **Rider map** — Leaflet map of riders currently sharing their location, with a toggle to
  go invisible.
- **Image uploads** — stored outside `public/` and served through a route handler, so
  runtime uploads work in production (see [Uploads](#uploads) below).

## Getting started

```bash
npm install
cp .env.example .env   # required — the app won't boot without SESSION_SECRET
npm run db:migrate     # apply migrations and generate the Prisma client
npm run db:seed        # gear catalog (idempotent) + sample posts
npm run dev            # http://localhost:3000
```

`.env` needs two values, both documented in `.env.example`:

| Variable         | Notes                                                        |
| ---------------- | ------------------------------------------------------------ |
| `DATABASE_URL`   | SQLite file path, relative to `prisma/`                      |
| `SESSION_SECRET` | Cookie encryption key, **must be ≥ 32 characters** or startup throws |

## Stack

- **Next.js 16** — React 19, App Router, server components, Turbopack
- **Prisma 6 + SQLite** — a local `prisma/dev.db` file, no external services
  (pinned to 6 — Prisma 7 dropped `url = env()` in the schema datasource)
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
    showroom/[id]/               # 3D bike showroom
    media/[file]/route.ts        # serves user uploads at request time
    api/
      posts/                     # GET (list) + POST (create)
      posts/[id]/comments/       # GET the thread, POST a comment
      posts/[id]/waves/          # POST to wave, DELETE to take it back
      uploads/                   # POST an image, returns its /media URL
      auth/{signup,login,logout}/
      avatar/                    # POST: save skin + equipped gear
      motorcycles/ · [id]/       # POST add a bike, DELETE remove one
      locations/                 # GET riders sharing, POST your position
  components/
    Feed.tsx · Composer.tsx · PostCard.tsx
    PostFooter.tsx                        # action row + ticker (shared state)
    WaveButton.tsx · icons.tsx            # the wave hand, optimistic toggle
    CommentTicker.tsx                     # scrolling comment strip + thread
    Avatar.tsx · AvatarCustomizer.tsx     # SVG paper-doll + slot picker
    Garage.tsx · showroom/                # bikes + three.js canvas
    RiderMap.tsx · RidersView.tsx         # Leaflet (dynamic import, no SSR)
    AuthForm.tsx · SiteHeader.tsx
  lib/
    prisma.ts · session.ts · uploads.ts   # server-only
    auth.ts · gear.ts · motorcycles.ts · locations.ts · format.ts
    posts.ts · types.ts
prisma/
  schema.prisma                  # Post, Comment, User, GearItem, UserGear,
                                 #   Motorcycle, Location
  seed.ts                        # gear catalog + sample posts
```

Modules in `lib/` that hold validation rules and shared shapes (`auth.ts`, `gear.ts`,
`motorcycles.ts`, `locations.ts`, `format.ts`) deliberately import nothing from Next,
React, or Prisma — so a future mobile client can share them as-is.

## Data model

| Model        | What it holds                                                          |
| ------------ | ---------------------------------------------------------------------- |
| `Post`       | Author, content, optional `imageUrl`, optional link to a `User`        |
| `Comment`    | A reply on a post — always tied to a real `User`                       |
| `User`       | Email, handle, password hash, bio, avatar skin tone                    |
| `GearItem`   | Cosmetic catalog entry — slot, name, brand, rarity, SVG asset key      |
| `UserGear`   | Who owns which gear item, and whether it's equipped                    |
| `Motorcycle` | A bike in someone's garage                                             |
| `Location`   | A rider's most recent shared position (one row per rider, upserted)    |

`Post.author` is denormalized and `Post.userId` is nullable so seeded and anonymous posts
still render.

## Uploads

Images are written to a private `./uploads` directory and served by the
`/media/[file]` route handler — **not** from `public/`. Next only static-serves files in
`public/` that existed at build time, so runtime uploads there 404 under `next start`.
`src/lib/uploads.ts` is the single swap point for moving to S3 or Vercel Blob later.

## Gear, and what this product is not

Gear is **cosmetic only**. The plan is that owning real-world equipment unlocks the
matching avatar item through brand-issued redemption codes — the `UserGear.source` field
already anticipates this (`starter` today, `code` later). moto-repo is a social platform,
never a store; nothing here is or will be for sale.

## Handy scripts

| Command              | Description                                     |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Start the dev server                            |
| `npm run build`      | Production build                                |
| `npm run start`      | Serve the production build                      |
| `npm run lint`       | ESLint                                          |
| `npm run db:migrate` | Create/apply a migration (`prisma migrate dev`) |
| `npm run db:seed`    | Seed the gear catalog and sample posts          |
| `npm run db:studio`  | Open Prisma Studio to browse the DB             |

## Deploying

See [DEPLOYMENT.md](./DEPLOYMENT.md). Short version: Vercel works, but SQLite and the
local `./uploads` directory don't survive an ephemeral serverless filesystem — you'd swap
in Postgres and an object store first. A persistent host (Railway, Fly.io, a VPS) can run
the app as-is.

## Next ideas

Deleting your own comments, tags/hashtags, feed pagination, a list of who waved at a post,
real `.glb` models in the showroom, and the brand code redemption flow for gear.
