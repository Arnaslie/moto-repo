"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * The inbox link in the header cluster, with a count of threads waiting.
 *
 * It fetches its own count rather than taking one as a prop. SiteHeader is
 * mounted individually by every page in the app — there's no chrome in
 * layout.tsx — so a prop would mean threading an unread count through seven
 * call sites and seven server queries. Self-fetching is the RidersView
 * precedent, and it's what ADR 0001 settles on for the tell-tale that will
 * eventually sit next to this.
 *
 * Only ever rendered for a signed-in rider, so the fetch always has a session.
 */

// Slower than the thread's tick by design: this runs in every open tab, so it's
// the interval whose cost multiplies. A minute late to a badge is fine; the
// thread you're actually watching updates in three seconds.
const POLL_MS = 20000;

export function MessagesLink() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/messages/unread");
        if (!res.ok) return;
        const data = await res.json();
        if (active && typeof data.unread === "number") setUnread(data.unread);
      } catch {
        /* transient — the next tick retries */
      }
    }

    // Once now, then on the tick: the badge has to be right when the page
    // loads, not twenty seconds later.
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <Link
      href="/messages"
      className={`flex items-center gap-1.5 font-medium transition-colors hover:text-orange-500 ${
        unread > 0 ? "text-orange-500" : "text-black/70 dark:text-white/70"
      }`}
    >
      Messages
      {unread > 0 && (
        <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-xs font-semibold tabular-nums leading-none text-white">
          {unread}
        </span>
      )}
      {/* The count is a number in a pill; this is what says what it counts. */}
      <span role="status" aria-live="polite" className="sr-only">
        {unread > 0 ? `${unread} conversation${unread === 1 ? "" : "s"} waiting` : ""}
      </span>
    </Link>
  );
}
