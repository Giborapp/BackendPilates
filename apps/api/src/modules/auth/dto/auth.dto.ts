import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

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
