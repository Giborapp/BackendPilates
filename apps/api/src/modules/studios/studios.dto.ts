import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { STUDIO_BRAND_COLORS, STUDIO_LOGO_MIME_TYPES } from './studio-branding';

export class UpdateStudioProfileDto {
  @IsOptional() @IsString() @Length(0, 30) phone?: string;
  @IsOptional() @IsString() @Length(0, 30) whatsapp?: string;
  @IsOptional() @IsString() @Length(0, 12) zipCode?: string;
  @IsOptional() @IsString() @Length(0, 120) street?: string;
  @IsOptional() @IsString() @Length(0, 20) number?: string;
  @IsOptional() @IsString() @Length(0, 80) complement?: string;
  @IsOptional() @IsString() @Length(0, 80) district?: string;
  @IsOptional() @IsString() @Length(0, 80) city?: string;
  @IsOptional() @IsString() @Length(0, 2) state?: string;
  @IsOptional() @IsString() @Length(0, 20) cnpj?: string;
  @IsOptional() @IsString() @Length(1, 80) timezone?: string;
}

export class UpdateStudioOperationDto {
  @Type(() => Number) @IsInt() @Min(15) @Max(240) defaultClassDurationMinutes!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) defaultClassCapacity!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(168) cancellationNoticeHours!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(20) maxJustifiedAbsences!: number;
  @Type(() => Number) @IsInt() @IsIn([30, 60, 90]) replacementCreditValidityDays!: number;
  @IsBoolean() requireJustificationText!: boolean;
  @IsBoolean() replacementNoShowConsumesCredit!: boolean;
}

export class InitialPlanDto {
  @IsString() @Length(2, 120) name!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(14) sessionsPerWeek!: number;
  @IsOptional() @IsNumberString() defaultAmount?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) defaultBillingDay?: number;
}

export class SaveInitialPlansDto {
  @ValidateNested({ each: true })
  @Type(() => InitialPlanDto)
  @ArrayMaxSize(10)
  plans!: InitialPlanDto[];
}

export class UpdateStudioBrandingDto {
  @IsString() @IsIn(STUDIO_BRAND_COLORS) brandColor!: string;
  @IsOptional() @IsBoolean() completeOnboarding?: boolean;
}

export class RequestStudioLogoUploadDto {
  @IsOptional() @IsString() @Length(0, 120) originalName?: string;
  @IsString() @IsIn(STUDIO_LOGO_MIME_TYPES) mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(2_000_000) size!: number;
  @IsOptional() @IsString() checksum?: string;
}
