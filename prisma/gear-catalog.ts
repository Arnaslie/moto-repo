import type { PrismaClient } from "@prisma/client";
// Relative import (not the "@/" alias) so `tsx prisma/*.ts` resolves it.
import { STARTER_CATALOG } from "../src/lib/gear";

// The gear catalog is reference data, not sample content: signup writes a
// UserGear row for every STARTER_CATALOG entry, so a database without these
// rows fails every signup with a foreign key violation. That's why this runs
// as part of the deploy rather than only from the seed script.
//
// Idempotent by design — upserts keyed on the stable slug id, so it's safe to
// run on every deploy and it doubles as a way to push catalog edits live.
export async function seedGearCatalog(prisma: PrismaClient) {
  for (const item of STARTER_CATALOG) {
    const fields = {
      slot: item.slot,
      name: item.name,
      brand: item.brand ?? null,
      rarity: item.rarity,
      asset: item.asset,
      color: item.color ?? null,
      starter: item.starter,
    };
    await prisma.gearItem.upsert({
      where: { id: item.id },
      create: { id: item.id, ...fields },
      update: fields,
    });
  }
  console.log(`Upserted ${STARTER_CATALOG.length} gear items.`);
}
