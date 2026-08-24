import type { RoomSummary } from "./comms";

// Prisma `select` for loading a room together with its host. Shared so every
// query that feeds serializeRoom() selects the same shape.
export const roomSelect = {
  id: true,
  title: true,
  topic: true,
  openedAt: true,
  host: { select: { handle: true, displayName: true } },
} as const;

// The subset of a row the serializer needs, structural so callers can pass
// Prisma results straight in.
type RoomRow = {
  id: string;
  title: string;
  topic: string;
  openedAt: Date;
  host: { handle: string; displayName: string | null };
};

export function serializeRoom(room: RoomRow): RoomSummary {
  return {
    id: room.id,
    title: room.title,
    topic: room.topic,
    host: room.host.handle,
    hostDisplayName: room.host.displayName,
    openedAt: room.openedAt.toISOString(),
    // Occupancy is LiveKit's answer, not ours — it's the set of participants
    // the SFU is holding, and any copy we kept here could only drift from it.
    // Null until the room is wired to the SFU; rendering a fake 0 would make a
    // busy room look dead.
    listening: null,
    seatsTaken: null,
  };
}

/** Live rooms, newest first — the directory's one query. */
export const liveRoomsQuery = {
  where: { closedAt: null },
  orderBy: { openedAt: "desc" },
  select: roomSelect,
} as const;
