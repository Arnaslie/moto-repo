import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { RoomHeader } from "@/components/comms/RoomHeader";
import { roomSelect, serializeRoom } from "@/lib/rooms";
import { SEATS, topicLabel } from "@moto/core/comms";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Login rather than 404: a room link shared into a group chat is how rooms
  // fill, so signing in has to land them in the room they followed.
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/comms/${id}`)}`);

  const room = await prisma.room.findUnique({
    where: { id },
    select: { ...roomSelect, closedAt: true, hostId: true },
  });
  if (!room) notFound();

  if (room.closedAt) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="text-base font-semibold">That room has closed.</p>
        <p className="mt-2 text-sm text-black/50 dark:text-white/50">
          Rooms end when their host does. Something else might be running.
        </p>
        <Link
          href="/comms"
          className="mt-5 inline-flex rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
        >
          Back to Comms
        </Link>
      </div>
    );
  }

  const isHost = room.hostId === user.id;

  return (
    <>
      <RoomHeader room={serializeRoom(room)} isHost={isHost} />

      {/* The floor, the pack and the chat land here in the next steps. Showing
          the seats now — empty and labelled — is more honest than an empty page,
          and it's the layout the rest gets built into. */}
      <div className="px-4 py-5">
        <p className="text-xs font-medium uppercase tracking-wider text-black/40 dark:text-white/40">
          The floor · {SEATS} seats
        </p>
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {Array.from({ length: SEATS }, (_, i) => (
            <li
              key={i}
              className={`flex aspect-square items-center justify-center rounded-2xl border text-xs ${
                i === 0
                  ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                  : "border-dashed border-black/15 text-black/30 dark:border-white/20 dark:text-white/30"
              }`}
            >
              {i === 0 ? `@${room.host.handle}` : "open"}
            </li>
          ))}
        </ul>
        <p className="mt-6 rounded-2xl border border-black/10 px-4 py-6 text-center text-sm text-black/50 dark:border-white/10 dark:text-white/50">
          Voice isn&apos;t wired up yet — this room is {topicLabel(room.topic)} and it exists,
          which is as far as step one goes.
        </p>
      </div>
    </>
  );
}
