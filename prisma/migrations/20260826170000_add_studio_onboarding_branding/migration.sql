-- AlterEnum
ALTER TYPE "FileOwnerType" ADD VALUE 'STUDIO';

-- AlterTable
ALTER TABLE "Studio" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "Studio" ADD COLUMN "zipCode" TEXT;
ALTER TABLE "Studio" ADD COLUMN "street" TEXT;
ALTER TABLE "Studio" ADD COLUMN "number" TEXT;
ALTER TABLE "Studio" ADD COLUMN "complement" TEXT;
ALTER TABLE "Studio" ADD COLUMN "district" TEXT;
ALTER TABLE "Studio" ADD COLUMN "city" TEXT;
ALTER TABLE "Studio" ADD COLUMN "state" TEXT;
ALTER TABLE "Studio" ADD COLUMN "cnpj" TEXT;
ALTER TABLE "Studio" ADD COLUMN "brandColor" TEXT NOT NULL DEFAULT '#1f7a6d';
ALTER TABLE "Studio" ADD COLUMN "logoFileAssetId" UUID;
ALTER TABLE "Studio" ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Studio" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StudioSettings" ADD COLUMN "defaultClassDurationMinutes" INTEGER NOT NULL DEFAULT 50;
