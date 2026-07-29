import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class BootstrapDemoDto {
  @ApiPropertyOptional({ example: 'Studio Demo Pilates' })
  @IsOptional()
  @IsString()
  studioName?: string;

  @ApiPropertyOptional({ example: 'demo@pilates.local' })
  @IsOptional()
  @IsEmail()
  studioEmail?: string;

  @ApiPropertyOptional({ example: 'Demo@123456' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  studioPassword?: string;
}
