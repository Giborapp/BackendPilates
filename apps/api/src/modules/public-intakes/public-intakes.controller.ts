import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import type { Request } from 'express';
import { IdParamDto } from '@/shared/http/common.dto';
import { CreatePublicInviteDto, IntakeRequestQueryDto, MergeIntakeRequestDto, PublicInviteTokenParamDto, RejectIntakeRequestDto, SubmitPublicIntakeDto } from './public-intakes.dto';
import { PublicIntakesService } from './public-intakes.service';

@ApiTags('public-intakes')
@Controller('public')
export class PublicIntakesController {
  constructor(private readonly service: PublicIntakesService) {}

  @Get('anamnese/:token')
  get(@Param() params: PublicInviteTokenParamDto, @Req() request: Request) { return this.service.getPublic(params.token, baseUrlFromRequest(request)); }

  @Post('anamnese/:token')
  submit(@Param() params: PublicInviteTokenParamDto, @Body() dto: SubmitPublicIntakeDto) { return this.service.submit(params.token, dto); }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('intakes/invites')
  @RequirePermissions('assessment_templates.manage')
  createInvite(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePublicInviteDto) { return this.service.createInvite(user, dto); }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('intakes/invites/:id/revoke')
  @RequirePermissions('assessment_templates.manage')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) { return this.service.revokeInvite(user, params.id); }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('intakes')
  @RequirePermissions('assessments.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: IntakeRequestQueryDto) { return this.service.list(user, query); }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('intakes/:id/approve')
  @RequirePermissions('assessments.create')
  approve(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) { return this.service.approve(user, params.id); }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('intakes/:id/merge')
  @RequirePermissions('assessments.create')
  merge(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: MergeIntakeRequestDto) { return this.service.merge(user, params.id, dto); }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('intakes/:id/reject')
  @RequirePermissions('assessments.create')
  reject(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: RejectIntakeRequestDto) { return this.service.reject(user, params.id, dto); }
}

function baseUrlFromRequest(request: Request): string {
  const protocol = Array.isArray(request.headers['x-forwarded-proto']) ? request.headers['x-forwarded-proto'][0] : request.headers['x-forwarded-proto'] ?? request.protocol;
  const host = Array.isArray(request.headers['x-forwarded-host']) ? request.headers['x-forwarded-host'][0] : request.headers['x-forwarded-host'] ?? request.get('host');
  return `${protocol}://${host}`;
}
