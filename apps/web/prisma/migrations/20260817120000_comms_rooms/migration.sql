-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_closedAt_openedAt_idx" ON "Room"("closedAt", "openedAt");

-- CreateIndex
CREATE INDEX "Room_hostId_idx" ON "Room"("hostId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One open room per host. Enforced here rather than in the route because the
-- route can only check-then-insert, and two requests racing that gap both pass.
-- Partial so a host can open as many rooms as they like over time — the
-- constraint is on having two live at once.
CREATE UNIQUE INDEX "Room_one_open_per_host" ON "Room"("hostId") WHERE "closedAt" IS NULL;
