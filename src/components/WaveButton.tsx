"use client";

import { useState } from "react";
import Link from "next/link";
import { ANONYMOUS_WAVES_ENABLED } from "@/lib/waves";
import { WaveIcon } from "./icons";

// Shared between the real button and the signed-out link so the two are
// indistinguishable until you press them.
const SHELL =
  "group flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm tabular-nums transition-colors";

export function WaveButton({
  postId,
  waveCount,
  waved: initialWaved,
  currentUser,
}: {
  postId: string;
  waveCount: number;
  waved: boolean;
  currentUser: { handle: string } | null;
}) {
  const [waved, setWaved] = useState(initialWaved);
  const [count, setCount] = useState(waveCount);
  const [busy, setBusy] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed-out riders still see the tally. Normally they get sent to sign in;
  // while anonymous waves are on they wave like everyone else, under a guest id
  // the server keeps in a cookie.
  if (!currentUser && !ANONYMOUS_WAVES_ENABLED) {
    return (
      <Link
        href="/login"
        aria-label={`Sign in to wave. ${count} ${count === 1 ? "wave" : "waves"}.`}
        className={`${SHELL} text-black/60 hover:bg-orange-500/10 hover:text-orange-500 dark:text-white/60`}
      >
        <WaveIcon filled={false} />
        {count > 0 && <span>{count}</span>}
      </Link>
    );
  }

  async function toggle() {
    if (busy) return;

    const next = !waved;
    setBusy(true);
    setError(null);

    setWaved(next);
    setCount((n) => n + (next ? 1 : -1));
    if (next) setCelebrating(true);

    try {
      const res = await fetch(`/api/posts/${postId}/waves`, {
        method: next ? "POST" : "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't send that wave.");
      // Adopt the server's tally — it also counts everyone else's waves.
      setWaved(data.waved as boolean);
      setCount(data.waveCount as number);
    } catch (err) {
      setWaved(!next);
      setCount((n) => n + (next ? -1 : 1));
      setError(err instanceof Error ? err.message : "Couldn't send that wave.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={waved}
        aria-label={`Wave at this post. ${count} ${count === 1 ? "wave" : "waves"}.`}
        title={error ?? (waved ? "Take your wave back" : "Wave at this post")}
        className={`${SHELL} ${
          waved
            ? "font-semibold text-orange-500"
            : "text-black/60 hover:bg-orange-500/10 hover:text-orange-500 dark:text-white/60"
        }`}
      >
        <span
          // The hand tips left, then right, then settles — the wave itself.
          className={celebrating ? "wave-salute" : undefined}
          onAnimationEnd={() => setCelebrating(false)}
        >
          <WaveIcon filled={waved} />
        </span>
        {count > 0 && <span>{count}</span>}
      </button>
      {/* Failures roll the count back on their own; this is so a screen reader
          hears why the number moved. */}
      <span role="status" aria-live="polite" className="sr-only">
        {error ?? ""}
      </span>
    </>
  );
}
