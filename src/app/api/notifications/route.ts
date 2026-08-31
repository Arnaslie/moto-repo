import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { excerpt, isNotificationType, type NotificationDTO } from "@/lib/notifications";

const PAGE_SIZE = 20;

// select, never include: `include: { actor: true }` would carry the actor's
// email and bcrypt hash into a payload bound for a client component's props.
const notificationSelect = {
  id: true,
  type: true,
  postId: true,
  commentId: true,
  createdAt: true,
  readAt: true,
  actor: { select: { handle: true, displayName: true } },
  comment: { select: { content: true } },
} as const;

type Row = {
  id: string;
  type: string;
  postId: string | null;
  commentId: string | null;
  createdAt: Date;
  readAt: Date | null;
  actor: { handle: string; displayName: string | null };
  comment: { content: string } | null;
};

// Null for a type this build doesn't know, so a row written by a later branch
// is skipped rather than crashing the panel.
function serialize(row: Row): NotificationDTO | null {
  if (!isNotificationType(row.type)) return null;
  return {
    id: row.id,
    type: row.type,
    actor: row.actor.handle,
    actorDisplayName: row.actor.displayName,
    postId: row.postId,
    commentId: row.commentId,
    quote: row.comment ? excerpt(row.comment.content) : null,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  };
}

// GET /api/notifications — newest first; ?before=<ISO> pages down the
// (recipientId, createdAt) index.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("before");
  let before: Date | undefined;
  if (raw !== null) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
    }
    before = parsed;
  }

  // Exclusive (lt), unlike the thread's inclusive cursor: that one can't afford
  // to drop a message, this one can't afford to repeat a row already scrolled
  // past. A millisecond tie costs a skipped panel row, not a lost message.
  const rows = await prisma.notification.findMany({
    where: { recipientId: user.id, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    select: notificationSelect,
  });

  return NextResponse.json({
    notifications: rows.map(serialize).filter((n): n is NotificationDTO => n !== null),
  });
}
