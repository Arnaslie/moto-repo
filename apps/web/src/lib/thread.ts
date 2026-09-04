import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// The one guard every thread route runs, shared by three route files.
//
// House order is 401 signed out, 404 missing, 403 not yours — but a
// conversation you're not part of answers **404, not 403**, deliberately. Here
// the id *is* the private thing, and a 403 would confirm to someone probing ids
// that a given conversation exists.
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
