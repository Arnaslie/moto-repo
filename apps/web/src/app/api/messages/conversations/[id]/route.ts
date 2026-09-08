import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  conversationSelect,
  serializeConversation,
  serializeMessage,
  threadMessagesQuery,
} from "@/lib/conversations";
import { requireParticipant } from "@/lib/thread";

// One shape for two callers: without `?after=` the page load gets the whole
// thread, with it the poll gets only what's arrived since. A separate "new
// messages" route would be this same query under a different name.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const found = await requireParticipant(id);
  if (found.error) return found.error;

  const afterParam = request.nextUrl.searchParams.get("after");
  const after = afterParam ? new Date(afterParam) : null;
  if (after && Number.isNaN(after.getTime())) {
    return NextResponse.json({ error: "Invalid `after` timestamp." }, { status: 400 });
  }

  const [conversation, messages] = await Promise.all([
    prisma.conversation.findUnique({ where: { id }, select: conversationSelect }),
    prisma.message.findMany(threadMessagesQuery(id, after)),
  ]);

  // Unreachable — requireParticipant just read this row — but a non-null
  // assertion here would be a lie waiting to come true.
  if (!conversation) {
    return NextResponse.json(
      { error: "That conversation doesn't exist." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    conversation: serializeConversation(conversation, found.user.id),
    messages: messages.map(serializeMessage),
  });
}
