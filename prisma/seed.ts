import { PrismaClient } from "@prisma/client";
// Relative import (not the "@/" alias) so `tsx prisma/seed.ts` resolves it.
import { STARTER_CATALOG } from "../src/lib/gear";

const prisma = new PrismaClient();

const samplePosts = [
  {
    author: "trailblazer_tom",
    content:
      "Just finished a 400km ride through the mountain passes on my Tenere 700. The switchbacks near the summit were unreal 🏔️🏍️",
  },
  {
    author: "cafe_racer_kim",
    content:
      "Restored the carbs on my '78 CB550 this weekend. She finally idles smooth. Anyone else running pod filters on theirs?",
  },
  {
    author: "adv_amelia",
    content:
      "PSA: check your chain slack before long trips. Learned that the hard way 200km from the nearest town. Ride safe out there!",
  },
  {
    author: "two_wheel_diaries",
    content:
      "New helmet day! Went with the modular this time for the touring season. Worth the upgrade for the drop-down visor alone.",
  },
];

async function seedGearCatalog() {
  for (const item of STARTER_CATALOG) {
    await prisma.gearItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        slot: item.slot,
        name: item.name,
        brand: item.brand ?? null,
        rarity: item.rarity,
        asset: item.asset,
        color: item.color ?? null,
        starter: item.starter,
      },
      update: {
        slot: item.slot,
        name: item.name,
        brand: item.brand ?? null,
        rarity: item.rarity,
        asset: item.asset,
        color: item.color ?? null,
        starter: item.starter,
      },
    });
  }
  console.log(`Upserted ${STARTER_CATALOG.length} gear items.`);
}

async function main() {
  // Catalog is idempotent — always keep it in sync.
  await seedGearCatalog();

  const count = await prisma.post.count();
  if (count > 0) {
    console.log(`Database already has ${count} posts — skipping post seed.`);
    return;
  }

  // Space out timestamps so the feed has a natural ordering.
  const now = Date.now();
  for (let i = 0; i < samplePosts.length; i++) {
    await prisma.post.create({
      data: {
        ...samplePosts[i],
        createdAt: new Date(now - i * 1000 * 60 * 37),
      },
    });
  }

  console.log(`Seeded ${samplePosts.length} posts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
