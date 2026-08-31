"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { ConversationSummary } from "@/lib/messages";
import { timeAgo } from "@/lib/format";

// Threads move on the scale of a conversation, not of a room filling up, so
// this is the same slow tick the directory uses. The thread page itself polls
// harder — that's where you're actually waiting on a reply.
const POLL_MS = 10000;

export function Inbox({
  initialConversations,
  me,
}: {
  initialConversations: ConversationSummary[];
  /** The viewer's own handle, so a preview of their own line can say so. */
  me: string;
}) {
  const [conversations, setConversations] = useState(initialConversations);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/messages/conversations");
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.conversations)) setConversations(data.conversations);
      } catch {
        /* transient — the next tick retries */
      }
    }
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const waiting = conversations.filter((c) => c.unreadCount > 0).length;

  return (
    <div>
      <div className="border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">Messages</h2>
          <p className="text-sm text-black/50 dark:text-white/50">
            {waiting > 0 ? `${waiting} waiting` : "all read"}
          </p>
        </div>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Between the two of you. Nobody else sees a thread you&apos;re in.
        </p>
      </div>

      {conversations.length === 0 ? (
        <EmptyInbox />
      ) : (
        <ul>
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <ConversationRow conversation={conversation} me={me} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyInbox() {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-base font-semibold">No threads yet.</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-black/50 dark:text-white/50">
        Messages start from a rider, not from here — open someone&apos;s profile and
        press Message. Ask about the bike in their garage.
      </p>
      <Link
        href="/riders"
        className="mt-5 inline-flex rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
      >
        Find a rider
      </Link>
    </div>
  );
}

function ConversationRow({
  conversation,
  me,
}: {
  conversation: ConversationSummary;
  me: string;
}) {
  const { with: rider, lastMessage, unreadCount } = conversation;
  const unread = unreadCount > 0;

  return (
    <Link
      href={`/messages/${conversation.id}`}
      className="flex items-center gap-3 border-b border-black/10 px-4 py-3.5 transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]"
    >
      <div className="shrink-0 overflow-hidden rounded-xl ring-1 ring-black/10 dark:ring-white/10">
        {rider.avatar ? (
          <Avatar skin={rider.avatar.skin} equipped={rider.avatar.equipped} size={44} />
        ) : (
          <div className="h-11 w-11 bg-black/5 dark:bg-white/10" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`truncate ${unread ? "font-bold" : "font-semibold"}`}>
            {rider.displayName ?? `@${rider.handle}`}
          </span>
          <span className="shrink-0 text-xs text-black/40 dark:text-white/40">
            {timeAgo(conversation.lastMessageAt)}
          </span>
        </div>
        <p
          className={`truncate text-sm ${
            unread ? "text-black/80 dark:text-white/80" : "text-black/50 dark:text-white/50"
          }`}
        >
          {lastMessage
            ? `${lastMessage.sender === me ? "You: " : ""}${lastMessage.body}`
            : "No messages yet."}
        </p>
      </div>

      {unread && (
        <span
          className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold tabular-nums text-white"
          aria-label={`${unreadCount} unread`}
        >
          {unreadCount}
        </span>
      )}
    </Link>
  );
}
