"use client";

import { useRef, useState } from "react";
import type { Post } from "@/lib/types";

const MAX_CONTENT_LENGTH = 500;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Blob keys the served content-type off the pathname, and the name comes from
// whatever the rider picked off their disk — so strip it down to something
// harmless. A random suffix gets appended server-side, so collisions are fine.
function blobPathname(name: string): string {
  const cleaned = name
    .split(/[\\/]/)
    .pop()!
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-64);
  return `posts/${cleaned || "image.jpg"}`;
}

export function Composer({
  onPosted,
  currentUser,
  blobUploads,
}: {
  onPosted: (post: Post) => void;
  currentUser: { handle: string } | null;
  blobUploads: boolean;
}) {
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_CONTENT_LENGTH - content.length;
  const canSubmit =
    (content.trim().length > 0 || file !== null) && remaining >= 0 && !submitting;

  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError("Unsupported image type. Use JPEG, PNG, WebP, or GIF.");
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setError("Image must be 5 MB or smaller.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setError(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      // Upload the image first (if any), then create the post with its URL.
      let imageUrl: string | null = null;
      if (file && blobUploads) {
        // Straight from the browser to Blob — the file never passes through a
        // function, so nothing caps it at 4.5 MB. Loaded on demand to keep the
        // SDK out of the feed bundle when we're running on disk instead.
        const { upload } = await import("@vercel/blob/client");
        const blob = await upload(blobPathname(file.name), file, {
          access: "public",
          handleUploadUrl: "/api/uploads/token",
          contentType: file.type,
        });
        imageUrl = blob.url;
      } else if (file) {
        const form = new FormData();
        form.append("file", file);
        const uploadRes = await fetch("/api/uploads", { method: "POST", body: form });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData?.error ?? "Image upload failed.");
        }
        imageUrl = uploadData.url as string;
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, content, imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Something went wrong. Try again.");
      }
      onPosted(data.post as Post);
      setContent("");
      clearImage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-b border-black/10 px-4 py-4 dark:border-white/10"
    >
      {currentUser ? (
        <p className="mb-2 text-sm font-medium text-black/60 dark:text-white/60">
          Posting as <span className="text-orange-500">@{currentUser.handle}</span>
        </p>
      ) : (
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Your handle (optional)"
          maxLength={40}
          className="mb-2 w-full bg-transparent text-sm font-medium text-black/70 outline-none placeholder:text-black/30 dark:text-white/70 dark:placeholder:text-white/30"
        />
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What are you riding today?"
        rows={3}
        className="w-full resize-none bg-transparent text-lg outline-none placeholder:text-black/30 dark:placeholder:text-white/30"
      />

      {previewUrl && (
        <div className="relative mt-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img
            src={previewUrl}
            alt="Selected preview"
            className="max-h-64 rounded-xl border border-black/10 dark:border-white/10"
          />
          <button
            type="button"
            onClick={clearImage}
            aria-label="Remove image"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black/80"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-rose-500" role="alert">
          {error}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-4">
        {currentUser ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-orange-500 transition-colors hover:bg-orange-500/10"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              Photo
            </button>
          </>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-4">
          <span
            className={`text-sm tabular-nums ${
              remaining < 0 ? "text-rose-500" : "text-black/40 dark:text-white/40"
            }`}
          >
            {remaining}
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </form>
  );
}
