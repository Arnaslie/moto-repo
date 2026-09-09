import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to vote." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const value = (body as { value?: unknown } | null)?.value;
  if (value !== 1 && value !== -1 && value !== 0) {
    return NextResponse.json({ error: "value must be 1, -1 or 0." }, { status: 400 });
  }

  const { id } = await params;
  const stretch = await prisma.stretch.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!stretch) {
    return NextResponse.json({ error: "Stretch not found." }, { status: 404 });
  }

  if (value === 0) {
    await prisma.stretchVote.deleteMany({ where: { stretchId: id, userId: user.id } });
  } else {
    await prisma.stretchVote.upsert({
      where: { stretchId_userId: { stretchId: id, userId: user.id } },
      create: { stretchId: id, userId: user.id, value },
      update: { value },
    });
  }

  const [sum, confirmed] = await Promise.all([
    prisma.stretchVote.aggregate({ where: { stretchId: id }, _sum: { value: true } }),
    prisma.stretchVote.aggregate({
      where: { stretchId: id, value: 1 },
      _max: { createdAt: true },
    }),
  ]);

  return NextResponse.json({
    score: sum._sum.value ?? 0,
    myVote: value,
    lastConfirmedAt: confirmed._max.createdAt?.toISOString() ?? null,
  });
}
