import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// POST /api/notifications/read — { ids } marks those, an omitted body marks all.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // No body is the mark-all case, not an error.
  }

  const { ids } = (body ?? {}) as { ids?: unknown };
  if (ids !== undefined && (!Array.isArray(ids) || ids.some((i) => typeof i !== "string"))) {
    return NextResponse.json({ error: "ids must be an array of strings." }, { status: 400 });
  }

  // recipientId scopes it, so someone else's id marks nothing. readAt is set and
  // never unset, which is what makes a repeat call harmless.
  const { count } = await prisma.notification.updateMany({
    where: {
      recipientId: user.id,
      readAt: null,
      ...(ids ? { id: { in: ids as string[] } } : {}),
    },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true, marked: count });
}
