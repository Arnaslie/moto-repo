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
  const bike = await prisma.motorcycle.findUnique({ where: { id } });
  if (!bike) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (bike.userId !== user.id) {
    return NextResponse.json({ error: "That's not your bike." }, { status: 403 });
  }

  await prisma.motorcycle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
