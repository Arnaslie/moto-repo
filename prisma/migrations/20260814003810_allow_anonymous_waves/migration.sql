-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Wave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wave_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Wave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Wave" ("createdAt", "id", "postId", "userId") SELECT "createdAt", "id", "postId", "userId" FROM "Wave";
DROP TABLE "Wave";
ALTER TABLE "new_Wave" RENAME TO "Wave";
CREATE INDEX "Wave_postId_idx" ON "Wave"("postId");
CREATE UNIQUE INDEX "Wave_postId_userId_key" ON "Wave"("postId", "userId");
CREATE UNIQUE INDEX "Wave_postId_guestId_key" ON "Wave"("postId", "guestId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
