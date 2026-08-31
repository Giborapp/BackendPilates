import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { IdParamDto } from '@/shared/http/common.dto';
import { StudiosService } from './studios.service';
import {
  RequestStudioLogoUploadDto,
  SaveInitialPlansDto,
  UpdateStudioBrandingDto,
  UpdateStudioOperationDto,
  UpdateStudioProfileDto,
} from './studios.dto';

@ApiTags('studios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('studios')
export class StudiosController {
  constructor(private readonly studios: StudiosService) {}

  @Get('current')
  current(@CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    return this.studios.current(user, baseUrlFromRequest(request));
  }

  @Get('onboarding')
  onboarding(@CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    return this.studios.current(user, baseUrlFromRequest(request));
  }

  @Patch('onboarding/profile')
  @RequirePermissions('studio_settings.manage')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateStudioProfileDto) {
    return this.studios.updateProfile(user, dto);
  }

  @Patch('onboarding/operation')
  @RequirePermissions('studio_settings.manage')
  updateOperation(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateStudioOperationDto) {
    return this.studios.updateOperation(user, dto);
  }

  @Post('onboarding/plans')
  @RequirePermissions('payments.manage')
  saveInitialPlans(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveInitialPlansDto) {
    return this.studios.saveInitialPlans(user, dto);
  }

  @Patch('branding')
  @RequirePermissions('studio_settings.manage')
  updateBranding(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateStudioBrandingDto) {
    return this.studios.updateBranding(user, dto);
  }

  @Post('logo/uploads')
  @RequirePermissions('studio_settings.manage')
  requestLogoUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Body() dto: RequestStudioLogoUploadDto,
  ) {
    return this.studios.requestLogoUpload(user, baseUrlFromRequest(request), dto);
  }

  @Post('logo/:id/confirm')
  @RequirePermissions('studio_settings.manage')
  confirmLogoUpload(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.studios.confirmLogoUpload(user, params.id);
  }

  @Delete('logo')
  @RequirePermissions('studio_settings.manage')
  removeLogo(@CurrentUser() user: AuthenticatedUser) {
    return this.studios.removeLogo(user);
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
