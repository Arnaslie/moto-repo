import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// GET /api/messages/unread — what the header badge polls.
//
// Deliberately the cheapest thing in the app: two small reads against
// Participant, no join to Message, no conversation bodies. It runs on a timer
// in every open tab, so its cost is the one that multiplies.
//
// `unread` counts *conversations*, not messages. Forty messages from one rider
// is one conversation waiting for you, and a badge reading "40" says something
// untrue about how much there is to deal with. The per-conversation counts ride
// along so the inbox can show them without a second call.
//
// The payload matches the `snapshot` event ADR 0001 specifies for the SSE
// stream — same field names, same shape. When the stream lands, this becomes
// the fallback rather than something to rewrite.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const waiting = await prisma.participant.findMany({
    where: { userId: user.id, unreadCount: { gt: 0 } },
    select: { conversationId: true, unreadCount: true },
  });

  return NextResponse.json({
    unread: waiting.length,
    conversations: waiting.map((p) => ({
      id: p.conversationId,
      unreadCount: p.unreadCount,
    })),
  });
}
