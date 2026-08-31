import type { RoomSummary } from "./comms";

// Shared so every query that feeds serializeRoom() selects the same shape.
export const roomSelect = {
  id: true,
  title: true,
  topic: true,
  openedAt: true,
  host: { select: { handle: true, displayName: true } },
} as const;

// Structural, so callers can pass Prisma results straight in.
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
    // Occupancy is LiveKit's answer, not ours — any copy kept here could only
    // drift from the SFU's. Null until the room is wired up; a fake 0 would
    // make a busy room look dead.
    listening: null,
    seatsTaken: null,
  };
}

export const liveRoomsQuery = {
  where: { closedAt: null },
  orderBy: { openedAt: "desc" },
  select: roomSelect,
} as const;
