import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseMessageInput } from "@moto/core/messages";
import { messageSelect, serializeMessage } from "@/lib/conversations";
import { requireParticipant } from "@/lib/thread";

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

  // One transaction: a message that lands without moving the thread up the
  // recipient's inbox, or without counting as unread, is invisible.
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId: id, senderId, body: parsed.value.body },
      select: messageSelect,
    }),
    prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    }),
    // `updateMany` rather than a targeted update, so this keeps working
    // unchanged if a thread ever holds more than two participants.
    prisma.participant.updateMany({
      where: { conversationId: id, userId: { not: senderId } },
      data: { unreadCount: { increment: 1 } },
    }),
    // Sending is reading: without this, replying to something you never opened
    // leaves your inbox showing unread mail you've already answered.
    prisma.participant.update({
      where: { id: found.participantId },
      data: { unreadCount: 0, lastReadAt: new Date() },
    }),
  ]);

  return NextResponse.json({ message: serializeMessage(message) }, { status: 201 });
}
