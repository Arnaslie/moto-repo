# ADR 0009 — Two workspaces, ahead of a mobile app

- **Status:** Implemented (structure). The mobile app it makes room for does not exist yet.
- **Date:** 2026-09-03
- **Supersedes / superseded by:** —
- **Touches:** repository layout — `apps/web/`, `packages/core/`, root
  `package.json` workspaces, `.githooks/pre-push`, `DEPLOYMENT.md`

---

## Context

The next thing this app wants is an iPhone and Android client with at least
feature parity. Before any of that gets written there is a question that only
gets more expensive to answer later: one repository or two.

The deciding fact is how much of `src/lib` is already portable. Of 25 files,
16 import nothing at all and another 5 import only each other. Just four are
genuinely bound to the server — `prisma`, `session`, `thread`, `notify` — plus
`uploads` on node builtins and `waves` on a `NEXT_PUBLIC_` variable.

That is not an accident. `gear.ts` has carried this line since it was written:

> plain data, no React/Next/Prisma imports so it can be consumed by the seed
> script, API, web UI, and a future mobile app alike

The gear catalog is the sharpest case. Signup writes a `UserGear` row per
`STARTER_CATALOG` entry, so if a web copy and a mobile copy of that list ever
drift, the failure is real data corruption, not a cosmetic mismatch. The same
argument covers `anatomy.ts` and `drivetrain.ts`: both are pure geometry that
emits path strings, so they survive a port to `react-native-svg` even though
the components drawing them will not.

## Decision

npm workspaces, two of them.

```
apps/web/        the Next app, moved wholesale
packages/core/   the 16 portable modules
```

### Subpath exports, not a barrel

`@moto/core` exports `"./*": "./src/*.ts"`, so `@/lib/gear` became
`@moto/core/gear` and the rewrite was mechanical. A single barrel was not an
option regardless of taste: `locations.ts` and `motorcycles.ts` both export a
type called `ParseResult`, and `motorcycles.ts` exports `Motorcycle`, which
would collide with Prisma's model type at the first import.

### The package ships raw TypeScript

No build step. This version of Next transpiles workspace packages under the App
Router automatically, so `transpilePackages` is not needed and was not added.
The cost of being wrong here is a build error on day one, not a subtle one.

`turbopack.root` moves up to the repository root. It was pinned to the app
directory to stop Turbopack finding stray lockfiles in the home directory;
pinned there now it would not see `packages/core` at all.

### What stayed behind

`conversations.ts`, `posts.ts` and `rooms.ts` read as portable by their imports
but are Prisma query builders — `postInclude`, `messageSelect`, `liveRoomsQuery`.
They are server code that happens not to import Prisma, and putting them in a
package a phone consumes would be a lie about what they are.

`waves.ts` stays for a different reason: `ANONYMOUS_WAVES_ENABLED` reads a
`NEXT_PUBLIC_` variable that Next inlines at build time, which is a web
deployment concept with no mobile equivalent.

## Consequences

Every root script now delegates: `npm run dev`, `build` and `start` target
`@moto/web`, while `lint` and `typecheck` run across all workspaces, so
`packages/core` is type-checked on its own and not only through its consumer.
The pre-push hook calls `npm run typecheck` instead of reaching for a tsconfig
path directly, and so keeps working as workspaces are added.

`.env` and `.env.example` moved into `apps/web`. Next and the Prisma CLI both
resolve them relative to where they run, and both now run from there. The
root `.gitignore` patterns are unanchored, so they still cover the new
location — checked rather than assumed.

Vercel needs its Root Directory set to `apps/web`. That is a dashboard setting,
not a file, and is the one part of this change that cannot be verified from the
repository; it is written down in `DEPLOYMENT.md` instead.

Adding `apps/mobile` is now a directory and a `package.json`. Note that Expo's
Metro bundler needs `watchFolders` and `nodeModulesPaths` pointed at the
hoisted root to resolve `@moto/core` — that is the known friction point of this
layout and it is paid at that time, not this one.

What this does **not** do is make components shareable. `div` and `View` have
nothing in common, and the CSS variables that carry every theme in this app
have no React Native equivalent. The shared layer is data, types, geometry,
validation and formatting. That is the realistic prize and it is already large.
