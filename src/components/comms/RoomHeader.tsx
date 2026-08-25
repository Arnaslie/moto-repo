"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TITLE_MAX, topicLabel, type RoomSummary } from "@/lib/comms";
import { timeAgo } from "@/lib/format";

/* ---------------------------------------------------------------------------
   The strip at the top of a room: what this is, who's running it, and — if
   that's you — the two controls a host has before any audio exists.

   Retitling is here rather than in a settings screen because the title is the
   only thing advertising the room. A conversation that opens on carb sync ends
   up on rally routes, and a host who can't follow the drift has to close and
   reopen, which throws everyone out.
--------------------------------------------------------------------------- */

export function RoomHeader({ room, isHost }: { room: RoomSummary; isHost: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(room.title);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(room.title);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveTitle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/comms/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't rename the room.");
        return;
      }
      setTitle(data.room.title);
      setEditing(false);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function closeRoom() {
    setBusy(true);
    try {
      const res = await fetch(`/api/comms/rooms/${room.id}`, { method: "DELETE" });
      if (res.ok) router.push("/comms");
      else setError("Couldn't close the room.");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-black/10 px-4 py-4 dark:border-white/10">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full border border-black/15 px-2 py-0.5 font-medium text-black/60 dark:border-white/20 dark:text-white/60">
          {topicLabel(room.topic)}
        </span>
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          Live
        </span>
        <span className="text-black/40 dark:text-white/40">
          open {timeAgo(room.openedAt)}
        </span>
      </div>

      {editing ? (
        <form onSubmit={saveTitle} className="mt-2 flex flex-col gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={TITLE_MAX}
            autoFocus
            className="w-full rounded-2xl border border-black/15 bg-transparent px-4 py-2 text-base font-semibold outline-none focus:border-orange-500 dark:border-white/20"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-orange-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(title);
                setEditing(false);
                setError(null);
              }}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <h2 className="mt-1.5 text-lg font-bold leading-snug tracking-tight">{title}</h2>
      )}

      <p className="mt-1 text-sm text-black/50 dark:text-white/50">
        hosted by @{room.host}
        {room.hostDisplayName ? ` · ${room.hostDisplayName}` : ""}
      </p>

      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}

      {isHost && !editing && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-black/15 px-3 py-1 text-sm font-medium transition-colors hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
          >
            Retitle
          </button>
          <button
            type="button"
            onClick={closeRoom}
            disabled={busy}
            className="rounded-full border border-rose-500/40 px-3 py-1 text-sm font-medium text-rose-500 transition-colors hover:border-rose-500 disabled:opacity-50"
          >
            Close the room
          </button>
        </div>
      )}
    </div>
  );
}
