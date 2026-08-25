import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { pairKey, parseStartConversationInput } from "@/lib/messages";
import { conversationSelect, inboxQuery, serializeConversation } from "@/lib/conversations";

// GET /api/messages/conversations — the inbox.
//
// Private, unlike the Comms directory: that one is readable signed out because
// a live room list is the best signup prompt the app has. There is no such
// argument for someone else's mail.
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

// POST /api/messages/conversations — open a thread with a rider, by handle.
//
// Idempotent by design: you can't have two threads with the same person, so
// pressing Message on a profile you've already written to walks you back into
// the conversation you've got. 201 when it's new, 200 when it already existed —
// the client doesn't care, but the distinction is free and it's what tells you
// which happened when you're reading logs.
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
    // Both participant rows are created with the conversation, in one
    // statement — a thread with one side in it is a thread nobody can reply to.
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
    // two requests that both read "no thread yet" both fall through to here.
    // (Both directions race too — A pressing Message on B's profile at the same
    // moment B presses it on A's produce the same pairKey, which is the point
    // of sorting it.) The unique index is the real enforcement; this turns its
    // violation back into the answer the lookup would have given. Same shape as
    // the one-open-room-per-host handling in api/comms/rooms.
    if (!isUniqueViolation(error)) throw error;

    const raced = await prisma.conversation.findUnique({
      where: { pairKey: key },
      select: conversationSelect,
    });
    if (!raced) throw error;
    return NextResponse.json({ conversation: serializeConversation(raced, user.id) });
  }
}

// Prisma's unique-constraint code, checked structurally rather than by
// importing PrismaClientKnownRequestError from the generated runtime — a deep
// import that moves between versions. (Same helper as api/comms/rooms.)
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
