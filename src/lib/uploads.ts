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

// Uploads are served by the /media/[file] route handler (NOT static-served from
// public/, which only reliably serves files that existed at build time). Files
// live in a private ./uploads dir. This helper is the single swap point for a
// future object store (S3 / Vercel Blob).
export const UPLOADS_URL_PREFIX = "/media";
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// A stored filename is a UUID + known image extension — no path separators.
const FILENAME_RE = /^[A-Za-z0-9-]+\.(jpg|png|webp|gif)$/;

export type SaveResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

// Validate and persist an uploaded image. Returns the public URL path
// (e.g. "/media/ab12.jpg") to store on the post.
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

// Read a stored upload by filename for the /media route. Returns null if the
// name is invalid (guards against path traversal) or the file is missing.
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

// A safe local media path? Used to validate imageUrl before persisting it on a
// post, so we never store an arbitrary/remote URL.
export function isValidUploadUrl(url: string): boolean {
  return /^\/media\/[A-Za-z0-9-]+\.(jpg|png|webp|gif)$/.test(url);
}
