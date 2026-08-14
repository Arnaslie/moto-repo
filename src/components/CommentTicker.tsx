"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Comment } from "@/lib/types";
import { MAX_COMMENT_LENGTH, truncateForTicker } from "@/lib/comments";
import { timeAgo } from "@/lib/format";
import { Avatar } from "./Avatar";
import { ChatIcon } from "./icons";

// Crawl speed in CSS pixels per second. The animation duration is derived from
// this and the measured content width, so a post with two comments scrolls at
// exactly the same pace as one with twelve.
const SPEED_PX_PER_SEC = 60;

// This component renders on the server too, where useLayoutEffect warns.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// The scrolling strip and the thread it opens. The comment tally and the
// open/closed state are owned by PostFooter, which shares them with the action
// row above — this component reports changes up rather than keeping its own.
export function CommentTicker({
  postId,
  comments: initialComments,
  commentCount: total,
  onCountChange,
  expanded,
  onExpandedChange,
  threadId,
  currentUser,
}: {
  postId: string;
  comments: Comment[];
  commentCount: number;
  onCountChange: (count: number) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  threadId: string;
  currentUser: { handle: string } | null;
}) {
  const shellRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLSpanElement>(null);
  const copyRef = useRef<HTMLSpanElement>(null);

  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = comments.length === 0;
  const hasMore = total > comments.length;
  const remaining = MAX_COMMENT_LENGTH - draft.length;

  // Size the crawl to its content. Values are written straight to the DOM
  // rather than through state: no extra render, and it stays clear of the
  // react-hooks/set-state-in-effect rule.
  useIsomorphicLayoutEffect(() => {
    const shell = shellRef.current;
    const viewport = viewportRef.current;
    const copy = copyRef.current;
    if (!shell || !viewport || !copy) return;

    const measure = () => {
      const contentWidth = copy.offsetWidth;
      const fits = contentWidth <= viewport.clientWidth;
      shell.dataset.static = String(fits);
      if (!fits) {
        shell.style.setProperty(
          "--ticker-duration",
          `${(contentWidth / SPEED_PX_PER_SEC).toFixed(2)}s`,
        );
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [comments]);

  // Don't burn frames animating strips the reader can't see.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        shell.dataset.offscreen = String(!entry.isIntersecting);
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  async function loadAll() {
    setLoadingAll(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't load the thread.");
      const all = data.comments as Comment[];
      setComments(all);
      onCountChange(all.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the thread.");
    } finally {
      setLoadingAll(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || busy || remaining < 0) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't post that comment.");
      setComments((prev) => [...prev, data.comment as Comment]);
      onCountChange(total + 1);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post that comment.");
    } finally {
      setBusy(false);
    }
  }

  // One copy of the crawl. Rendered twice inside the track so the loop is
  // seamless — see the ticker rules in globals.css.
  const items = (
    <>
      {comments.map((comment) => (
        <span key={comment.id} className="flex shrink-0 items-center gap-2 px-4">
          <span className="text-orange-500/60">▪</span>
          <span className="font-semibold text-orange-500">@{comment.author}</span>
          <span className="text-black/70 dark:text-white/70">
            {truncateForTicker(comment.content)}
          </span>
        </span>
      ))}
    </>
  );

  return (
    <div className="border-t border-black/10 dark:border-white/10">
      <button
        ref={shellRef}
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        aria-expanded={expanded}
        aria-controls={threadId}
        aria-label={
          isEmpty
            ? "No comments yet — add one"
            : `${total} comment${total === 1 ? "" : "s"} — ${
                expanded ? "hide" : "show"
              } thread`
        }
        data-expanded={expanded}
        className="ticker-shell flex w-full items-stretch bg-black/[0.03] text-left text-sm transition-colors hover:bg-black/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
      >
        {/* Icon only — the tally lives in the action row above. */}
        <span className="flex shrink-0 items-center bg-orange-500 px-3 py-2 text-white">
          <ChatIcon />
        </span>

        {/* Spans, not divs — this all lives inside a <button>, which only
            accepts phrasing content. */}
        <span
          ref={viewportRef}
          className="ticker-viewport relative block min-w-0 flex-1 overflow-hidden py-2"
        >
          {/* Decorative motion — screen readers get the real list on expand. */}
          <span className="ticker-track flex w-max" aria-hidden>
            <span ref={copyRef} data-ticker-copy="primary" className="flex items-center">
              {isEmpty ? (
                <span className="px-4 text-black/40 dark:text-white/40">
                  Be the first to comment
                </span>
              ) : (
                items
              )}
            </span>
            <span data-ticker-copy="duplicate" className="flex items-center">
              {items}
            </span>
          </span>
        </span>

        <span
          className="flex shrink-0 items-center px-3 text-black/40 dark:text-white/40"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {expanded && (
        <div id={threadId} className="px-4 py-3">
          {hasMore && (
            <button
              type="button"
              onClick={loadAll}
              disabled={loadingAll}
              className="mb-3 text-sm font-medium text-orange-500 hover:underline disabled:opacity-50"
            >
              {loadingAll ? "Loading…" : `Load all ${total} comments`}
            </button>
          )}

          {isEmpty ? (
            <p className="text-sm text-black/40 dark:text-white/40">
              No comments yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="flex gap-2.5">
                  <Link
                    href={`/profile/${comment.author}`}
                    aria-label={`@${comment.author}'s profile`}
                    className="shrink-0"
                  >
                    <span className="block overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/10">
                      {comment.avatar ? (
                        <Avatar
                          skin={comment.avatar.skin}
                          equipped={comment.avatar.equipped}
                          size={28}
                        />
                      ) : null}
                    </span>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <Link
                        href={`/profile/${comment.author}`}
                        className="truncate text-sm font-semibold hover:underline"
                      >
                        @{comment.author}
                      </Link>
                      <span
                        className="text-xs text-black/40 dark:text-white/40"
                        suppressHydrationWarning
                      >
                        · {timeAgo(comment.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="mt-2 text-sm text-rose-500" role="alert">
              {error}
            </p>
          )}

          {currentUser ? (
            <form onSubmit={submit} className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a comment…"
                maxLength={MAX_COMMENT_LENGTH}
                className="min-w-0 flex-1 rounded-full border border-black/15 bg-transparent px-4 py-2 text-sm outline-none focus:border-orange-500 dark:border-white/20"
              />
              <span
                className={`text-xs tabular-nums ${
                  remaining < 20
                    ? "text-rose-500"
                    : "text-black/30 dark:text-white/30"
                }`}
              >
                {remaining < 20 ? remaining : ""}
              </span>
              <button
                type="submit"
                disabled={busy || draft.trim().length === 0}
                className="shrink-0 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Sending…" : "Send"}
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-black/50 dark:text-white/50">
              <Link href="/login" className="font-medium text-orange-500 hover:underline">
                Sign in
              </Link>{" "}
              to join the conversation.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
