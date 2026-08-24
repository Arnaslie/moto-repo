# ADR 0002 — Video and 360 footage on posts

- **Status:** Accepted, not yet implemented
- **Date:** 2026-08-24
- **Supersedes / superseded by:** —
- **Touches:** `prisma/schema.prisma`, `src/lib/uploads.ts`, `src/app/api/uploads/`, `src/app/api/posts/`, `src/components/Composer.tsx`, `src/components/PostCard.tsx`

---

## Context

Riders film. Action cams and 360 rigs are standard kit, and the thing people most
want to show off — the ride itself — is the one thing this app can't carry.

A post today takes text and a single image capped at 5 MB (`MAX_UPLOAD_BYTES`,
`src/lib/uploads.ts:21`), the file input accepts four image MIME types
(`Composer.tsx:8`), and `Post` has exactly one media column, `imageUrl`.

The goal: **video on posts, including 360 footage, played as a sphere rather
than a warped rectangle.**

### What's already here and worth reusing

- **Direct-to-Blob client upload already exists.**
  `src/app/api/uploads/token/route.ts` mints a token; `Composer.tsx:88-94` calls
  `upload()`. The bytes already bypass the 4.5 MB function-body limit, and Blob's
  client path handles 500 MB without multipart. **150 MB needs no new upload
  mechanism** — it needs new limits, new types, and a player.
- **three.js is already a dependency** (`@react-three/fiber`, `drei`) for the
  bike showroom, and `/showroom/[id]` already demonstrates route-splitting the
  ~900 KB 3D bundle off the feed. The sphere viewer reuses both the dependency
  and the pattern.
- **`isValidUploadUrl()`** (`src/lib/uploads.ts:118-137`) is the existing gate
  against persisting an arbitrary remote URL. It extends rather than gets
  replaced.
- **Runtime feature flags as props** — `Feed.tsx:14-16` passes `blobUploads` down
  from the server "so it isn't frozen into the build the way a `NEXT_PUBLIC_` var
  would be". Video ships behind the same mechanism.

---

## Decision

Generalise `Post`'s single image column into a media reference, raise the
ceiling to **150 MB / 60 seconds** for video, keep the bytes in **Vercel Blob**,
detect 360 footage by **reading the MP4's spherical metadata in the browser**,
and play it on a sphere at a **dedicated route** rather than in the feed.

Four decisions were taken before this was written:

1. **Vercel Blob only** — but with the schema shaped so a video platform (Stream,
   Mux) can replace it later without a second migration.
2. **150 MB and 60 seconds** per clip.
3. **Sniff, then override** — pre-tick a 360 toggle from the file's metadata and
   let the rider correct it.
4. **One PATCH route** to flip that flag after posting, and nothing else about a
   post becomes editable.

### The cost ceiling, stated up front

Vercel Blob **stops caching any blob over 512 MB**. Past that, every view is a
cache MISS — a Simple Operation plus Fast Origin Transfer, every time. That is
why 150 MB is a ceiling rather than a preference: it keeps clips inside the
cache.

At 150 MB, storage is the cheap half: ~$0.023/GB-month, so 100 clips ≈ 15 GB ≈
**$0.35/month**. Transfer is the problem. Blob Data Transfer runs $0.05/GB beyond
the included 100 GB, and 100 GB is roughly **660 full views of one 150 MB clip**.
On Hobby that included tier is a **hard stop, not a bill** — exceed it and Blob
becomes inaccessible for 30 days, which takes every existing post image down with
it.

**Precondition, not a footnote:** video ships behind a runtime flag, and the
account moves to Pro with Spend Management configured before it is turned on for
everyone.

---

## Data model

`Post.imageUrl` becomes a general media reference. Nothing in these names says
"Vercel Blob" — that is the exit. If Stream or Mux lands later, `mediaUrl`
becomes an HLS playback URL, `posterUrl` becomes their thumbnail, and only
`isValidUploadUrl()` has to learn a new host.

```prisma
model Post {
  // ...
  // Renamed from imageUrl — see the migration warning below.
  mediaUrl        String?
  // "image" | "video" | "video360" — see MEDIA_KINDS in src/lib/media.ts
  mediaKind       String?
  // Poster frame, extracted in the browser at upload time. Null for images, and
  // null for video when extraction failed — the <video> falls back to showing
  // its own first frame.
  posterUrl       String?
  // Read off the file in the browser. Width and height reserve layout space so
  // the feed doesn't jump as media loads; durationMs is what the 60s cap is
  // enforced against, and what renders on the poster.
  mediaWidth      Int?
  mediaHeight     Int?
  mediaDurationMs Int?
}
```

No enum, per house convention — a bare `String` with the allowed values in a
comment and `isMediaKind()` guarding it in `src/lib/media.ts`.

### ⚠️ The migration is the dangerous step

`prisma migrate diff` emits **`DROP COLUMN "imageUrl"` + `ADD COLUMN
"mediaUrl"`** for a rename. Applied as generated, that **destroys the image on
every existing post.** The generated SQL must be hand-edited to:

```sql
ALTER TABLE "Post" RENAME COLUMN "imageUrl" TO "mediaUrl";
-- new columns added normally, then:
UPDATE "Post" SET "mediaKind" = 'image' WHERE "mediaUrl" IS NOT NULL;
```

Verify with a row count of `mediaUrl IS NOT NULL` before and after. This is the
only step in this record that can lose data, and it will do so silently.

---

## New modules

| File | Tier | Holds |
| --- | --- | --- |
| `src/lib/media.ts` | pure | `MEDIA_KINDS` (`as const`), `isMediaKind`, `MAX_IMAGE_BYTES` (5 MB, unchanged), `MAX_VIDEO_BYTES` (150 MB), `MAX_VIDEO_DURATION_MS` (60 000), `EQUIRECT_ASPECT` (2.0) and its tolerance, `describeMedia()` for alt text |
| `src/lib/mp4.ts` | pure | The box walker — one parse, three answers |

**`src/lib/mp4.ts` is the interesting piece.** It walks MP4 boxes over a `File`
using `slice()`, so it never pulls 150 MB into memory, and it answers three
questions in one pass:

1. **Is it 360?** Google Spherical **v1** — a `uuid` box carrying XML with
   `<GSpherical:Spherical>true</...>` and a `ProjectionType` of
   `equirectangular`. **v2** — an `sv3d` box inside the video sample entry whose
   `prji` projection type is `equi`. Insta360, GoPro and Premiere all inject one
   or the other.
2. **Which codec?** The `stsd` sample entry fourcc. `avc1` is H.264 and plays
   everywhere; `hvc1`/`hev1` is HEVC, which Safari plays and Chrome plays only on
   some hardware. We can't transcode, so this becomes a warning at pick time
   rather than a rejection.
3. **Is `moov` before `mdat`?** If not, the file isn't "faststart" and the
   browser must download all 150 MB before the first frame appears. Also
   unfixable client-side, also worth saying out loud to the rider rather than
   letting them wonder why their clip won't start.

Read the first ~1 MB; if `moov` isn't in it, read the last ~2 MB. `File.slice()`
is lazy, so this stays cheap on a phone.

---

## Changes to existing files

**`src/lib/uploads.ts`** — `ALLOWED_VIDEO_TYPES = { "video/mp4": "mp4" }`
alongside the image map. **MP4 only:** `video/quicktime` plays in Safari and
unreliably elsewhere, and accepting a container we can't play back is worse than
refusing it at the picker. `FILENAME_RE` and `BLOB_PATHNAME_RE` gain `mp4`.
`isValidUploadUrl(url, kind)` takes the kind, so a video URL can't be persisted
into an image slot or the reverse. `MAX_UPLOAD_BYTES` splits into the per-kind
constants from `media.ts`.

**`src/app/media/[file]/route.ts` and `readUpload()` — Range requests.** The dev
disk path currently reads the whole file into a `Buffer` and returns it with no
`Accept-Ranges` (`route.ts:17-24`). A `<video>` served that way **cannot seek**,
and a 150 MB `readFile` per request is its own problem. The route needs to parse
`Range: bytes=…`, answer `206` with `Content-Range` and `Accept-Ranges`, and
stream with `createReadStream` instead of buffering. Dev-only, but it is the
difference between video working locally and appearing broken.

**`src/app/api/uploads/token/route.ts`** — the allowance becomes per-kind, keyed
off the pathname prefix we control in `blobPathname()` (`posts/video/…` vs
`posts/image/…`). Blob enforces `allowedContentTypes` and `maximumSizeInBytes`
itself, which is exactly what makes handing the browser a token safe — so that
prefix must be validated, never trusted as a label.

**`src/app/api/posts/route.ts:31-62`** — accepts the new fields and validates
kind, URL-per-kind, poster-as-image, duration against the cap, and dimensions as
sane positive integers. It does **not** reject a 360 clip whose aspect isn't 2:1
— that's a composer warning, because a legitimately odd export shouldn't be
refused by the server.

**`src/app/api/posts/[id]/route.ts`** — a new `PATCH`, owner-only, that flips
`mediaKind` between `video` and `video360` and nothing else. 401 / 404 / 403 in
the house order; 400 when the post carries no video.

**`src/lib/types.ts` and `serializePost()`** — the `Post` DTO gains the fields.

---

## Composer

Pick → probe → poster → two uploads → post.

1. `accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"`. The image path
   is untouched.
2. **Probe** — `src/lib/mp4.ts` plus an offscreen `<video>`: dimensions and
   duration off `loadedmetadata`, 360/codec/faststart off the box walker. The 60s
   and 150 MB caps are enforced *here*, so nobody watches a three-minute upload
   fail at the end of itself.
3. **Poster** — seek to ~1s, draw to a `<canvas>` capped at 1280 wide,
   `toBlob("image/jpeg", 0.8)`. Object URLs are same-origin, so the canvas isn't
   tainted. If extraction fails, post without a poster rather than blocking.
4. **Upload progress** — `upload()` takes `onUploadProgress`. At 150 MB on a
   phone hotspot, a spinner with no percentage reads as a hang. Not optional.
5. **The 360 toggle** appears only for video, pre-ticked from the sniff. Ticking
   it on a non-2:1 clip warns — "that's 16:9, 360 footage is usually 2:1" —
   without blocking.
6. **Preview** — with 360 ticked, mount the sphere viewer in the composer via
   dynamic import, so a mis-tick is visible to the rider before it's visible to
   anyone else. Dynamic, so three.js stays out of the feed's initial bundle.

### Why sniff rather than trust the toggle

Both failure modes are silent and neither is recoverable without the PATCH route:

- **Flat clip tagged 360** — the viewer maps it to the inside of a sphere anyway.
  The scene wraps all the way round, horizontally compressed into a full circle,
  straight lines bowed, top and bottom rows smeared into pinched points at the
  zenith and nadir. A funhouse mirror. It also loads ~900 KB of WebGL to render
  something that needed a `<video>` tag.
- **360 clip tagged flat** — worse. The feed shows a stretched equirectangular
  rectangle and there's no way to look around. Nothing about it looks like a bug,
  so nobody reports it.

Metadata gets it right for anything a 360 camera or Premiere exported; the 2:1
aspect check catches footage that lost its metadata in editing; the composer
preview is the backstop when both miss.

---

## Playback

**Flat video in the feed** — `<video controls playsinline preload="metadata">`
with `poster`, `width` and `height` set so the card doesn't reflow as it loads.
**No autoplay:** at 150 MB a feed that autoplays is a feed that empties the Hobby
transfer tier in an afternoon.

**360 does not play in the feed.** The card shows the poster with a 360 badge and
links out — the same split `/showroom/[id]` already uses to keep the 3D bundle
off the feed, for the same reason.

**`src/app/ride/[id]/page.tsx`** — the sphere viewer. (The route name is a call to
make; `/showroom` is bikes, so ride footage wants its own word.) A sphere with
inverted normals, a `VideoTexture` off a `<video>` element, `OrbitControls` with
damping and FOV zoom, dynamically imported with `ssr: false` exactly like
`RiderMap`. Equirectangular-onto-a-sphere *is* the real projection — nothing here
is an approximation of one, which is worth a comment in the file.

**The 360 poster is the equirectangular frame itself**, badge and all — not a
centre crop massaged to look rectilinear. An equirect frame is a recognisable
object; a crop of one is a guess at a view the rider never chose. Rendering a
true poster through the viewer is the honest upgrade, and it's a follow-up.

---

## Order of work

1. `src/lib/media.ts` and `src/lib/mp4.ts` — both pure, both testable with no
   database.
2. Schema plus the **hand-edited** migration.
3. `uploads.ts` limits and types; the `/media` Range fix.
4. Token route per-kind allowance; `POST /api/posts` fields; the `PATCH` route.
5. Composer: probe, poster, progress, the 360 toggle and its warning.
6. `PostCard` branches; `<video>` in the feed.
7. `/ride/[id]` sphere viewer; the composer preview reuses it.
8. Turn the flag on; README and DEPLOYMENT notes, including the cost note.

---

## Verification

Without a database (the local `.env` is still the stale SQLite one):

```bash
npx prisma validate && npx prisma generate
npx tsc --noEmit
npm run lint
npm run build
```

Read the generated migration **before applying it** and confirm it says
`RENAME COLUMN`, not `DROP`.

With a database and real footage:

1. A real 360 clip off a 360 camera → the toggle pre-ticks itself, the sphere
   viewer looks around correctly, the poster is the equirect frame with a badge.
2. A flat 16:9 clip → no pre-tick, plays inline, poster and dimensions correct,
   no layout jump as the card loads.
3. Tick 360 on that flat clip → the warning appears, the composer preview shows
   the funhouse warp; post it, then `PATCH` it back to flat and confirm the feed
   changes.
4. A 61-second clip and a 200 MB file → both refused at pick time, with a
   readable sentence, before a byte uploads.
5. A non-faststart export → warned about at pick time.
6. An HEVC clip → warned about; confirm it plays in Safari, then check Chrome.
7. `npm run dev` on the disk backend: scrub a video mid-clip → seeking works and
   the response is a `206` with `Content-Range`.
8. Existing image posts still render after the migration, and the row count of
   `mediaUrl IS NOT NULL` matches the pre-migration `imageUrl` count.
9. Preview deploy: upload 150 MB over a phone connection, watch the progress
   percentage, confirm the blob is under the 512 MB cache limit and that a second
   view is a cache HIT.

---

## Consequences

**Accepted:**

- Riders can post the thing they actually want to post, and 360 footage is shown
  as a sphere you look around rather than a warped rectangle.
- `Post` stops being image-shaped, which is the precondition for any future media
  work.
- One MP4 parser earns its keep three times over — projection, codec and
  faststart all fall out of the same pass.

**Costs and risks:**

- **The Hobby wall.** 100 GB of transfer is ~660 views of one 150 MB clip, and
  exceeding it disables Blob for 30 days — taking existing post images with it.
  Pro plus Spend Management before this is on for everyone.
- **No transcoding.** Whatever the camera produced is what every viewer
  downloads, at full resolution, with no adaptive bitrate. This is the thing a
  video platform would fix, and the schema is shaped so that swap stays cheap.
- **HEVC.** Common on action cams, unreliable in Chrome, unfixable by us. We warn
  and accept.
- **Orphan blobs.** The composer uploads before creating the post, so an
  abandoned or failed post leaves a billed blob with nothing pointing at it. True
  for images today; 30× more expensive at 150 MB. A `list()`-versus-`Post` sweep
  is the follow-up.
- **The rename.** Covered above. It's the only step that can lose data, and it
  does so silently if the generated SQL is applied unread.
