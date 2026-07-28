-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StudioStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PROFESSIONAL', 'RECEPTION', 'FINANCE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "JustifiedAbsencePeriod" AS ENUM ('CALENDAR_MONTH', 'PLAN_CYCLE');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('LEAD', 'TRIAL', 'ACTIVE', 'PAUSED', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrialStatus" AS ENUM ('NEW_CONTACT', 'TRIAL_SCHEDULED', 'CONFIRMED', 'ATTENDED', 'MISSED', 'INTERESTED', 'CONVERTED', 'NOT_CONVERTED');

-- CreateEnum
CREATE TYPE "StudentPlanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'WAIVED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "ClassSessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('FIXED', 'REPLACEMENT', 'TRIAL', 'EXTRA');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('BOOKED', 'WAITLISTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'JUSTIFIED_ABSENCE', 'CANCELLED_IN_TIME', 'CANCELLED_LATE', 'CANCELLED_BY_STUDIO');

-- CreateEnum
CREATE TYPE "ReplacementCreditStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'USED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WaitingListStatus" AS ENUM ('WAITING', 'OFFERED', 'BOOKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'COMPLETED', 'AMENDED');

-- CreateEnum
CREATE TYPE "FileOwnerType" AS ENUM ('STUDENT', 'STAFF', 'ASSESSMENT');

-- CreateTable
CREATE TABLE "Studio" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "StudioStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioSettings" (
    "studioId" UUID NOT NULL,
    "defaultClassCapacity" INTEGER NOT NULL DEFAULT 6,
    "cancellationNoticeHours" INTEGER NOT NULL DEFAULT 12,
    "maxJustifiedAbsences" INTEGER NOT NULL DEFAULT 1,
    "justifiedAbsencePeriod" "JustifiedAbsencePeriod" NOT NULL DEFAULT 'CALENDAR_MONTH',
    "replacementCreditValidityDays" INTEGER NOT NULL DEFAULT 30,
    "allowCreditCarryOver" BOOLEAN NOT NULL DEFAULT false,
    "requireJustificationText" BOOLEAN NOT NULL DEFAULT true,
    "requireAdminApprovalForJustification" BOOLEAN NOT NULL DEFAULT false,
    "allowReplacementWithOtherProfessional" BOOLEAN NOT NULL DEFAULT true,
    "allowReplacementAtOtherTime" BOOLEAN NOT NULL DEFAULT true,
    "allowReplacementAtOtherUnit" BOOLEAN NOT NULL DEFAULT true,
    "replacementNoShowConsumesCredit" BOOLEAN NOT NULL DEFAULT true,
    "allowOverbooking" BOOLEAN NOT NULL DEFAULT false,
    "trialClassOccupiesCapacity" BOOLEAN NOT NULL DEFAULT true,
    "automaticWaitingList" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioSettings_pkey" PRIMARY KEY ("studioId")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT,
    "number" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCapacity" INTEGER NOT NULL DEFAULT 6,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'PROFESSIONAL',
    "pinHash" TEXT NOT NULL,
    "pinLookupHash" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSession" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT,
    "userAgent" TEXT,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "staffMemberId" UUID NOT NULL,
    "deviceSessionId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "replacedById" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "preferredName" TEXT,
    "photoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "birthDate" DATE,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "startDate" DATE,
    "status" "StudentStatus" NOT NULL DEFAULT 'LEAD',
    "generalNotes" TEXT,
    "importantCareNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialProcess" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "source" TEXT,
    "responsibleStaffId" UUID,
    "status" "TrialStatus" NOT NULL DEFAULT 'NEW_CONTACT',
    "scheduledSessionId" UUID,
    "notes" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sessionsPerWeek" INTEGER NOT NULL,
    "defaultAmount" DECIMAL(12,2) NOT NULL,
    "defaultBillingDay" INTEGER NOT NULL,
    "durationMonths" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPlan" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "billingDay" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "StudentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "studentPlanId" UUID,
    "referenceMonth" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentMethod" "PaymentMethod",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringClassSchedule" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "professionalId" UUID NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "RecurringClassSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "recurringScheduleId" UUID,
    "unitId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "professionalId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "ClassSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassBooking" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "classSessionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "bookingType" "BookingType" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'BOOKED',
    "replacementCreditId" UUID,
    "createdByStaffId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "classBookingId" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "justification" TEXT,
    "markedByStaffId" UUID,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplacementCredit" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "sourceAttendanceId" UUID,
    "status" "ReplacementCreditStatus" NOT NULL DEFAULT 'AVAILABLE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedBookingId" UUID,
    "approvedByStaffId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplacementCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitingListEntry" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "classSessionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "WaitingListStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitingListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentTemplate" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fields" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByStaffId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AssessmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "performedByStaffId" UUID,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "uploadedByStaffId" UUID,
    "ownerType" "FileOwnerType" NOT NULL,
    "ownerId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "actorStaffId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Studio_slug_key" ON "Studio"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_email_key" ON "Studio"("email");

-- CreateIndex
CREATE INDEX "Studio_email_idx" ON "Studio"("email");

-- CreateIndex
CREATE INDEX "Unit_studioId_idx" ON "Unit"("studioId");

-- CreateIndex
CREATE INDEX "Room_studioId_unitId_idx" ON "Room"("studioId", "unitId");

-- CreateIndex
CREATE INDEX "StaffMember_studioId_active_idx" ON "StaffMember"("studioId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_studioId_pinLookupHash_key" ON "StaffMember"("studioId", "pinLookupHash");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSession_tokenHash_key" ON "DeviceSession"("tokenHash");

-- CreateIndex
CREATE INDEX "DeviceSession_studioId_revokedAt_idx" ON "DeviceSession"("studioId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshSession_studioId_staffMemberId_revokedAt_idx" ON "RefreshSession"("studioId", "staffMemberId", "revokedAt");

-- CreateIndex
CREATE INDEX "Student_studioId_status_idx" ON "Student"("studioId", "status");

-- CreateIndex
CREATE INDEX "TrialProcess_studioId_status_idx" ON "TrialProcess"("studioId", "status");

-- CreateIndex
CREATE INDEX "Plan_studioId_active_idx" ON "Plan"("studioId", "active");

-- CreateIndex
CREATE INDEX "StudentPlan_studioId_studentId_status_idx" ON "StudentPlan"("studioId", "studentId", "status");

-- CreateIndex
CREATE INDEX "Payment_studioId_status_dueDate_idx" ON "Payment"("studioId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "RecurringClassSchedule_studioId_active_weekday_idx" ON "RecurringClassSchedule"("studioId", "active", "weekday");

-- CreateIndex
CREATE INDEX "ClassSession_studioId_startsAt_status_idx" ON "ClassSession"("studioId", "startsAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassBooking_replacementCreditId_key" ON "ClassBooking"("replacementCreditId");

-- CreateIndex
CREATE INDEX "ClassBooking_studioId_classSessionId_status_idx" ON "ClassBooking"("studioId", "classSessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassBooking_studioId_classSessionId_studentId_key" ON "ClassBooking"("studioId", "classSessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_classBookingId_key" ON "Attendance"("classBookingId");

-- CreateIndex
CREATE INDEX "Attendance_studioId_status_idx" ON "Attendance"("studioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReplacementCredit_sourceAttendanceId_key" ON "ReplacementCredit"("sourceAttendanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplacementCredit_usedBookingId_key" ON "ReplacementCredit"("usedBookingId");

-- CreateIndex
CREATE INDEX "ReplacementCredit_studioId_studentId_status_idx" ON "ReplacementCredit"("studioId", "studentId", "status");

-- CreateIndex
CREATE INDEX "WaitingListEntry_studioId_classSessionId_status_idx" ON "WaitingListEntry"("studioId", "classSessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WaitingListEntry_studioId_classSessionId_studentId_key" ON "WaitingListEntry"("studioId", "classSessionId", "studentId");

-- CreateIndex
CREATE INDEX "AssessmentTemplate_studioId_active_idx" ON "AssessmentTemplate"("studioId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTemplate_studioId_name_version_key" ON "AssessmentTemplate"("studioId", "name", "version");

-- CreateIndex
CREATE INDEX "Assessment_studioId_studentId_status_idx" ON "Assessment"("studioId", "studentId", "status");

-- CreateIndex
CREATE INDEX "FileAsset_studioId_ownerType_ownerId_idx" ON "FileAsset"("studioId", "ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "AuditLog_studioId_createdAt_idx" ON "AuditLog"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_studioId_entityType_entityId_idx" ON "AuditLog"("studioId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "StudioSettings" ADD CONSTRAINT "StudioSettings_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_deviceSessionId_fkey" FOREIGN KEY ("deviceSessionId") REFERENCES "DeviceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialProcess" ADD CONSTRAINT "TrialProcess_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlan" ADD CONSTRAINT "StudentPlan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPlan" ADD CONSTRAINT "StudentPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentPlanId_fkey" FOREIGN KEY ("studentPlanId") REFERENCES "StudentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringClassSchedule" ADD CONSTRAINT "RecurringClassSchedule_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringClassSchedule" ADD CONSTRAINT "RecurringClassSchedule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringClassSchedule" ADD CONSTRAINT "RecurringClassSchedule_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_recurringScheduleId_fkey" FOREIGN KEY ("recurringScheduleId") REFERENCES "RecurringClassSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_replacementCreditId_fkey" FOREIGN KEY ("replacementCreditId") REFERENCES "ReplacementCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_classBookingId_fkey" FOREIGN KEY ("classBookingId") REFERENCES "ClassBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedByStaffId_fkey" FOREIGN KEY ("markedByStaffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplacementCredit" ADD CONSTRAINT "ReplacementCredit_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplacementCredit" ADD CONSTRAINT "ReplacementCredit_sourceAttendanceId_fkey" FOREIGN KEY ("sourceAttendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitingListEntry" ADD CONSTRAINT "WaitingListEntry_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

