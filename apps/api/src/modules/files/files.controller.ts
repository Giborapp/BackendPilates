import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileOwnerType } from '@prisma/client';
import { IsEnum, IsInt, IsMimeType, IsString, IsUUID, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { IdParamDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';

class FileCreateDto {
  @IsEnum(FileOwnerType) ownerType!: FileOwnerType;
  @IsUUID() ownerId!: string;
  @IsString() storageKey!: string;
  @IsMimeType() mimeType!: string;
  @IsInt() @Min(1) @Max(10_000_000) size!: number;
}

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('students.read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.fileAsset.findMany({ where: { studioId: user.studioId, deletedAt: null } });
  }

  @Post()
  @RequirePermissions('students.update_basic')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: FileCreateDto) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(dto.mimeType)) {
      throw new BadRequestException('Unsupported file type');
    }
    return this.prisma.fileAsset.create({ data: { ...dto, studioId: user.studioId, uploadedByStaffId: user.staffMemberId } });
  }

  @Get(':id')
  @RequirePermissions('students.read')
  get(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.prisma.fileAsset.findFirstOrThrow({ where: { id: params.id, studioId: user.studioId, deletedAt: null } });
  }
}
