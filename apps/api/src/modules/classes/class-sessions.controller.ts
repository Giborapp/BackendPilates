import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateClassSessionDto, IdParamDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('class-sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('class-sessions')
export class ClassSessionsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('classes.read_all')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.classSession.findMany({ where: { studioId: user.studioId }, include: { bookings: true }, orderBy: { startsAt: 'asc' } });
  }

  @Post()
  @RequirePermissions('classes.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClassSessionDto) {
    return this.prisma.classSession.create({ data: { ...dto, studioId: user.studioId, startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt) } });
  }

  @Patch(':id')
  @RequirePermissions('classes.update')
  async update(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() body: Record<string, unknown>) {
    const before = await this.prisma.classSession.findFirstOrThrow({ where: { id: params.id, studioId: user.studioId } });
    const after = await this.prisma.classSession.update({ where: { id: before.id }, data: body });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'classes.update', entityType: 'ClassSession', entityId: after.id, before, after });
    return after;
  }

  @Post(':id/cancel')
  @RequirePermissions('classes.cancel')
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() body: { cancellationReason?: string }) {
    const session = await this.prisma.classSession.update({ where: { id: params.id, studioId: user.studioId }, data: { status: 'CANCELLED', cancellationReason: body.cancellationReason } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'classes.cancel', entityType: 'ClassSession', entityId: session.id });
    return session;
  }
}
