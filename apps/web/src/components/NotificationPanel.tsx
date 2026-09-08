"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ConversationSummary } from "@moto/core/messages";
import {
  markNotificationsRead,
  notificationHref,
  notificationLine,
  notificationSentence,
  type NotificationDTO,
} from "@moto/core/notifications";

/**
 * The dropdown under the wheel (ADR 0007): activity and unread mail in one
 * list, newest first.
 *
 * Both have to be here because the badge counts both — a panel showing only
 * activity under a wheel reading 3 would be short two rows with no explanation.
 */

type Row =
  | { kind: "activity"; at: string; n: NotificationDTO }
  | { kind: "mail"; at: string; c: ConversationSummary };

function rowsFrom(
  notifications: NotificationDTO[],
  conversations: ConversationSummary[],
): Row[] {
  const rows: Row[] = [
    ...notifications.map((n) => ({ kind: "activity" as const, at: n.createdAt, n })),
    ...conversations
      .filter((c) => c.unreadCount > 0)
      .map((c) => ({ kind: "mail" as const, at: c.lastMessageAt, c })),
  ];
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

export function NotificationPanel({
  handle,
  onClose,
  onRead,
}: {
  handle: string;
  onClose: () => void;
  /** Lets the wheel drop its count without waiting for the next 20s tick. */
  onRead: () => void;
}) {
  const router = useRouter();
  // Held apart rather than merged once, because only the activity half pages:
  // mail is every unread conversation and arrives whole.
  const [notifications, setNotifications] = useState<NotificationDTO[] | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  // Null once there is nothing older. The route says so rather than the panel
  // guessing from a short page, which would mean knowing the server's page size.
  const [cursor, setCursor] = useState<string | null>(null);
  const [paging, setPaging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [a, m] = await Promise.all([
          fetch("/api/notifications").then((r) =>
            r.ok ? r.json() : { notifications: [], nextCursor: null },
          ),
          fetch("/api/messages/conversations").then((r) => (r.ok ? r.json() : { conversations: [] })),
        ]);
        if (!active) return;
        setNotifications(a.notifications ?? []);
        setCursor(a.nextCursor ?? null);
        setConversations(m.conversations ?? []);
      } catch {
        if (active) setNotifications([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function loadMore() {
    if (!cursor || paging) return;
    setPaging(true);
    try {
      const res = await fetch(`/api/notifications?before=${encodeURIComponent(cursor)}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications((prev) => [...(prev ?? []), ...(data.notifications ?? [])]);
        setCursor(data.nextCursor ?? null);
      }
    } catch {
      // The cursor is untouched, so the button is still there to try again.
    } finally {
      setPaging(false);
    }
  }

  const rows = notifications === null ? null : rowsFrom(notifications, conversations);

  // Same discipline the drivetrain uses, so the two don't fight: it closes on
  // any pointerdown outside its own panel, and this closes on any outside its.
  // Opening this one is a pointerdown outside that one, so the drivetrain shuts
  // on its own — nothing here has to reach across and close it.
  //
  // Escape is the wheel's, not this component's: it holds the button focus
  // returns to.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);

  async function markRead(ids?: string[]) {
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ids ? { ids } : {}),
      });
      // Only once the server has agreed. Stamping rows on a failed POST would
      // clear the dots and tell the reader something was read that wasn't.
      if (!res.ok) return;
      // The rows the panel is holding carry the readAt they were fetched with,
      // so without this the dots, the "Unread." in each label and the mark-all
      // button all stay as they were until the panel is reopened.
      setNotifications((prev) => (prev ? markNotificationsRead(prev, ids) : prev));
      onRead();
    } catch {
      /* the next tick corrects the count */
    }
  }

  async function openActivity(n: NotificationDTO) {
    if (!n.readAt) await markRead([n.id]);
    onClose();
    router.push(notificationHref(n, handle));
  }

  const rowClass =
    "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      // Above the sticky header's own z-[1000], or it renders behind the page
      // it is anchored to.
      className="absolute right-0 top-full z-[1001] mt-2 w-80 overflow-hidden rounded-xl border border-black/10 bg-background shadow-lg dark:border-white/15"
    >
      <div className="max-h-80 overflow-y-auto">
        {rows === null ? (
          <p className="px-3 py-4 text-sm text-black/40 dark:text-white/40">Looking…</p>
        ) : rows.length === 0 ? (
          // The normal state, not a fallback: most of the time nothing has
          // happened, and that should read as calm rather than broken.
          <div className="px-3 py-5">
            <p className="text-sm font-medium">Nothing waiting.</p>
            <p className="mt-1 text-sm text-black/50 dark:text-white/50">
              Waves, comments and messages land here.
            </p>
          </div>
        ) : (
          <>
            <ul>
              {rows.map((row) =>
                row.kind === "activity" ? (
                  <li key={`a:${row.n.id}`}>
                    <button
                      type="button"
                      onClick={() => openActivity(row.n)}
                      // The row's text is assembled from parts so the handle can
                      // be weighted; the label is the same row as one sentence.
                      aria-label={`${row.n.readAt ? "" : "Unread. "}${notificationSentence(row.n)}`}
                      className={rowClass}
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          row.n.readAt ? "bg-transparent" : "bg-orange-500"
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="font-medium">@{row.n.actor}</span>{" "}
                        {notificationLine(row.n).did}
                        {row.n.quote && (
                          <span className="block truncate text-black/50 dark:text-white/50">
                            {row.n.quote}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key={`m:${row.c.id}`}>
                    <Link
                      href={`/messages/${row.c.id}`}
                      onClick={onClose}
                      className={rowClass}
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500"
                      />
                      <span className="min-w-0">
                        <span className="font-medium">@{row.c.with.handle}</span>{" "}
                        sent{" "}
                        {row.c.unreadCount === 1 ? "a message" : `${row.c.unreadCount} messages`}
                        {row.c.lastMessage && (
                          <span className="block truncate text-black/50 dark:text-white/50">
                            {row.c.lastMessage.body}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ),
              )}
            </ul>
            {cursor && (
              <button
                type="button"
                onClick={loadMore}
                disabled={paging}
                className="w-full border-t border-black/5 px-3 py-2 text-left text-sm text-black/50 transition-colors hover:text-orange-500 disabled:opacity-50 dark:border-white/10 dark:text-white/50"
              >
                {paging ? "Loading…" : "Older"}
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-black/10 px-3 py-2 text-sm dark:border-white/15">
        <Link href="/messages" onClick={onClose} className="font-medium hover:text-orange-500">
          All messages
        </Link>
        {rows?.some((r) => r.kind === "activity" && !r.n.readAt) && (
          <button
            type="button"
            onClick={() => markRead()}
            className="text-black/50 hover:text-orange-500 dark:text-white/50"
          >
            Mark all read
          </button>
        )}
      </div>
    </div>
  );
}
