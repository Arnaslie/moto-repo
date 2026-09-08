import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { parseInseamInput, type Inseam } from "@moto/core/inseam";

// Every handler here is scoped to the session user. Inseam is body data with no
// permission layer yet (ADR 0006), so the only safe visibility is "yours" — the
// missing GET-by-handle sibling is deliberate.
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
