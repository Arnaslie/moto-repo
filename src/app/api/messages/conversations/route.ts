import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { pairKey, parseStartConversationInput } from "@/lib/messages";
import { conversationSelect, inboxQuery, serializeConversation } from "@/lib/conversations";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany(inboxQuery(user.id));
  return NextResponse.json({
    conversations: conversations.map((c) => serializeConversation(c, user.id)),
  });
}

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

  const parsed = parseStartConversationInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const other = await prisma.user.findUnique({
    where: { handle: parsed.value.handle },
    select: { id: true },
  });
  if (!other) {
    return NextResponse.json({ error: "No rider with that handle." }, { status: 404 });
  }
  if (other.id === user.id) {
    // Not a 403 — nothing is forbidden here, it's just not a conversation.
    return NextResponse.json(
      { error: "You can't message yourself." },
      { status: 400 },
    );
  }

  const key = pairKey(user.id, other.id);

  const existing = await prisma.conversation.findUnique({
    where: { pairKey: key },
    select: conversationSelect,
  });
  if (existing) {
    return NextResponse.json({ conversation: serializeConversation(existing, user.id) });
  }

  try {
    // Both participant rows are nested into the one statement: a thread with
    // only one side in it is a thread nobody can reply to.
    const conversation = await prisma.conversation.create({
      data: {
        pairKey: key,
        participants: { create: [{ userId: user.id }, { userId: other.id }] },
      },
      select: conversationSelect,
    });
    return NextResponse.json(
      { conversation: serializeConversation(conversation, user.id) },
      { status: 201 },
    );
  } catch (error) {
    // The lookup above can't be the guarantee: it's a separate round trip, so
    // two requests that both read "no thread yet" fall through to here. The
    // unique index on pairKey is the real enforcement; this turns its violation
    // back into the answer the lookup would have given. Same shape as the
    // one-open-room-per-host handling in api/comms/rooms.
    if (!isUniqueViolation(error)) throw error;

    const raced = await prisma.conversation.findUnique({
      where: { pairKey: key },
      select: conversationSelect,
    });
    if (!raced) throw error;
    return NextResponse.json({ conversation: serializeConversation(raced, user.id) });
  }
}

// Checked structurally rather than by importing PrismaClientKnownRequestError
// from the generated runtime — a deep import that moves between versions.
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
