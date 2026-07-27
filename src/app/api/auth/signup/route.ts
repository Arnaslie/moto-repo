import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseSignup } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { STARTER_CATALOG, SLOTS } from "@/lib/gear";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = parseSignup(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { email, handle, password, displayName } = parsed.value;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { handle }] },
    select: { email: true, handle: true },
  });
  if (existing) {
    const field = existing.email === email ? "email" : "handle";
    return NextResponse.json(
      { error: `That ${field} is already taken.` },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Pick one default item per slot to equip out of the box.
  const defaultEquipped = new Set(
    SLOTS.map((slot) => STARTER_CATALOG.find((g) => g.slot === slot.key)?.id).filter(
      (id): id is string => Boolean(id),
    ),
  );

  const user = await prisma.user.create({
    data: {
      email,
      handle,
      displayName,
      passwordHash,
      gear: {
        create: STARTER_CATALOG.map((item) => ({
          gearItemId: item.id,
          source: "starter",
          equipped: defaultEquipped.has(item.id),
        })),
      },
    },
    select: { id: true, handle: true },
  });

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  return NextResponse.json({ user }, { status: 201 });
}
