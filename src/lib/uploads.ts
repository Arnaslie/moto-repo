import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Allowed image types -> file extension. Anything else is rejected.
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Public URL prefix and on-disk location. Kept together so a future swap to
// object storage (S3 / Blob) only touches saveUpload() below.
export const UPLOADS_URL_PREFIX = "/uploads";
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export type SaveResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

// Validate and persist an uploaded image file. Returns the public URL path
// (e.g. "/uploads/ab12.jpg") to store on the post.
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

// A safe local uploads path? Used to validate imageUrl before persisting it on
// a post, so we never store an arbitrary/remote URL.
export function isValidUploadUrl(url: string): boolean {
  return /^\/uploads\/[A-Za-z0-9-]+\.(jpg|png|webp|gif)$/.test(url);
}
