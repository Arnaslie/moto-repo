import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// The header badge polls this on a timer in every open tab, so keep it to reads
// against Participant — no join to Message, no conversation bodies.
//
// `unread` counts *conversations*, not messages: a badge reading "40" for forty
// messages from one rider says something untrue about how much is waiting.
//
// Payload shape follows ADR 0001's `snapshot` event; see also ADR 0007.
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
