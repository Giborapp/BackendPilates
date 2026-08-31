CREATE TYPE "PublicInviteType" AS ENUM ('NEW_STUDENT', 'EXISTING_STUDENT');

CREATE TYPE "PublicInviteStatus" AS ENUM ('OPEN', 'SUBMITTED', 'REVOKED', 'EXPIRED');

CREATE TYPE "IntakeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'MERGED', 'REJECTED');

ALTER TABLE "StudioSettings"
  ADD COLUMN "publicPrivacyNotice" TEXT,
  ADD COLUMN "publicPrivacyContact" TEXT;

CREATE TABLE "PublicInvite" (
  "id" UUID NOT NULL,
  "studioId" UUID NOT NULL,
  "templateId" UUID NOT NULL,
  "studentId" UUID,
  "type" "PublicInviteType" NOT NULL,
  "status" "PublicInviteStatus" NOT NULL DEFAULT 'OPEN',
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicInvite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicInvite_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "PublicInvite_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PublicInvite_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON UPDATE CASCADE,
  CONSTRAINT "PublicInvite_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON UPDATE CASCADE
);

CREATE TABLE "PublicIntakeRequest" (
  "id" UUID NOT NULL,
  "studioId" UUID NOT NULL,
  "inviteId" UUID NOT NULL,
  "studentId" UUID,
  "status" "IntakeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "standardData" JSONB NOT NULL,
  "answers" JSONB NOT NULL,
  "rejectionReason" TEXT,
  "reviewedByStaffId" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicIntakeRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicIntakeRequest_inviteId_key" UNIQUE ("inviteId"),
  CONSTRAINT "PublicIntakeRequest_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PublicIntakeRequest_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "PublicInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PublicIntakeRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON UPDATE CASCADE
);

CREATE INDEX "PublicInvite_studioId_status_expiresAt_idx" ON "PublicInvite"("studioId", "status", "expiresAt");
CREATE INDEX "PublicInvite_studioId_studentId_idx" ON "PublicInvite"("studioId", "studentId");
CREATE INDEX "PublicIntakeRequest_studioId_status_createdAt_idx" ON "PublicIntakeRequest"("studioId", "status", "createdAt");
