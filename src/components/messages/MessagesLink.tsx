"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WheelIcon } from "@/components/icons";

/**
 * The inbox link in the header cluster: the wheel, lit when something's
 * waiting, with a count beside it.
 *
 * It fetches its own count rather than taking one as a prop. SiteHeader is
 * mounted individually by every page in the app — there's no chrome in
 * layout.tsx — so a prop would mean threading an unread count through seven
 * call sites and seven server queries. Self-fetching is the RidersView
 * precedent, and it's what ADR 0001 settles on for the tell-tale this is
 * standing in for. When the notification layer lands, the wheel keeps its
 * place and widens its source from unread DMs to everything waiting.
 *
 * Only ever rendered for a signed-in rider, so the fetch always has a session.
 */

// Slower than the thread's tick by design: this runs in every open tab, so it's
// the interval whose cost multiplies. A minute late to a badge is fine; the
// thread you're actually watching updates in three seconds.
const POLL_MS = 20000;

/**
 * The last count this tab saw, kept at module scope.
 *
 * Every page mounts its own SiteHeader, so walking the drivetrain from one page
 * to the next unmounts this component and mounts a fresh one. Starting that new
 * one at zero puts the wheel out for as long as the fetch takes, and the ride
 * through the nav is a wheel going dark and lighting again at every stop.
 *
 * A ref wouldn't help — it's destroyed with the component it belongs to. Module
 * scope is what outlives a remount, and it lives as long as the tab does.
 *
 * Kept with the handle it belongs to, so logging out and back in as someone
 * else doesn't flash the last rider's count at the new one before the first
 * fetch corrects it.
 */
let lastSeen: { handle: string; unread: number } | null = null;

export function MessagesLink({ handle }: { handle: string }) {
  const [unread, setUnread] = useState(() =>
    lastSeen?.handle === handle ? lastSeen.unread : 0,
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/messages/unread");
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.unread !== "number") return;
        // Written whether or not this component is still mounted: navigating
        // away mid-flight is exactly when the answer is worth keeping.
        lastSeen = { handle, unread: data.unread };
        if (active) setUnread(data.unread);
      } catch {
        /* transient — the next tick retries */
      }
    }

    // Once now, then on the tick. The seeded count above is what the wheel
    // shows in the meantime, so this is correcting a value rather than filling
    // in a blank.
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [handle]);

  return (
    <Link
      href="/messages"
      aria-label="Messages"
      // The wheel keeps the header's text ramp in both states. Turning the
      // whole icon orange would paint over the stripe with the same colour the
      // stripe is, which is the one thing that mustn't happen — the stripe is
      // the signal.
      className="flex items-center gap-1.5 font-medium text-black/70 transition-colors hover:text-orange-500 dark:text-white/70"
    >
      <WheelIcon lit={unread > 0} size={24} />
      {/* Beside the wheel, not on it: the stripe says something's waiting, the
          number says how much. */}
      {unread > 0 && (
        <span className="text-sm font-semibold tabular-nums text-orange-500">{unread}</span>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {unread > 0 ? `${unread} conversation${unread === 1 ? "" : "s"} waiting` : ""}
      </span>
    </Link>
  );
}
