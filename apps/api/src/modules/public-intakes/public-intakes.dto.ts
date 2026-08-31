import { IsBoolean, IsDateString, IsEmail, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { IntakeRequestStatus, PublicInviteType } from '@prisma/client';

export class CreatePublicInviteDto {
  @IsEnum(PublicInviteType) type!: PublicInviteType;
  @IsUUID() templateId!: string;
  @IsOptional() @IsUUID() studentId?: string;
}

export class SubmitPublicIntakeDto {
  @IsString() fullName!: string;
  @IsDateString() birthDate!: string;
  @IsString() phone!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() emergencyContactName!: string;
  @IsString() emergencyContactPhone!: string;
  @IsBoolean() privacyAccepted!: boolean;
  @IsBoolean() truthfulnessAccepted!: boolean;
  @IsObject() answers!: unknown;
  @IsOptional() @IsString() turnstileToken?: string;
}

export class RejectIntakeRequestDto {
  @IsOptional() @IsString() reason?: string;
}

export class IntakeRequestQueryDto {
  @IsOptional() @IsEnum(IntakeRequestStatus) status?: IntakeRequestStatus;
}

export class MergeIntakeRequestDto {
  @IsUUID() studentId!: string;
}

export class PublicInviteTokenParamDto {
  @IsString() token!: string;
}
