"use client";

import { useState } from "react";
import type { Post } from "@/lib/types";

const MAX_CONTENT_LENGTH = 500;

export function Composer({ onPosted }: { onPosted: (post: Post) => void }) {
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_CONTENT_LENGTH - content.length;
  const canSubmit = content.trim().length > 0 && remaining >= 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Something went wrong. Try again.");
      }
      onPosted(data.post as Post);
      setContent("");
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
      <input
        type="text"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Your handle (optional)"
        maxLength={40}
        className="mb-2 w-full bg-transparent text-sm font-medium text-black/70 outline-none placeholder:text-black/30 dark:text-white/70 dark:placeholder:text-white/30"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What are you riding today?"
        rows={3}
        className="w-full resize-none bg-transparent text-lg outline-none placeholder:text-black/30 dark:placeholder:text-white/30"
      />
      {error && (
        <p className="mt-1 text-sm text-rose-500" role="alert">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center justify-end gap-4">
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
    </form>
  );
}
