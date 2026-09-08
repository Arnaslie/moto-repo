"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TOPICS, TITLE_MAX, SEATS, topicLabel, type TopicId } from "@moto/core/comms";
import type { RoomSummary } from "@moto/core/comms";
import { timeAgo } from "@moto/core/format";

const POLL_MS = 10000;

export function RoomDirectory({
  initialRooms,
  signedIn,
  hostedRoomId,
}: {
  initialRooms: RoomSummary[];
  signedIn: boolean;
  hostedRoomId: string | null;
}) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);
  const [opening, setOpening] = useState(false);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState<TopicId>("general");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Rooms come and go on the scale of minutes, so a slow poll is plenty — this
  // isn't the audio path, and there's no socket to hold on serverless anyway.
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/comms/rooms");
        const data = await res.json();
        if (active && Array.isArray(data.rooms)) setRooms(data.rooms);
      } catch {
        /* transient — the next tick retries */
      }
    }
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  async function openRoom(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/comms/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, topic }),
      });
      const data = await res.json();

      if (!res.ok) {
        // 409 means they already host a room — that's a redirect, not an error
        // worth reading.
        if (res.status === 409 && data.roomId) {
          router.push(`/comms/${data.roomId}`);
          return;
        }
        setError(data.error ?? "Couldn't open the room.");
        return;
      }

      router.push(`/comms/${data.room.id}`);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="border-b border-black/10 px-4 py-4 dark:border-white/10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">Comms</h2>
          <p className="text-sm text-black/50 dark:text-white/50">
            {rooms.length === 0
              ? "nothing live"
              : `${rooms.length} room${rooms.length === 1 ? "" : "s"} live`}
          </p>
        </div>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Voice rooms for when you&apos;re off the bike. {SEATS} on the mic, everyone else
          listening and typing.
        </p>

        {hostedRoomId ? (
          <Link
            href={`/comms/${hostedRoomId}`}
            className="mt-3 inline-flex rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Back to your room
          </Link>
        ) : signedIn ? (
          opening ? (
            <form onSubmit={openRoom} className="mt-3 flex flex-col gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you talking about?"
                maxLength={TITLE_MAX}
                autoFocus
                className="w-full rounded-2xl border border-black/15 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-white/20"
              />
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTopic(t.id)}
                    aria-pressed={topic === t.id}
                    title={t.blurb}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      topic === t.id
                        ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                        : "border-black/15 text-black/60 hover:border-black/30 dark:border-white/20 dark:text-white/60 dark:hover:border-white/40"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {error && <p className="text-sm text-rose-500">{error}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  {busy ? "Opening…" : "Open the room"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpening(false);
                    setError(null);
                  }}
                  className="rounded-full px-4 py-2 text-sm font-medium text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-black/40 dark:text-white/40">
                Opening a room puts you on the first mic. You can change the title while
                you&apos;re live.
              </p>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setOpening(true)}
              className="mt-3 rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              Start a conversation
            </button>
          )
        ) : (
          <p className="mt-3 text-sm text-black/50 dark:text-white/50">
            <Link
              href="/login?next=%2Fcomms"
              className="font-semibold text-orange-500 hover:underline"
            >
              Log in
            </Link>{" "}
            to listen in or start one of your own.
          </p>
        )}
      </div>

      {rooms.length === 0 ? (
        <EmptyDirectory signedIn={signedIn} onStart={() => setOpening(true)} />
      ) : (
        <ul>
          {rooms.map((room) => (
            <li key={room.id}>
              <RoomCard room={room} signedIn={signedIn} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyDirectory({ signedIn, onStart }: { signedIn: boolean; onStart: () => void }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-base font-semibold">Nobody&apos;s talking right now.</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-black/50 dark:text-white/50">
        Rooms don&apos;t sit here waiting — a rider opens one and whoever&apos;s around walks
        in. Old friends and new.
      </p>
      {signedIn ? (
        <button
          type="button"
          onClick={onStart}
          className="mt-5 rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
        >
          Be the one who starts it
        </button>
      ) : (
        <Link
          href="/signup"
          className="mt-5 inline-flex rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
        >
          Sign up to start one
        </Link>
      )}
    </div>
  );
}

function RoomCard({ room, signedIn }: { room: RoomSummary; signedIn: boolean }) {
  // Signed out the card reads but the door needs an account, so `next` carries
  // the room through the login and they land in it rather than on the feed.
  const href = signedIn
    ? `/comms/${room.id}`
    : `/login?next=${encodeURIComponent(`/comms/${room.id}`)}`;

  return (
    <Link
      href={href}
      className="block border-b border-black/10 px-4 py-4 transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]"
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full border border-black/15 px-2 py-0.5 font-medium text-black/60 dark:border-white/20 dark:text-white/60">
          {topicLabel(room.topic)}
        </span>
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          Live
        </span>
        <span className="text-black/40 dark:text-white/40">{timeAgo(room.openedAt)}</span>
      </div>
      <h3 className="mt-1.5 text-base font-semibold leading-snug tracking-tight">
        {room.title}
      </h3>
      <p className="mt-1 text-sm text-black/50 dark:text-white/50">
        hosted by @{room.host}
        {room.hostDisplayName ? ` · ${room.hostDisplayName}` : ""}
      </p>
    </Link>
  );
}
