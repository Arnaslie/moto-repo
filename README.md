# moto-repo

Social media platform curated for motorcycle hobbyists and enthusiasts.

A [Next.js](https://nextjs.org) (App Router) app with a feed and a post composer,
backed by SQLite via [Prisma](https://www.prisma.io/), styled with Tailwind CSS.

## Getting started

```bash
npm install
npm run db:migrate   # apply migrations and generate the Prisma client
npm run db:seed      # optional: load sample posts
npm run dev          # http://localhost:3000
```

## Stack

- **Next.js 16** — React 19, App Router, server components
- **Prisma 6 + SQLite** — a local `prisma/dev.db` file, no external services
- **Tailwind CSS 4** — utility-first styling

## Project layout

```
src/
  app/
    page.tsx              # feed page (server component, reads from DB)
    api/posts/route.ts    # GET (list) + POST (create) endpoints
    layout.tsx            # root layout + fonts
  components/
    Feed.tsx              # client feed: composer + list, live updates
    Composer.tsx          # write / submit a new post
    PostCard.tsx          # single post
  lib/
    prisma.ts             # Prisma client singleton
    types.ts              # shared Post type
    format.ts             # relative-time helper
prisma/
  schema.prisma           # Post model
  seed.ts                 # sample posts
```

## Handy scripts

| Command              | Description                                     |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Start the dev server                            |
| `npm run build`      | Production build                                |
| `npm run db:migrate` | Create/apply a migration (`prisma migrate dev`) |
| `npm run db:seed`    | Seed sample posts                               |
| `npm run db:studio`  | Open Prisma Studio to browse the DB             |

## Next ideas

Likes, comments, per-user profiles/auth, image uploads for ride photos,
tags/hashtags, and pagination on the feed.
