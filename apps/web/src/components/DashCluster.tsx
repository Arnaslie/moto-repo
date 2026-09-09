"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OdometerLink } from "@/components/OdometerLink";
import { RiderTelltale } from "@/components/RiderTelltale";
import type { Waiting } from "@moto/core/notifications";
import { onUnreadChanged } from "@/lib/unread-signal";

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

export function DashCluster({
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

  // One detent per rise, counted rather than flagged: the span is remounted on
  // the new value, because a CSS animation on a node that is already there
  // won't replay.
  const [detents, setDetents] = useState(0);
  const seenActivity = useRef(waiting.activity);

  const apply = useCallback((next: Waiting) => {
    setWaiting(next);
    if (next.activity > seenActivity.current) setDetents((d) => d + 1);
    seenActivity.current = next.activity;
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

  // Lets anything that clears a count say so, instead of the instruments
  // staying lit until the next 20s tick.
  const refresh = useCallback(async () => {
    const next = await fetchWaiting(handle);
    if (next) apply(next);
  }, [handle, apply]);

  useEffect(() => onUnreadChanged(refresh), [refresh]);

  return (
    <div className="flex items-center gap-2.5">
      <OdometerLink count={waiting.conversations} />
      <RiderTelltale handle={handle} activity={waiting.activity} detents={detents} />
    </div>
  );
}
