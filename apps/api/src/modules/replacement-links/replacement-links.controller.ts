import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { IdParamDto } from '@/shared/http/common.dto';
import { CreateReplacementLinkDto, ReplacementLinkTokenDto, ReserveReplacementDto } from './replacement-links.dto';
import { ReplacementLinksService } from './replacement-links.service';

@ApiTags('replacement-links')
@Controller('replacement-links')
export class ReplacementLinksController {
  constructor(private readonly service: ReplacementLinksService) {}
  @Get(':token') publicDetails(@Param() params: ReplacementLinkTokenDto) { return this.service.publicDetails(params.token); }
  @Post(':token/reserve') reserve(@Param() params: ReplacementLinkTokenDto, @Body() dto: ReserveReplacementDto) { return this.service.reserve(params.token, dto); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @Post()
  @RequirePermissions('attendance.manage') create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReplacementLinkDto) { return this.service.create(user, dto); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @Post(':id/revoke')
  @RequirePermissions('attendance.manage') revoke(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) { return this.service.revoke(user, params.id); }
}
