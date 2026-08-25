"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The way into a thread, on someone's profile.
 *
 * There's no "new message" screen anywhere in the app, and deliberately so: a
 * DM here starts from a *rider* — someone whose bike you just looked at — not
 * from a compose box asking who you'd like to write to. That's also why this
 * doesn't ask for a first line. It opens the thread and lands you in it, empty,
 * which is the same place you'd be if they'd written to you first.
 *
 * Starting a thread is idempotent server-side, so pressing this on a profile
 * you've already written to walks you back into the conversation you have
 * rather than making a second one.
 */
export function MessageButton({ handle }: { handle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't open that thread.");
      router.push(`/messages/${data.conversation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that thread.");
      setBusy(false);
    }
    // No setBusy(false) on success — the navigation is the end of this
    // component's life, and re-enabling the button first just invites a second
    // press while the route loads.
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="mt-3 rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
      >
        {busy ? "Opening…" : `Message @${handle}`}
      </button>
      {error && (
        <p role="status" aria-live="polite" className="mt-2 text-sm text-rose-500">
          {error}
        </p>
      )}
    </>
  );
}
