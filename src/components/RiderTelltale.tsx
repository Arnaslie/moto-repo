"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WheelIcon } from "@/components/icons";
import { waitingSentence, waitingTotal, type Waiting } from "@/lib/notifications";

/**
 * The wheel in the header cluster: lit when something's waiting, with a count
 * beside it. See ADR 0007.
 *
 * Was MessagesLink, which counted unread DMs. It now counts everything waiting
 * — mail plus waves and comments — which is the widening its own comment
 * anticipated. Still a link to /messages; the panel that gives activity rows
 * somewhere of their own is step 6.
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

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/unread");
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.unread !== "number" || typeof data.activity !== "number") return;
        const next = { conversations: data.unread, activity: data.activity };
        // Written whether or not this component is still mounted: navigating
        // away mid-flight is exactly when the answer is worth keeping.
        lastSeen = { handle, waiting: next };
        if (active) setWaiting(next);
      } catch {
        /* transient — the next tick retries */
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [handle]);

  const total = waitingTotal(waiting);

  return (
    <Link
      href="/messages"
      aria-label="Messages"
      // The wheel keeps the header's text ramp in both states. Turning the whole
      // icon orange would paint over the stripe with the colour the stripe is,
      // and the stripe is the signal.
      className="flex items-center gap-1.5 font-medium text-black/70 transition-colors hover:text-orange-500 dark:text-white/70"
    >
      <WheelIcon lit={total > 0} size={24} />
      {total > 0 && (
        <span className="text-sm font-semibold tabular-nums text-orange-500">{total}</span>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {waitingSentence(waiting)}
      </span>
    </Link>
  );
}
