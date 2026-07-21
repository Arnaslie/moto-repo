import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { SLOTS, type SlotKey } from "@/lib/gear";

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SLOT_KEYS = new Set<string>(SLOTS.map((s) => s.key));

// POST /api/avatar — customize the signed-in user's avatar.
// Accepts one of: { gearItemId } to equip, { clearSlot } to empty a slot,
// or { skin } to set the base skin tone.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const { gearItemId, clearSlot, skin } = (body ?? {}) as {
    gearItemId?: unknown;
    clearSlot?: unknown;
    skin?: unknown;
  };

  // Set skin tone.
  if (typeof skin === "string") {
    if (!HEX_RE.test(skin)) {
      return NextResponse.json({ error: "skin must be a hex color." }, { status: 400 });
    }
    await prisma.user.update({ where: { id: user.id }, data: { avatarSkin: skin } });
    return NextResponse.json({ ok: true });
  }

  // Clear a slot.
  if (typeof clearSlot === "string") {
    if (!SLOT_KEYS.has(clearSlot)) {
      return NextResponse.json({ error: "Unknown slot." }, { status: 400 });
    }
    await prisma.userGear.updateMany({
      where: { userId: user.id, gearItem: { slot: clearSlot as SlotKey } },
      data: { equipped: false },
    });
    return NextResponse.json({ ok: true });
  }

  // Equip an owned item.
  if (typeof gearItemId === "string") {
    const owned = await prisma.userGear.findUnique({
      where: { userId_gearItemId: { userId: user.id, gearItemId } },
      include: { gearItem: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "You don't own that item." }, { status: 403 });
    }
    const slot = owned.gearItem.slot;
    await prisma.$transaction([
      prisma.userGear.updateMany({
        where: { userId: user.id, gearItem: { slot } },
        data: { equipped: false },
      }),
      prisma.userGear.update({
        where: { userId_gearItemId: { userId: user.id, gearItemId } },
        data: { equipped: true },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}
