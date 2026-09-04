import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

// Allowed image types <-> file extension.
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const EXT_TO_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Two storage backends, picked at runtime:
//
//   Vercel Blob  — when BLOB_READ_WRITE_TOKEN is set. The browser uploads
//                  straight to Blob, so the bytes never pass through a function
//                  and the 4.5 MB request-body limit doesn't apply. See
//                  src/app/api/uploads/token/route.ts.
//   Local disk   — otherwise. Bytes go to a private ./uploads dir served by the
//                  /media/[file] route handler, NOT static public/, which only
//                  reliably serves files that existed at build time.
//
// So only the disk path runs through saveUpload(); the Blob path is client-side
// by necessity, and isValidUploadUrl() is what both funnel back into.
export const UPLOADS_URL_PREFIX = "/media";
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// A stored filename is a UUID + known image extension — no path separators.
const FILENAME_RE = /^[A-Za-z0-9-]+\.(jpg|png|webp|gif)$/;

// Blob public URLs are https://<storeId>.public.blob.vercel-storage.com/<path>.
// The store id is either handed to us directly or is the 4th `_`-separated
// segment of the read-write token (`vercel_blob_rw_<storeId>_<random>`).
function blobStoreId(): string | null {
  const explicit = process.env.BLOB_STORE_ID;
  if (explicit) {
    return explicit.startsWith("store_") ? explicit.slice("store_".length) : explicit;
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  return token.split("_")[3] || null;
}

// Which backend is live? Generating a client upload token needs the read-write
// token specifically, so that — not BLOB_STORE_ID — is what decides.
export function blobUploadsEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// The one host we'll accept blob URLs from; null means refuse them all rather
// than guess. Lowercased because store ids are mixed-case but URL parsing folds
// hostnames — compare the two as-is and every legitimate blob URL is rejected.
function blobPublicHost(): string | null {
  const storeId = blobStoreId();
  return storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : null;
}

export type SaveResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

// Returns the public URL path (e.g. "/media/ab12.jpg") to store on the post.
export async function saveUpload(file: File): Promise<SaveResult> {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) {
    return { ok: false, error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." };
  }
  if (file.size === 0) {
    return { ok: false, error: "The file is empty." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}.${ext}`;

  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, filename), bytes);

  return { ok: true, url: `${UPLOADS_URL_PREFIX}/${filename}` };
}

// For the /media route. Null if the name is invalid (this is the path-traversal
// guard) or the file is missing.
export async function readUpload(
  filename: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  if (!FILENAME_RE.test(filename)) return null;
  const ext = filename.split(".").pop() as string;
  try {
    const body = await readFile(path.join(UPLOADS_DIR, filename));
    return { body, contentType: EXT_TO_TYPE[ext] };
  } catch {
    return null;
  }
}

// The gate that stops an arbitrary remote URL being persisted on a post: a
// local /media path, or a blob in *our* store, and nothing else. It cannot
// prove the caller is the one who uploaded that blob.
const BLOB_PATHNAME_RE = /^\/[A-Za-z0-9._~/-]+\.(jpg|jpeg|png|webp|gif)$/i;

export function isValidUploadUrl(url: string): boolean {
  if (/^\/media\/[A-Za-z0-9-]+\.(jpg|png|webp|gif)$/.test(url)) return true;

  const host = blobPublicHost();
  if (!host) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // Compare the parsed hostname, never the raw string — an endsWith() check on
  // the URL text would happily match evil.com/?x=.blob.vercel-storage.com.
  return (
    parsed.protocol === "https:" &&
    parsed.hostname === host &&
    BLOB_PATHNAME_RE.test(parsed.pathname)
  );
}
