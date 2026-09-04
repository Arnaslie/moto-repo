import { PrismaClient } from "@prisma/client";
import { seedGearCatalog } from "./gear-catalog";

// Catalog-only seed, run from `vercel-build` after the migration so a fresh
// database can accept signups. Deliberately does NOT touch posts — production
// shouldn't get the demo feed. `npm run db:seed` is still the one that does.
const prisma = new PrismaClient();

seedGearCatalog(prisma)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
