import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// GET /api/unread — everything waiting for a rider, in one answer.
//
// Moved here from /api/messages/unread when it stopped being about messages
// (ADR 0007). Deliberately the cheapest route in the app: it runs on a timer in
// every open tab, so its cost is the one that multiplies.
//
// The two halves are counted differently on purpose. `unread` counts
// *conversations*, not messages — forty messages from one rider is one
// conversation waiting for you, and a badge reading "40" says something untrue
// about how much there is to deal with. `activity` counts notification rows,
// because a wave and a comment are genuinely two things. The wheel shows the
// sum; see Participant.unreadCount and the Notification model.
//
// One $transaction rather than two awaits or a Promise.all: the array form
// batches both counts into a single round trip. Two polls on the same timer
// would cost twice this and could disagree with each other between ticks.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const [waiting, activity] = await prisma.$transaction([
    prisma.participant.findMany({
      where: { userId: user.id, unreadCount: { gt: 0 } },
      select: { conversationId: true, unreadCount: true },
    }),
    prisma.notification.count({
      where: { recipientId: user.id, readAt: null },
    }),
  ]);

  // Field names are 0001's `snapshot` payload, kept verbatim through 0003 and
  // 0007. `conversations` rides along so the inbox can show per-thread counts
  // without a second call.
  return NextResponse.json({
    unread: waiting.length,
    conversations: waiting.map((p) => ({
      id: p.conversationId,
      unreadCount: p.unreadCount,
    })),
    activity,
  });
}
