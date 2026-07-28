import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { RequirePermissions } from '@/shared/auth/permissions';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('studio-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('studio-settings')
export class StudioSettingsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  async get(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.studioSettings.findUnique({ where: { studioId: user.studioId } });
  }

  @Patch()
  @RequirePermissions('studio_settings.manage')
  async update(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) {
    const before = await this.prisma.studioSettings.findUnique({ where: { studioId: user.studioId } });
    const after = await this.prisma.studioSettings.update({ where: { studioId: user.studioId }, data: body });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'studio_settings.update', entityType: 'StudioSettings', entityId: user.studioId, before: before ?? {}, after });
    return after;
  }
}
