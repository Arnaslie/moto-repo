"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WheelIcon } from "@/components/icons";
import { NotificationPanel } from "@/components/NotificationPanel";
import { waitingSentence, waitingTotal, type Waiting } from "@moto/core/notifications";

/**
 * The wheel in the header cluster: lit when something's waiting, with a count
 * beside it. See ADR 0007.
 *
 * Was MessagesLink, which counted unread DMs and linked to /messages. It counts
 * everything waiting now, and opens a panel instead of navigating — activity
 * rows have nowhere else to go, since there is no /notifications page.
 *
 * It owns its counts after first paint but does not open at zero: the layout
 * renders the opening pair into the HTML, which is what stops the wheel
 * arriving dark and lighting a moment later.
 *
 * Only ever rendered for a signed-in rider, so the fetch always has a session.
 */

// Slower than the thread's 3s tick by design: this runs in every open tab, so
// it's the interval whose cost multiplies. A minute late to a badge is fine.
const POLL_MS = 20000;

/**
 * The last counts this tab saw, at module scope.
 *
 * Not for navigation — the app layout owns the header, so walking between pages
 * doesn't remount this. It's for the remounts that are left: login and signup
 * sit outside the app group, so signing in and landing on the feed builds a
 * fresh one. A ref wouldn't do it; a ref dies with the component that owns it.
 *
 * Kept with the handle it belongs to, so logging out and in as someone else
 * doesn't flash the last rider's counts at the new one.
 */
let lastSeen: { handle: string; waiting: Waiting } | null = null;

/** The fetch alone, with no setState in it, so both callers below can share it
 *  without tripping react-hooks/set-state-in-effect. */
async function fetchWaiting(handle: string): Promise<Waiting | null> {
  try {
    const res = await fetch("/api/unread");
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.unread !== "number" || typeof data.activity !== "number") return null;
    const next = { conversations: data.unread, activity: data.activity };
    // Written whether or not the caller is still mounted: navigating away
    // mid-flight is exactly when the answer is worth keeping.
    lastSeen = { handle, waiting: next };
    return next;
  } catch {
    return null; // transient — the next tick retries
  }
}

export function RiderTelltale({
  handle,
  initial,
}: {
  handle: string;
  initial: Waiting;
}) {
  // What this tab last saw wins over what the server rendered, when it's this
  // rider's. Both are current on a hard load — lastSeen is null there — but the
  // layout is cached on the client, so a header rebuilt from that cache can
  // carry counts from whenever the cache was filled.
  const [waiting, setWaiting] = useState<Waiting>(() =>
    lastSeen?.handle === handle ? lastSeen.waiting : initial,
  );
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // One detent per rise in the count, counted rather than flagged: the span is
  // remounted on the new value, because a CSS animation on a node that is
  // already there won't replay.
  const [detents, setDetents] = useState(0);
  const seenTotal = useRef(waitingTotal(waiting));

  const apply = useCallback((next: Waiting) => {
    setWaiting(next);
    // The wheel indexes when the number goes up, whichever half moved. A second
    // message in a conversation already waiting doesn't move it and shouldn't:
    // the badge doesn't move either, so there is nothing to point at.
    if (waitingTotal(next) > seenTotal.current) setDetents((d) => d + 1);
    seenTotal.current = waitingTotal(next);
  }, []);

  useEffect(() => {
    let active = true;
    async function tick() {
      const next = await fetchWaiting(handle);
      if (next && active) apply(next);
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [handle, apply]);

  // Escape lives here rather than in the panel because the wheel is where focus
  // goes back to, and this is what holds the ref. Outside-click stays in the
  // panel, which is the thing that knows what counts as outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Lets the panel drop the count the moment it marks something read, instead
  // of the wheel staying lit until the next 20s tick.
  const refresh = useCallback(async () => {
    const next = await fetchWaiting(handle);
    if (next) apply(next);
  }, [handle, apply]);

  // Stable, so the panel's outside-click listener isn't torn down and rebuilt
  // on every tick.
  const close = useCallback(() => setOpen(false), []);

  const total = waitingTotal(waiting);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        // The wheel keeps the header's text ramp in both states. Turning the
        // whole icon orange would paint over the stripe with the colour the
        // stripe is, and the stripe is the signal.
        className="flex items-center gap-1.5 font-medium text-black/70 transition-colors hover:text-orange-500 dark:text-white/70"
      >
        <span key={detents} className={detents > 0 ? "wheel-detent" : undefined}>
          <WheelIcon lit={total > 0} size={24} />
        </span>
        {total > 0 && (
          <span className="text-sm font-semibold tabular-nums text-orange-500">{total}</span>
        )}
        <span role="status" aria-live="polite" className="sr-only">
          {waitingSentence(waiting)}
        </span>
      </button>

      {open && (
        <NotificationPanel
          handle={handle}
          onClose={close}
          onRead={refresh}
        />
      )}
    </div>
  );
}
