ALTER TABLE "Student" ADD COLUMN "emergencyContactRelationship" TEXT;
CREATE TYPE "ClinicalReviewStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRES_PROFESSIONAL_REVIEW', 'REVIEWED');
ALTER TABLE "Assessment" ADD COLUMN "clinicalReviewStatus" "ClinicalReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
CREATE INDEX "Assessment_studioId_clinicalReviewStatus_idx" ON "Assessment"("studioId", "clinicalReviewStatus");
