import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMessageInput } from "@/lib/messages";
import { messageSelect, serializeMessage } from "@/lib/conversations";
import { requireParticipant } from "@/lib/thread";

// POST /api/messages/conversations/[id]/messages — send a message.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const found = await requireParticipant(id);
  if (found.error) return found.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = parseMessageInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const senderId = found.user.id;

  // One transaction, because a message that lands without moving the thread to
  // the top of the recipient's inbox — or without counting as unread — is worse
  // than one that doesn't land at all: it's invisible, and nobody knows to look
  // for it.
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId: id, senderId, body: parsed.value.body },
      select: messageSelect,
    }),
    prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    }),
    // Everyone who isn't the sender. `updateMany` rather than a targeted update
    // so this keeps working unchanged if a thread ever holds more than two.
    prisma.participant.updateMany({
      where: { conversationId: id, userId: { not: senderId } },
      data: { unreadCount: { increment: 1 } },
    }),
    // Sending is reading: you were looking at the thread when you typed it, so
    // your own side clears. Without this, a reply to something you never opened
    // leaves your inbox showing unread mail you've already answered.
    prisma.participant.update({
      where: { id: found.participantId },
      data: { unreadCount: 0, lastReadAt: new Date() },
    }),
  ]);

  return NextResponse.json({ message: serializeMessage(message) }, { status: 201 });
}
