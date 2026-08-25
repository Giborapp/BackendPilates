-- CreateEnum
CREATE TYPE "FileAssetStatus" AS ENUM ('PENDING', 'AVAILABLE', 'DELETED');

-- AlterTable
ALTER TABLE "FileAsset"
ADD COLUMN "originalName" TEXT,
ADD COLUMN "checksum" TEXT,
ADD COLUMN "status" "FileAssetStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "uploadedAt" TIMESTAMP(3);

-- Existing records were metadata-only entries from the previous flow.
-- They are marked AVAILABLE to preserve read behavior after deployment.
UPDATE "FileAsset"
SET "status" = 'AVAILABLE',
    "uploadedAt" = "createdAt"
WHERE "deletedAt" IS NULL;

UPDATE "FileAsset"
SET "status" = 'DELETED'
WHERE "deletedAt" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");

-- CreateIndex
CREATE INDEX "FileAsset_studioId_status_createdAt_idx" ON "FileAsset"("studioId", "status", "createdAt");
