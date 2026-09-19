DELETE FROM "Wave" WHERE "userId" IS NULL;

DROP INDEX "Wave_postId_guestId_key";

ALTER TABLE "Wave" DROP COLUMN "guestId";

ALTER TABLE "Wave" ALTER COLUMN "userId" SET NOT NULL;
