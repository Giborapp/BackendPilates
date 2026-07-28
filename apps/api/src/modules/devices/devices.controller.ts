import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import { RequirePermissions } from '@/shared/auth/permissions';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { IdParamDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('devices.manage')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.deviceSession.findMany({
      where: { studioId: user.studioId },
      select: { id: true, name: true, userAgent: true, lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  @Post(':id/revoke')
  @RequirePermissions('devices.manage')
  async revoke(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    await this.prisma.deviceSession.updateMany({ where: { id: params.id, studioId: user.studioId }, data: { revokedAt: new Date() } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'devices.revoke', entityType: 'DeviceSession', entityId: params.id });
    return { revoked: true };
  }
}
