"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  markNotificationsRead,
  notificationHref,
  notificationLine,
  notificationSentence,
  type NotificationDTO,
} from "@moto/core/notifications";
import { announceUnreadChanged } from "@/lib/unread-signal";

/**
 * The dropdown under the wheel: waves and comments, newest first.
 *
 * Mail used to be listed here too, because the badge counted both. ADR 0012
 * gave messages their own instrument, so the wheel counts activity alone and
 * this panel shows only what the wheel is counting.
 */

export function NotificationPanel({
  handle,
  onClose,
}: {
  handle: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationDTO[] | null>(null);
  // Null once there is nothing older. The route says so rather than the panel
  // guessing from a short page, which would mean knowing the server's page size.
  const [cursor, setCursor] = useState<string | null>(null);
  const [paging, setPaging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/notifications");
        const a = res.ok ? await res.json() : { notifications: [], nextCursor: null };
        if (!active) return;
        setNotifications(a.notifications ?? []);
        setCursor(a.nextCursor ?? null);
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

  const rows = notifications;

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
      announceUnreadChanged();
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
              Waves and comments land here.
            </p>
          </div>
        ) : (
          <>
            <ul>
              {rows.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openActivity(n)}
                    // The row's text is assembled from parts so the handle can
                    // be weighted; the label is the same row as one sentence.
                    aria-label={`${n.readAt ? "" : "Unread. "}${notificationSentence(n)}`}
                    className={rowClass}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        n.readAt ? "bg-transparent" : "bg-orange-500"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="font-medium">@{n.actor}</span>{" "}
                      {notificationLine(n).did}
                      {n.quote && (
                        <span className="block truncate text-black/50 dark:text-white/50">
                          {n.quote}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
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

      {rows?.some((n) => !n.readAt) && (
        <div className="flex items-center justify-end border-t border-black/10 px-3 py-2 text-sm dark:border-white/15">
          <button
            type="button"
            onClick={() => markRead()}
            className="text-black/50 hover:text-orange-500 dark:text-white/50"
          >
            Mark all read
          </button>
        </div>
      )}
    </div>
  );
}
