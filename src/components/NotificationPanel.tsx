"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ConversationSummary } from "@/lib/messages";
import {
  notificationHref,
  notificationLine,
  type NotificationDTO,
} from "@/lib/notifications";

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
  const [rows, setRows] = useState<Row[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [a, m] = await Promise.all([
          fetch("/api/notifications").then((r) => (r.ok ? r.json() : { notifications: [] })),
          fetch("/api/messages/conversations").then((r) => (r.ok ? r.json() : { conversations: [] })),
        ]);
        if (active) setRows(rowsFrom(a.notifications ?? [], m.conversations ?? []));
      } catch {
        if (active) setRows([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Same discipline the drivetrain uses, so the two don't fight: it closes on
  // any pointerdown outside its own panel, and this closes on any outside its.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function markRead(ids?: string[]) {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ids ? { ids } : {}),
      });
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
          rows.map((row) =>
            row.kind === "activity" ? (
              <button
                key={row.n.id}
                type="button"
                onClick={() => openActivity(row.n)}
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
            ) : (
              <Link
                key={row.c.id}
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
                  sent {row.c.unreadCount === 1 ? "a message" : `${row.c.unreadCount} messages`}
                  {row.c.lastMessage && (
                    <span className="block truncate text-black/50 dark:text-white/50">
                      {row.c.lastMessage.body}
                    </span>
                  )}
                </span>
              </Link>
            ),
          )
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
