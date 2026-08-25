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

// GET /api/messages/conversations/[id] — a thread and its messages.
//
// Serves two callers with one shape. Without `?after=` it's the whole thread,
// which is what the page load wants; with it, only what's arrived since, which
// is what the poll wants. The alternative — a second "new messages" route —
// would be the same query with a different name.
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

  // requireParticipant just read this row, so it exists — but the type is
  // nullable and a non-null assertion here would be a lie waiting to be true.
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
