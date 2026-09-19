-- CreateTable
CREATE TABLE "Stretch" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "path" JSONB NOT NULL,
    "minLat" DOUBLE PRECISION NOT NULL,
    "maxLat" DOUBLE PRECISION NOT NULL,
    "minLng" DOUBLE PRECISION NOT NULL,
    "maxLng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stretch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StretchVote" (
    "id" TEXT NOT NULL,
    "stretchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StretchVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagTrend" (
    "id" TEXT NOT NULL,
    "cell" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagTrend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Stretch_minLat_maxLat_idx" ON "Stretch"("minLat", "maxLat");

-- CreateIndex
CREATE INDEX "Stretch_minLng_maxLng_idx" ON "Stretch"("minLng", "maxLng");

-- CreateIndex
CREATE INDEX "Stretch_authorId_idx" ON "Stretch"("authorId");

-- CreateIndex
CREATE INDEX "Stretch_slug_idx" ON "Stretch"("slug");

-- CreateIndex
CREATE INDEX "StretchVote_stretchId_idx" ON "StretchVote"("stretchId");

-- CreateIndex
CREATE UNIQUE INDEX "StretchVote_stretchId_userId_key" ON "StretchVote"("stretchId", "userId");

-- CreateIndex
CREATE INDEX "TagTrend_cell_count_idx" ON "TagTrend"("cell", "count");

-- CreateIndex
CREATE UNIQUE INDEX "TagTrend_cell_slug_key" ON "TagTrend"("cell", "slug");

-- AddForeignKey
ALTER TABLE "Stretch" ADD CONSTRAINT "Stretch_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StretchVote" ADD CONSTRAINT "StretchVote_stretchId_fkey" FOREIGN KEY ("stretchId") REFERENCES "Stretch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StretchVote" ADD CONSTRAINT "StretchVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

