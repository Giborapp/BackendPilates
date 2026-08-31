CREATE TYPE "PublicReplacementLinkStatus" AS ENUM ('OPEN', 'USED', 'REVOKED', 'EXPIRED');

CREATE TABLE "PublicReplacementLink" (
  "id" UUID NOT NULL,
  "studioId" UUID NOT NULL,
  "replacementCreditId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "PublicReplacementLinkStatus" NOT NULL DEFAULT 'OPEN',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicReplacementLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PublicReplacementLink_replacementCreditId_key" ON "PublicReplacementLink"("replacementCreditId");
CREATE UNIQUE INDEX "PublicReplacementLink_tokenHash_key" ON "PublicReplacementLink"("tokenHash");
CREATE INDEX "PublicReplacementLink_studioId_status_expiresAt_idx" ON "PublicReplacementLink"("studioId", "status", "expiresAt");
ALTER TABLE "PublicReplacementLink" ADD CONSTRAINT "PublicReplacementLink_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicReplacementLink" ADD CONSTRAINT "PublicReplacementLink_replacementCreditId_fkey" FOREIGN KEY ("replacementCreditId") REFERENCES "ReplacementCredit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
