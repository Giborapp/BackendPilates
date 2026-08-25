import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileOwnerType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMimeType, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequireAnyPermission, RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { IdParamDto } from '@/shared/http/common.dto';
import { FilesService } from './files.service';
import { StorageService } from './storage.service';

class RequestUploadDto {
  @IsEnum(FileOwnerType) ownerType!: FileOwnerType;
  @IsUUID() ownerId!: string;
  @IsOptional() @IsString() originalName?: string;
  @IsMimeType() mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) size!: number;
  @IsOptional() @IsString() checksum?: string;
}

class CleanupPendingDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(10_080) olderThanMinutes = 60;
}

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermission('students.read', 'assessments.read', 'staff.manage')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.files.list(user);
  }

  @Post('uploads')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermission('students.update_basic', 'assessments.create', 'assessments.update_draft', 'staff.manage')
  requestUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Body() dto: RequestUploadDto,
  ) {
    return this.files.requestUpload(user, baseUrlFromRequest(request), dto);
  }

  @Put('local-upload')
  async localUpload(@Query('token') token: string, @Req() request: Request) {
    await this.storage.acceptLocalUpload(token, request);
    return { uploaded: true };
  }

  @Get('local-download')
  async localDownload(@Query('token') token: string, @Res() response: Response) {
    const download = await this.storage.openLocalDownload(token);
    response.setHeader('Content-Type', download.mimeType);
    response.setHeader('Content-Length', String(download.size));
    download.stream.pipe(response);
  }

  @Post('uploads/cleanup')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('studio_settings.manage')
  cleanupPending(@CurrentUser() user: AuthenticatedUser, @Body() dto: CleanupPendingDto) {
    return this.files.cleanupPending(user, dto);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermission('students.update_basic', 'assessments.create', 'assessments.update_draft', 'staff.manage')
  confirm(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.files.confirmUpload(user, params.id);
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermission('students.read', 'assessments.read', 'staff.manage')
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Param() params: IdParamDto,
  ) {
    return this.files.createDownload(user, baseUrlFromRequest(request), params.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermission('students.read', 'assessments.read', 'staff.manage')
  getMetadata(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.files.getMetadata(user, params.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAnyPermission('students.update_basic', 'assessments.create', 'assessments.update_draft', 'staff.manage')
  delete(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.files.delete(user, params.id);
  }
}

function baseUrlFromRequest(request: Request): string {
  const forwardedProto = readSingleHeader(request.headers['x-forwarded-proto']);
  const forwardedHost = readSingleHeader(request.headers['x-forwarded-host']);
  const protocol = forwardedProto ?? request.protocol;
  const host = forwardedHost ?? request.get('host');
  return `${protocol}://${host}`;
}

function readSingleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
