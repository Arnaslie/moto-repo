# Deployment options

Notes on shipping **moto-repo** to production. The app is Next.js 16 (App
Router) with Prisma 6 + Postgres, `iron-session` auth, and a route-split
three.js showroom.

_Updated 2026-08-14: the app is now committed to **Vercel (Option A)**. Both
storage swaps are done — Postgres and Vercel Blob — so this file is now mostly
a record of what was changed and why, rather than a menu._

## TL;DR

Both storage choices that used to pin this app to a single machine have been
swapped out:

| Concern | Was | Now |
| --- | --- | --- |
| Database | SQLite file (`prisma/dev.db`) | Postgres, everywhere including local dev |
| Image uploads | `./uploads/` on disk, served by `/media/[file]` | Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, disk otherwise |

Note the asymmetry: **uploads still fall back to disk locally, the database no
longer falls back to SQLite.** Prisma can't target two providers from one
schema, so going to Postgres means going there in dev too — you need a
connection string before `npm run dev` can serve a page that touches data.

Nothing is in git — `.gitignore` drops `prisma/*.db` and the contents of
`/uploads/` — so a fresh deploy starts with an empty database and no images.
Run `prisma migrate deploy` on release; seed with `npm run db:seed` if you want
the demo riders.

> Note: uploads are **not** static-served from `public/` — Next only reliably
> serves `public/` files that existed at build time, so runtime uploads 404'd.
> They live in a private `./uploads/` dir and are streamed by a route handler
> (`src/app/media/[file]/route.ts`). That read path works locally and on a
> persistent host, but on serverless the write side still needs object storage
> (the FS is ephemeral) — see Option A.

---

## Already deploy-ready (no changes needed)

- **Auth** — `iron-session` is a stateless encrypted cookie; **`bcryptjs`** is
  pure JS (no native binary). Both work on serverless.
- **3D showroom** — client-only and route-split; the three.js chunk (904 KB in
  the current build) loads only on `/showroom/[id]`, never on the feed.
- **App code / routing** — standard App Router; nothing platform-specific.
- **No Server Actions** — every mutation goes through an API route under
  `src/app/api/`. That sidesteps the multi-instance
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` / version-skew setup Next's self-hosting
  guide requires of apps that use them.
- **No page cache to coordinate** — every page is `dynamic = "force-dynamic"`,
  and the build marks every route except `/_not-found` server-rendered-on-demand,
  so there's no ISR cache handler to configure when running more than one
  instance.
- **No `next/image`** — uploads are served raw by `/media/[file]` with a
  one-year `immutable` `Cache-Control`, so there's no image optimizer (and no
  `sharp` / glibc tuning) in the way when self-hosting.

### Env vars referenced in code

| Var | Where | When it's read |
| --- | --- | --- |
| `DATABASE_URL` | `prisma/schema.prisma` | runtime |
| `DATABASE_URL_UNPOOLED` | `prisma/schema.prisma` (`directUrl`) | `prisma migrate` / `validate` |
| `SESSION_SECRET` | `src/lib/session.ts` | runtime |
| `BLOB_READ_WRITE_TOKEN` | `src/lib/uploads.ts` | runtime (unset = disk) |
| `BLOB_STORE_ID` | `src/lib/uploads.ts` | runtime (optional override) |
| `NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES` | `src/lib/waves.ts` | **build** |
| `NODE_ENV` | `src/lib/prisma.ts`, `src/lib/session.ts` | set automatically |

`DATABASE_URL_UNPOOLED` is not optional. Prisma resolves every `env()` in the
datasource before it does anything else, so a missing value fails every
`prisma migrate` command — and `prisma validate` — outright with `P1012`,
before the CLI so much as opens a connection. (`prisma generate` is the one
that shrugs it off, which is why a broken setup can stay hidden until the first
migration.) Neon's
integration injects it alongside `DATABASE_URL`; against a plain Postgres with
no pooler in front, set it to the same string. `BLOB_STORE_ID` only exists to
override the store id that `src/lib/uploads.ts` otherwise parses out of the
read-write token — leave it unset unless the two ever diverge.

The waves flag is the one to watch: `NEXT_PUBLIC_` means Next inlines it into
the client bundle during `next build`, so it has to be set in the host's
**build** environment. Setting it only as a runtime var leaves the button
hidden, and flipping it later does nothing until you rebuild. `NODE_ENV` is
worth a glance too — it's what puts `secure` on the session cookie, so the app
must be built and started in production mode behind HTTPS.

---

## Option A — Vercel + Postgres + Blob (recommended, production-grade)

Best Next.js DX and edge network. Requires the two storage swaps. ~Half a day.

### 1. Database: SQLite → Postgres ✅ done

- `prisma/schema.prisma` now declares `provider = "postgresql"`.
- The 8 SQLite migrations were replaced by a single Postgres init migration,
  `prisma/migrations/20260814120000_init/`, and `migration_lock.toml` was
  switched to `postgresql`. Nothing was lost: the old migrations contained no
  data changes, only DDL (their `INSERT`s were SQLite's rebuild-the-table
  dance for `ALTER`).
- It was generated **offline** with `prisma migrate diff --from-empty
  --to-schema-datamodel prisma/schema.prisma --script`, which needs no live
  database — worth remembering next time the schema changes and there's no
  Postgres to hand.
- Still to do at deploy time: use a **pooled** connection string (serverless
  opens many connections) — Neon's pooled URL / pgbouncer, or Prisma
  Accelerate — and run `prisma migrate deploy` on release.

> **Local dev now needs Postgres.** `DATABASE_URL="file:./dev.db"` is no longer
> valid and any page that queries will fail with *"the URL must start with the
> protocol `postgresql://`"*. Point it at a free Neon/Supabase branch, a local
> `docker run postgres`, or pull the deployed one with `vercel env pull`. The
> old `prisma/dev.db` file is now inert — it's gitignored, so just ignore it.

### 2. Image uploads: local FS → object storage ✅ done

Implemented with **Vercel Blob** (`@vercel/blob`). The app now picks a backend
at runtime: Blob when `BLOB_READ_WRITE_TOKEN` is set, local disk otherwise, so
`npm run dev` still needs no configuration and old `/media` posts keep working.

Uploads go **direct from the browser** to Blob rather than through
`/api/uploads`. That's deliberate: Vercel caps function request bodies at
4.5 MB, and the app allows 5 MB images, so a server-side upload would have
413'd on large photos. The browser calls `/api/uploads/token`, which checks the
session and hands back a token constrained to our image types and size cap;
Blob enforces both.

- To finish this on Vercel: **Storage → Create → Blob**, connect it to the
  project, and the token is injected automatically. Nothing else to configure.
- `onUploadCompleted` is intentionally a no-op — the browser sends the returned
  URL to `POST /api/posts`, which persists it. (Blob can't call back to
  localhost, so logic there wouldn't run in dev.)
- `isValidUploadUrl()` accepts a `/media/...` path or an `https://` URL on our
  own store's host, derived from the token. Anything else is refused.

### 3. Build config ✅ done

> **Monorepo, since 2026-09-03.** The app now lives in `apps/web`, with shared
> pure logic in `packages/core` (see ADR 0009). Vercel needs its **Root
> Directory** set to `apps/web`, with *"Include files outside the root
> directory"* left on so the workspace root and `packages/core` are available
> at install time. The scripts below are `apps/web/package.json`'s, unchanged
> otherwise — Vercel still finds `vercel-build` there.

- `"postinstall": "prisma generate"` is now in `apps/web/package.json`. Without it the
  build fails on Vercel with *"@prisma/client did not initialize yet"*, because
  the dependency cache restores `node_modules` without re-running the
  generator.
- `"vercel-build"` runs `prisma migrate deploy && tsx prisma/seed-catalog.ts &&
  next build`. Vercel prefers that script over `build` when it exists, so the
  migration and catalog seed are version-controlled rather than typed into a
  dashboard field.

> **Why a seed step in the build.** The gear catalog is reference data, not
> demo content: signup writes a `UserGear` row per `STARTER_CATALOG` entry, so
> a database with an empty `GearItem` table rejects **every signup** with a
> foreign key violation on `UserGear_gearItemId_fkey`. Migrations create tables
> but don't populate them, so a fresh database needs this. The upsert is keyed
> on stable slug ids and therefore idempotent — safe on every deploy, and it
> doubles as the way to push catalog edits live. `npm run db:seed` still exists
> for local use and additionally inserts the demo posts, which production
> deliberately doesn't get.

### 4. Vercel env vars
- `DATABASE_URL` — pooled Postgres connection string
- `DATABASE_URL_UNPOOLED` — the direct endpoint, for `migrate deploy` in
  `vercel-build`. The Neon integration adds both; without it the build fails at
  schema load, before it ever reaches the database.
- `SESSION_SECRET` — 32+ char random string
  (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`)
- `NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES` — only if guests should be able to wave.
  Must be present for the **build**, and a redeploy is required to change it.
- `BLOB_READ_WRITE_TOKEN` — added automatically when you connect a Blob store;
  you shouldn't need to set it by hand.

Vercel is one of the two adapters Next 16 lists as *verified* (the other is
Bun), so App Router features are covered without caveats.

---

## Option B — Persistent host (no longer the cheap escape hatch)

Railway / Render / Fly.io still work — Next 16 runs anywhere with a Node
server (`next build` + `next start`, which `package.json` already has) or as a
Docker container, and all three have official templates under the `nextjs`
GitHub org. Uploads would fall back to disk automatically, since no
`BLOB_READ_WRITE_TOKEN` means the local path stays active; a mounted volume
holding `./uploads/` is all that needs.

What changed: **this option used to mean "no code changes at all"**, and it
doesn't any more. The Postgres swap is one-way — Prisma binds a schema to a
single provider — so a persistent host would now need a Postgres too, rather
than the SQLite file on a volume it got for free before. Reverting would mean
putting `provider = "sqlite"` back and regenerating the migrations again.

- Provision Postgres and set `DATABASE_URL` to it.
- Set `SESSION_SECRET`, and `NEXT_PUBLIC_ALLOW_ANONYMOUS_WAVES` at build time
  if guests should wave.
- Attach a volume for `./uploads/`, or set a Blob token and skip the volume.
- Run `prisma migrate deploy` on boot/release.
- If containerizing, `output: "standalone"` in `next.config.ts` gives a much
  smaller image (it ships only the runtime files, not all of `node_modules`).

---

## The eventual scale path

Discussed earlier and unchanged: staying in the JS ecosystem keeps the door
open for an **Expo mobile app** that reuses the backend and the client-agnostic
`src/lib/*` modules. The main scale step — SQLite → Postgres — is now behind
us, which is what Prisma was chosen for in the first place.

## Swap points (all now done)

- ~~`prisma/schema.prisma` — datasource provider~~ → `postgresql`, with a
  regenerated init migration.
- ~~`package.json` — build/generate scripts~~ → `postinstall: prisma generate`.
- ~~`src/lib/uploads.ts` / `src/app/media/[file]/route.ts` — storage backend~~ →
  `blobUploadsEnabled()` picks the backend, `isValidUploadUrl()` gates what gets
  persisted, `src/app/api/uploads/token/route.ts` authorizes browser uploads,
  and the disk path (`saveUpload()`, `readUpload()`, `/media`) stays for dev.

What's left is configuration, not code: a pooled `DATABASE_URL`, a
`prisma migrate deploy` step on release, and a Blob store connected to the
project.

Not a swap point, but deploy-relevant: `src/lib/waves.ts` reads the temporary
anonymous-waves flag. When that experiment ends, the variable disappears from
the host config along with the code.
