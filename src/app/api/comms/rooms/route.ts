import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { parseOpenRoomInput } from "@/lib/comms";
import { liveRoomsQuery, roomSelect, serializeRoom } from "@/lib/rooms";

// GET /api/comms/rooms — every room that's currently open, newest first.
//
// Deliberately readable signed out: you can see what's being talked about, you
// just can't open the door. A live directory is the best signup prompt the app
// has, and titles are public by nature.
export async function GET() {
  const rooms = await prisma.room.findMany(liveRoomsQuery);
  return NextResponse.json({ rooms: rooms.map(serializeRoom) });
}

// POST /api/comms/rooms — open a room. You become its host, which is also how
// you take the first mic seat.
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

  // One open room per host. A host is one person with one mic — two rooms at
  // once would mean abandoning one of them, and abandoned rooms are the exact
  // thing host-created rooms exist to avoid. Send them back to the one they've
  // already got rather than refusing outright.
  const existing = await prisma.room.findFirst({
    where: { hostId: user.id, closedAt: null },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You've already got a room open.", roomId: existing.id },
      { status: 409 },
    );
  }

  const room = await prisma.room.create({
    data: { ...parsed.value, hostId: user.id },
    select: roomSelect,
  });

  return NextResponse.json({ room: serializeRoom(room) }, { status: 201 });
}
