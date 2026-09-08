import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireParticipant } from "@/lib/thread";

// Only ever your own side of the thread: `participantId` comes from the guard,
// which resolves it from the session, so no id in the request can point at
// somebody else's read state.
//
// The client fires this on mount and again on every message that arrives while
// the thread is open, so repeat calls are the normal case — hence an idempotent
// write to a fixed value rather than a decrement.
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
