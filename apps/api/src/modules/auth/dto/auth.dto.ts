import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import { SubscriptionPlan } from '@prisma/client';

export class StudioLoginDto {
  @ApiProperty({ example: 'demo@pilates.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Demo@123456' })
  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  deviceName?: string;
}

export class PinUnlockDto {
  @ApiProperty({ example: '9071' })
  @IsString()
  @Matches(/^\d{4}$/)
  pin!: string;
}

export class StudioRegisterDto {
  @ApiProperty({ example: 'Studio Bella Pilates' })
  @IsString()
  @Length(2, 120)
  studioName!: string;

  @ApiProperty({ example: 'contato@bellapilates.com.br' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Senha@123456' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: '12345678901', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/)
  responsibleCpf?: string;

  @ApiProperty({ example: '12345678000199', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$/)
  cnpj?: string;

  @ApiProperty({ enum: SubscriptionPlan, required: false, default: SubscriptionPlan.STARTER })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  subscriptionPlan?: SubscriptionPlan;

  // Deprecated compatibility fields. New clients must not send these.
  @IsOptional() @IsString() @Length(2, 120) adminName?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}$/) adminPin?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  professionalName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  professionalPin?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  receptionName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  receptionPin?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  deviceName?: string;
}
