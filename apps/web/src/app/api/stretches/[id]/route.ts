import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id } = await params;
  const stretch = await prisma.stretch.findUnique({
    where: { id },
    select: { authorId: true },
  });

  if (!stretch) {
    return NextResponse.json({ error: "Stretch not found." }, { status: 404 });
  }
  if (stretch.authorId !== user.id) {
    return NextResponse.json({ error: "That isn't yours to remove." }, { status: 403 });
  }

  await prisma.stretch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
