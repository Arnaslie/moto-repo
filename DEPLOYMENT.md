# Deployment options

Notes on shipping **moto-repo** to production. The app is Next.js 16 (App
Router) with Prisma 6 + SQLite, `iron-session` auth, and a route-split three.js
showroom.

## TL;DR

The **framework** (Next.js) deploys anywhere. Two storage choices we made for
zero-config local dev are the only things that need attention before a
serverless deploy:

| Concern | Local (today) | Serverless-ready (Vercel) |
| --- | --- | --- |
| Database | SQLite file (`prisma/dev.db`) | Hosted Postgres |
| Image uploads | `./uploads/` on disk, served by the `/media/[file]` route | Object storage (Blob/S3) |

Both were deliberately isolated so the swap is small.

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
- **3D showroom** — client-only and route-split; the ~888 KB three.js chunk
  loads only on `/showroom/[id]`, never on the feed.
- **App code / routing** — standard App Router; nothing platform-specific.
- **Env vars referenced in code**: `DATABASE_URL`, `SESSION_SECRET`
  (+ `NODE_ENV`, set automatically).

---

## Option A — Vercel + Postgres + Blob (recommended, production-grade)

Best Next.js DX and edge network. Requires the two storage swaps. ~Half a day.

### 1. Database: SQLite → Postgres
- Provision Postgres with a free tier: **Neon**, **Supabase**, or **Vercel
  Postgres**.
- In `prisma/schema.prisma`, change the datasource:
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }
  ```
- Use a **pooled** connection string (serverless opens many connections) —
  e.g. Neon's pooled URL / pgbouncer, or Prisma Accelerate.
- Re-init migrations for Postgres (the current migration files are
  SQLite-specific): delete `prisma/migrations/`, then
  `prisma migrate dev --name init` against a Postgres dev DB.
- On deploy, run `prisma migrate deploy`.

### 2. Image uploads: local FS → object storage
- Rewrite **only** `saveUpload()` in `src/lib/uploads.ts` to push bytes to
  **Vercel Blob** (`@vercel/blob`) / S3 / Cloudinary and return the URL.
- If the store serves images directly, have `saveUpload()` return the full
  object URL and drop the `/media` route (delete `readUpload()` +
  `src/app/media/[file]/route.ts`); or keep `/media` as a proxy and point
  `readUpload()` at the bucket. Relax `isValidUploadUrl()` accordingly.
- Everything calling `saveUpload()` stays unchanged.

### 3. Build config
- Add a Prisma generate step (there is no `postinstall` today):
  ```jsonc
  // package.json
  "scripts": {
    "postinstall": "prisma generate",
    "build": "next build"
  }
  ```
- Run migrations on deploy via `prisma migrate deploy` (build step or release
  command).

### 4. Vercel env vars
- `DATABASE_URL` — pooled Postgres connection string
- `SESSION_SECRET` — 32+ char random string
  (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`)

---

## Option B — Persistent host (fastest to ship, minimal change)

Railway / Render / Fly.io with a mounted volume. SQLite + the `./uploads/` dir
keep working **as-is** because the filesystem persists.

- Attach a persistent volume; ensure `prisma/dev.db` and `./uploads/`
  live on it.
- Set `SESSION_SECRET` (and `DATABASE_URL="file:./prisma/dev.db"` or similar).
- Run `prisma migrate deploy` on boot/release.
- Trade-off: effectively single-instance, less horizontal scale, more ops on
  you — but near-zero code change.

---

## The eventual scale path

Discussed earlier and unchanged: staying in the JS ecosystem keeps the door
open for an **Expo mobile app** that reuses the backend and the client-agnostic
`src/lib/*` modules. The main scale step is **SQLite → Postgres** (Option A),
which is why Prisma was chosen from the start.

## Isolated swap points (where the work actually is)

- `prisma/schema.prisma` — datasource provider
- `src/lib/uploads.ts` — `saveUpload()` (storage backend), `readUpload()`
  (serving), `isValidUploadUrl()`
- `src/app/media/[file]/route.ts` — the upload-serving route (proxy or removed
  when the store serves images directly)
- `package.json` — build/generate/migrate scripts
