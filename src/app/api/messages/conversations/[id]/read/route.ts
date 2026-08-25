import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireParticipant } from "@/lib/thread";

// POST /api/messages/conversations/[id]/read — mark the thread read.
//
// Only ever your own side of it: `participantId` comes from the guard, which
// resolved it from the session, so there's no id in the request body that could
// point at somebody else's read state.
//
// Fired when the thread mounts and again as messages arrive while it's open.
// That makes repeat calls the normal case rather than an edge case, which is
// why this is an idempotent write to a fixed value instead of a decrement.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const found = await requireParticipant(id);
  if (found.error) return found.error;

  await prisma.participant.update({
    where: { id: found.participantId },
    data: { unreadCount: 0, lastReadAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
