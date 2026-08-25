import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  AssessmentStatus,
  AttendanceStatus,
  BookingType,
  PaymentMethod,
  PaymentStatus,
  Role,
  StudentStatus,
  TrialStatus,
  Weekday,
} from '@prisma/client';
import { PERMISSIONS } from '@/shared/auth/permissions';

export class IdParamDto {
  @IsUUID()
  id!: string;
}

export class CreateStudentDto {
  @IsString() fullName!: string;
  @IsOptional() @IsString() preferredName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() emergencyContactName?: string;
  @IsOptional() @IsString() emergencyContactPhone?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsEnum(StudentStatus) status?: StudentStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(200) monthlyLessonLimit?: number;
  @IsOptional() @IsString() generalNotes?: string;
  @IsOptional() @IsString() importantCareNotes?: string;
}

export class UpdateStudentDto extends CreateStudentDto {}

export class CreateStaffDto {
  @IsString() name!: string;
  @IsEnum(Role) role!: Role;
  @IsString() @Length(4, 4) pin!: string;
  @IsOptional() @IsArray() @IsIn(PERMISSIONS, { each: true }) permissions?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateStaffDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsArray() @IsIn(PERMISSIONS, { each: true }) permissions?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ResetPinDto {
  @IsString() @Length(4, 4) pin!: string;
}

export class CreateUnitDto {
  @IsString() name!: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() zipCode?: string;
  @IsOptional() @IsString() phone?: string;
}

export class CreateRoomDto {
  @IsUUID() unitId!: string;
  @IsString() name!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) defaultCapacity!: number;
}

export class CreatePlanDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @IsInt() @Min(1) sessionsPerWeek!: number;
  @IsNumberString() defaultAmount!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(31) defaultBillingDay!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationMonths?: number;
}

export class CreateStudentPlanDto {
  @IsUUID() studentId!: string;
  @IsUUID() planId!: string;
  @IsNumberString() amount!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(31) billingDay!: number;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class CreatePaymentDto {
  @IsUUID() studentId!: string;
  @IsOptional() @IsUUID() studentPlanId?: string;
  @IsDateString() referenceMonth!: string;
  @IsDateString() dueDate!: string;
  @IsNumberString() amount!: string;
  @IsOptional() @IsString() notes?: string;
}

export class PaymentActionDto {
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
  @IsOptional() @IsString() notes?: string;
}

export class PaymentQueryDto {
  @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;
  @IsOptional() @IsUUID() studentId?: string;
}

export class CreateScheduleDto {
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsUUID() roomId?: string;
  @IsUUID() professionalId!: string;
  @IsEnum(Weekday) weekday!: Weekday;
  @IsString() startTime!: string;
  @Type(() => Number) @IsInt() @Min(15) durationMinutes!: number;
  @Type(() => Number) @IsInt() @Min(1) capacity!: number;
  @IsDateString() startsOn!: string;
  @IsOptional() @IsDateString() endsOn?: string;
}

export class UpdateScheduleDto {
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsUUID() roomId?: string;
  @IsOptional() @IsUUID() professionalId?: string;
  @IsOptional() @IsEnum(Weekday) weekday?: Weekday;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) durationMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) capacity?: number;
  @IsOptional() @IsDateString() startsOn?: string;
  @IsOptional() @IsDateString() endsOn?: string;
}

export class PauseScheduleDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(52) weeks!: number;
}

export class CreateRecurringEnrollmentDto {
  @IsUUID() studentId!: string;
}

export class GenerateSessionsDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
}

export class CreateClassSessionDto {
  @IsUUID() unitId!: string;
  @IsUUID() roomId!: string;
  @IsUUID() professionalId!: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @Type(() => Number) @IsInt() @Min(1) capacity!: number;
}

export class UpdateClassSessionDto {
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsUUID() roomId?: string;
  @IsOptional() @IsUUID() professionalId?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) capacity?: number;
}

export class CreateBookingDto {
  @IsUUID() classSessionId!: string;
  @IsUUID() studentId!: string;
  @IsEnum(BookingType) bookingType!: BookingType;
  @IsOptional() @IsUUID() replacementCreditId?: string;
  @IsOptional() @IsBoolean() allowOverbooking?: boolean;
}

export class AttendanceDto {
  @IsUUID() classBookingId!: string;
  @IsEnum(AttendanceStatus) status!: AttendanceStatus;
  @IsOptional() @IsString() justification?: string;
}

export class CreateTrialDto {
  @IsString() fullName!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsUUID() responsibleStaffId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateTrialStatusDto {
  @IsEnum(TrialStatus) status!: TrialStatus;
  @IsOptional() @IsUUID() scheduledSessionId?: string;
}

export class CreateTemplateDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsArray()
  fields!: unknown;
}

export class CreateAssessmentDto {
  @IsUUID() studentId!: string;
  @IsUUID() templateId!: string;
  @IsObject()
  answers!: unknown;
  @IsOptional() @IsEnum(AssessmentStatus) status?: AssessmentStatus;
}

export class AssessmentQueryDto {
  @IsOptional() @IsUUID() studentId?: string;
}
