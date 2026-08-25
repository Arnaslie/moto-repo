import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// The one guard every thread route runs, kept here rather than inline because
// three separate route files need it and a duplicated access check is a check
// that drifts. (comms/rooms/[id] keeps its equivalent inline — it can, because
// both its handlers live in one file.)
//
// The order matters and is the house order: signed out is a 401, a thread that
// doesn't exist is a 404, and a thread that exists but isn't yours is a 403.
//
// One deliberate exception to that: a conversation you're not part of answers
// **404, not 403**. Elsewhere in the app a 403 is safe — you already know the
// room exists, you just don't host it. Here the id *is* the private thing: a
// 403 would confirm that a given conversation exists, which is exactly what
// someone probing ids wants to learn. Not yours reads as not there.
export async function requireParticipant(conversationId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "You must be signed in." }, { status: 401 }),
    };
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      participants: { select: { id: true, userId: true } },
    },
  });

  const mine = conversation?.participants.find((p) => p.userId === user.id);
  if (!conversation || !mine) {
    return {
      error: NextResponse.json(
        { error: "That conversation doesn't exist." },
        { status: 404 },
      ),
    };
  }

  return { user, conversation, participantId: mine.id };
}
