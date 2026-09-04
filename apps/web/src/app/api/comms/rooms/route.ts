import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { parseOpenRoomInput } from "@moto/core/comms";
import { liveRoomsQuery, roomSelect, serializeRoom } from "@/lib/rooms";

// Deliberately readable signed out: the room list is a signup prompt, and
// titles are public. Joining is what's gated, not looking.
export async function GET() {
  const rooms = await prisma.room.findMany(liveRoomsQuery);
  return NextResponse.json({ rooms: rooms.map(serializeRoom) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = parseOpenRoomInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // One open room per host: a host is one person with one mic, so a second room
  // could only be an abandoned one.
  const existing = await alreadyHosting(user.id);
  if (existing) return existing;

  try {
    const room = await prisma.room.create({
      data: { ...parsed.value, hostId: user.id },
      select: roomSelect,
    });
    return NextResponse.json({ room: serializeRoom(room) }, { status: 201 });
  } catch (error) {
    // The check above can't be the guarantee: it's a separate round trip, and
    // two requests that read it before either writes both pass. A transaction
    // wouldn't help — under Read Committed both still see no row. The partial
    // unique index in the migration is the real enforcement; this turns its
    // violation back into the same answer the check would have given.
    if (!isUniqueViolation(error)) throw error;
    return (await alreadyHosting(user.id)) ?? conflict(null);
  }
}

// Not a refusal but a redirect: the client reads `roomId` off this 409 and
// walks them into the room they already have.
function conflict(roomId: string | null) {
  return NextResponse.json(
    { error: "You've already got a room open.", roomId },
    { status: 409 },
  );
}

async function alreadyHosting(hostId: string) {
  const existing = await prisma.room.findFirst({
    where: { hostId, closedAt: null },
    select: { id: true },
  });
  return existing ? conflict(existing.id) : null;
}

// Checked structurally rather than by importing PrismaClientKnownRequestError
// from the generated runtime, which is a deep import that moves between versions.
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
