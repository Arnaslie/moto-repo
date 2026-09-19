import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { stretchesWithin } from "@/lib/stretches";
import { boundsOf, parseBounds, parseStretchInput } from "@moto/core/stretches";

export async function GET(request: Request) {
  const parsed = parseBounds(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const user = await getCurrentUser();
  const stretches = await stretchesWithin(parsed.value, user?.id ?? null);
  return NextResponse.json({ stretches });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to chalk a stretch." },
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

  const parsed = parseStretchInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { kind, label, slug, path } = parsed.value;
  const created = await prisma.stretch.create({
    data: {
      authorId: user.id,
      kind,
      label,
      slug,
      path,
      ...boundsOf(path),
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json(
    {
      stretch: {
        id: created.id,
        author: user.handle,
        kind,
        label,
        slug,
        path,
        score: 0,
        myVote: 0,
        createdAt: created.createdAt.toISOString(),
        lastConfirmedAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
