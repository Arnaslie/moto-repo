import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { parseInseamInput, type Inseam } from "@/lib/inseam";

/**
 * The rider's own inseam. Every handler here is scoped to the session user and
 * there is no route that reads someone else's — inseam is body data with no
 * permission layer yet (ADR 0006), so the only safe visibility is "yours".
 *
 * That's also why there's no GET-by-handle sibling: the absence is the design.
 */

// POST /api/fit/inseam — set or replace your own inseam.
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

  const parsed = parseInseamInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.value,
    select: { inseamMm: true, inseamSource: true, inseamSpreadMm: true },
  });

  return NextResponse.json({ inseam: updated as Inseam });
}

// DELETE /api/fit/inseam — forget it. Body data should be removable in one
// click, without deleting the account it hangs off.
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { inseamMm: null, inseamSource: null, inseamSpreadMm: null },
  });

  return NextResponse.json({ inseam: null });
}
