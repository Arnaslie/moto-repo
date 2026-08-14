import { PrismaClient } from "@prisma/client";
// Relative import (not the "@/" alias) so `tsx prisma/seed.ts` resolves it.
import { seedGearCatalog } from "./gear-catalog";

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

async function main() {
  // Catalog is idempotent — always keep it in sync.
  await seedGearCatalog(prisma);

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
