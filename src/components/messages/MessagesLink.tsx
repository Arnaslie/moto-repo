"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WheelIcon } from "@/components/icons";

/**
 * The inbox link in the header cluster: the wheel, lit when something's
 * waiting, with a count beside it.
 *
 * It owns its count after first paint — polling for it, per ADR 0001 and the
 * RidersView precedent — but it no longer opens at zero. The layout renders the
 * opening count into the HTML and hands it down. 0001 turned that down as a
 * prop through seven call sites; the layout made it one, and it's what stops
 * the wheel arriving dark on a hard load. When the notification layer lands,
 * the wheel keeps its place and widens its source from unread DMs to
 * everything waiting.
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
 * This used to carry the count across every navigation in the app, because
 * every page mounted its own header and tore this component down with it. The
 * layout owns the header now, so an in-app navigation doesn't remount anything
 * and there's nothing left to carry there.
 *
 * It stays for the remounts that are left: login and signup sit outside the
 * app group, so signing in and landing on the feed does build a fresh one, and
 * that's a common enough trip to be worth not blinking through. A ref still
 * wouldn't do it — a ref is destroyed with the component that owns it. Module
 * scope outlives a remount and lives as long as the tab.
 *
 * Kept with the handle it belongs to, so logging out and back in as someone
 * else doesn't flash the last rider's count at the new one before the first
 * fetch corrects it.
 */
let lastSeen: { handle: string; unread: number } | null = null;

export function MessagesLink({
  handle,
  initialUnread,
}: {
  handle: string;
  initialUnread: number;
}) {
  // What this tab last saw wins over what the server rendered, when it's this
  // rider's. Both are current on a hard load — lastSeen is null there — but the
  // layout is cached on the client, so a header rebuilt from that cache can
  // carry a count from whenever the cache was filled. The tab's own last answer
  // can't be older than that.
  const [unread, setUnread] = useState(() =>
    lastSeen?.handle === handle ? lastSeen.unread : initialUnread,
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
