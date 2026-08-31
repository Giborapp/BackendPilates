CREATE TYPE "AssessmentAudience" AS ENUM ('STUDENT', 'PROFESSIONAL');

CREATE TYPE "AssessmentTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "AssessmentTemplate"
  ADD COLUMN "audience" "AssessmentAudience" NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN "status" "AssessmentTemplateStatus" NOT NULL DEFAULT 'PUBLISHED';

CREATE INDEX "AssessmentTemplate_studioId_active_status_idx"
  ON "AssessmentTemplate"("studioId", "active", "status");
