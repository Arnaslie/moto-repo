"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { MAX_MESSAGE_LENGTH, type ConversationSummary, type MessageDTO } from "@/lib/messages";
import { timeAgo } from "@/lib/format";

/* A thread, polled. See ADR 0003, and ADR 0001 for the SSE stream meant to
   replace this: `mergeMessages` being idempotent by id and the cursor being a
   timestamp are the two seams that swap needs. */

const POLL_MS = 3000;

// Prefixed so a pending id can never collide with a cuid from the server.
const pendingId = (n: number) => `pending:${n}`;

export function Thread({
  conversation,
  initialMessages,
  me,
}: {
  conversation: ConversationSummary;
  initialMessages: MessageDTO[];
  me: string;
}) {
  const [messages, setMessages] = useState<MessageDTO[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rider = conversation.with;
  const endRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(0);

  const markRead = useCallback(() => {
    fetch(`/api/messages/conversations/${conversation.id}/read`, {
      method: "POST",
    }).catch(() => {
      /* the count is cosmetic; a failed clear self-corrects on the next open */
    });
  }, [conversation.id]);

  useEffect(() => {
    markRead();
  }, [markRead]);

  // The poll reads the current messages through a ref rather than a dependency,
  // so it isn't torn down and rebuilt on every message — a new interval per
  // message would drift the tick and, at worst, stack them.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // The cursor is the newest *server* timestamp we hold — a pending message of
  // our own has none yet, and taking its absence as "the beginning of time"
  // would refetch the thread.
  useEffect(() => {
    let active = true;

    async function load() {
      const current = messagesRef.current;
      const cursor = latestServerTimestamp(current);
      const url = `/api/messages/conversations/${conversation.id}${
        cursor ? `?after=${encodeURIComponent(cursor)}` : ""
      }`;
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !Array.isArray(data.messages)) return;

        // mergeMessages hands back the array it was given when nothing is new,
        // which is the tick's normal outcome: the cursor is inclusive, so the
        // newest line comes back every time. Comparing identity is what keeps
        // that from re-rendering the thread — and from marking it read — three
        // times a second, forever.
        const merged = mergeMessages(current, data.messages as MessageDTO[]);
        if (merged === current) return;

        setMessages(merged);
        markRead();
      } catch {
        /* transient — the next tick retries */
      }
    }

    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [conversation.id, markRead]);

  // Follow the conversation down as it grows, the way a chat should. Not on
  // first paint though: the page already opens at the newest message, and
  // animating there from the top is motion nobody asked for.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const trimmed = draft.trim();
  const remaining = MAX_MESSAGE_LENGTH - draft.length;
  const canSend = trimmed.length > 0 && remaining >= 0 && !sending;

  async function send() {
    if (!canSend) return;

    const body = trimmed;
    const optimisticId = pendingId(pendingRef.current++);

    setMessages((prev) => [
      ...prev,
      { id: optimisticId, body, sender: me, createdAt: new Date().toISOString() },
    ]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/messages/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't send that.");

      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? (data.message as MessageDTO) : m)),
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setDraft(body);
      setError(err instanceof Error ? err.message : "Couldn't send that.");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <Link
          href="/messages"
          aria-label="Back to messages"
          className="rounded-full px-2 py-1 text-lg leading-none text-black/50 transition-colors hover:bg-black/5 hover:text-orange-500 dark:text-white/50 dark:hover:bg-white/10"
        >
          ←
        </Link>
        <Link
          href={`/profile/${rider.handle}`}
          className="flex min-w-0 items-center gap-3 hover:text-orange-500"
        >
          <span className="shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10 dark:ring-white/10">
            {rider.avatar ? (
              <Avatar skin={rider.avatar.skin} equipped={rider.avatar.equipped} size={36} />
            ) : (
              <span className="block h-9 w-9 bg-black/5 dark:bg-white/10" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold leading-tight">
              {rider.displayName ?? `@${rider.handle}`}
            </span>
            <span className="block truncate text-xs text-black/40 dark:text-white/40">
              @{rider.handle}
            </span>
          </span>
        </Link>
      </div>

      <div className="flex-1 px-4 py-4">
        {messages.length === 0 ? (
          <EmptyThread handle={rider.handle} />
        ) : (
          <ol className="flex flex-col gap-2.5">
            {messages.map((message) => (
              <Bubble key={message.id} message={message} mine={message.sender === me} />
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 border-t border-black/10 bg-background/80 px-4 py-3 backdrop-blur dark:border-white/10"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={`Message @${rider.handle}`}
            aria-label={`Message @${rider.handle}`}
            className="max-h-40 min-h-[2.75rem] w-full flex-1 resize-y rounded-2xl border border-black/15 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-white/20"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="shrink-0 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 text-xs">
          <span className="text-rose-500" role="status" aria-live="polite">
            {error ?? ""}
          </span>
          {/* Silent until it's nearly a problem — a counter ticking down from
              2000 on a two-word message is noise. */}
          {remaining < 200 && (
            <span
              className={`tabular-nums ${
                remaining < 0 ? "text-rose-500" : "text-black/40 dark:text-white/40"
              }`}
            >
              {remaining}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

/* A thread with nothing in it is what every thread looks like the moment it's
   started — pressing Message on a profile lands you here. */
function EmptyThread({ handle }: { handle: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-base font-semibold">Say something to @{handle}.</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-black/50 dark:text-white/50">
        Just the two of you in here.
      </p>
    </div>
  );
}

function Bubble({ message, mine }: { message: MessageDTO; mine: boolean }) {
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"}`}>
        <div
          className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${
            mine
              ? "rounded-br-md bg-orange-500 text-white"
              : "rounded-bl-md bg-black/[0.06] dark:bg-white/[0.10]"
          }`}
        >
          {message.body}
        </div>
        <div
          className={`mt-0.5 px-1 text-[11px] text-black/35 dark:text-white/35 ${
            mine ? "text-right" : "text-left"
          }`}
        >
          {timeAgo(message.createdAt)}
        </div>
      </div>
    </li>
  );
}

/**
 * The newest timestamp that came from the server. Pending messages carry a
 * locally-minted one, which is close enough to be plausible and wrong enough to
 * skip a message that lands in the same second — so they're excluded.
 */
function latestServerTimestamp(messages: MessageDTO[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!messages[i].id.startsWith("pending:")) return messages[i].createdAt;
  }
  return null;
}

/**
 * Fold newly-fetched messages into what's on screen, by id.
 *
 * Idempotent on purpose: the poll's cursor is inclusive, so the newest message
 * comes back on every tick, and a naive append would duplicate it three times a
 * second. Sorting by timestamp keeps a message that raced in behind one of ours
 * in the right place rather than pinned to the bottom.
 */
function mergeMessages(current: MessageDTO[], incoming: MessageDTO[]): MessageDTO[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  let changed = false;
  for (const message of incoming) {
    if (!byId.has(message.id)) {
      byId.set(message.id, message);
      changed = true;
    }
  }
  if (!changed) return current;

  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
