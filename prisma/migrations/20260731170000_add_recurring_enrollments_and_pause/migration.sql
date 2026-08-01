ALTER TABLE "RecurringClassSchedule" ADD COLUMN "pauseUntil" DATE;

CREATE TABLE "RecurringEnrollment" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "recurringScheduleId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecurringEnrollment_studioId_recurringScheduleId_studentId_key" ON "RecurringEnrollment"("studioId", "recurringScheduleId", "studentId");
CREATE INDEX "RecurringEnrollment_studioId_studentId_active_idx" ON "RecurringEnrollment"("studioId", "studentId", "active");

ALTER TABLE "RecurringEnrollment" ADD CONSTRAINT "RecurringEnrollment_recurringScheduleId_fkey" FOREIGN KEY ("recurringScheduleId") REFERENCES "RecurringClassSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringEnrollment" ADD CONSTRAINT "RecurringEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
