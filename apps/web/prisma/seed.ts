import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
// Relative imports (not the "@/" alias) so `tsx prisma/seed.ts` resolves them.
import { seedGearCatalog } from "./gear-catalog";
import { STARTER_CATALOG, SLOTS } from "@moto/core/gear";

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

/**
 * Shared, weak and hardcoded on purpose: this only ever runs against a local
 * database — see the guard in main().
 */
const TEST_PASSWORD = "testrider123";

const testRiders = [
  { email: "ada@example.test", handle: "ada", displayName: "Ada", bio: "Wrenches on a CB550. Local test account." },
  { email: "bex@example.test", handle: "bex", displayName: "Bex", bio: "Tenere 700, mostly gravel. Local test account." },
];

async function seedTestRiders() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  // One default item per slot equipped out of the box — the same set signup
  // grants.
  const defaultEquipped = new Set(
    SLOTS.map((slot) => STARTER_CATALOG.find((g) => g.slot === slot.key)?.id).filter(
      (id): id is string => Boolean(id),
    ),
  );

  for (const rider of testRiders) {
    // Idempotent: re-seeding refreshes the password rather than colliding on
    // the unique handle. Gear is granted on create only, so a rider you dressed
    // up by hand survives a re-seed.
    await prisma.user.upsert({
      where: { handle: rider.handle },
      update: { passwordHash },
      create: {
        ...rider,
        passwordHash,
        gear: {
          create: STARTER_CATALOG.map((item) => ({
            gearItemId: item.id,
            source: "starter",
            equipped: defaultEquipped.has(item.id),
          })),
        },
      },
    });
  }

  console.log(
    `Seeded ${testRiders.length} test riders: ` +
      testRiders.map((r) => `@${r.handle}`).join(", ") +
      ` — password "${TEST_PASSWORD}".`,
  );
}

async function main() {
  // This mints known accounts with a published password. `db:seed` and the
  // deploy's catalog-only `db:seed:catalog` are one typo apart, so check rather
  // than trust.
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  if (!isLocal) {
    throw new Error(
      "Refusing to seed: DATABASE_URL doesn't point at localhost. " +
        "This seed creates accounts with a known password — run db:seed:catalog instead.",
    );
  }

  await seedGearCatalog(prisma);
  await seedTestRiders();

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
