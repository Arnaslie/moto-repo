import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { parseTitle } from "@moto/core/comms";
import { roomSelect, serializeRoom } from "@/lib/rooms";

// Both handlers are host-only. Shared so the 404-vs-403 split stays consistent:
// a closed room reads as gone, someone else's room reads as forbidden.
async function requireHostedRoom(id: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "You must be signed in." }, { status: 401 }) };
  }

  const room = await prisma.room.findUnique({
    where: { id },
    select: { id: true, hostId: true, closedAt: true },
  });
  if (!room || room.closedAt) {
    return { error: NextResponse.json({ error: "That room isn't open." }, { status: 404 }) };
  }
  if (room.hostId !== user.id) {
    return { error: NextResponse.json({ error: "That's not your room." }, { status: 403 }) };
  }

  return { room };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const found = await requireHostedRoom(id);
  if (found.error) return found.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = parseTitle((body as Record<string, unknown> | null)?.title);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const room = await prisma.room.update({
    where: { id },
    data: { title: parsed.value },
    select: roomSelect,
  });

  return NextResponse.json({ room: serializeRoom(room) });
}

// A close is a timestamp, not a delete: the row is what the chat scrollback
// will hang off later.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const found = await requireHostedRoom(id);
  if (found.error) return found.error;

  await prisma.room.update({ where: { id }, data: { closedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
