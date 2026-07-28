import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StudentStatus, TrialStatus } from '@prisma/client';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateTrialDto, IdParamDto, UpdateTrialStatusDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('trial-processes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('trial-processes')
export class TrialProcessesController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('trial_students.manage')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.trialProcess.findMany({ where: { studioId: user.studioId }, include: { student: true } });
  }

  @Post()
  @RequirePermissions('trial_students.manage')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTrialDto) {
    const trial = await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({ data: { studioId: user.studioId, fullName: dto.fullName, phone: dto.phone, email: dto.email, status: StudentStatus.TRIAL } });
      return tx.trialProcess.create({ data: { studioId: user.studioId, studentId: student.id, source: dto.source, responsibleStaffId: dto.responsibleStaffId, notes: dto.notes } });
    });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'trial.create', entityType: 'TrialProcess', entityId: trial.id });
    return trial;
  }

  @Patch(':id/status')
  @RequirePermissions('trial_students.manage')
  async status(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: UpdateTrialStatusDto) {
    const trial = await this.prisma.trialProcess.findFirstOrThrow({ where: { id: params.id, studioId: user.studioId } });
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.trialProcess.update({ where: { id: trial.id }, data: { status: dto.status, scheduledSessionId: dto.scheduledSessionId, convertedAt: dto.status === TrialStatus.CONVERTED ? new Date() : undefined } });
      if (dto.status === TrialStatus.CONVERTED) {
        await tx.student.update({ where: { id: trial.studentId }, data: { status: StudentStatus.ACTIVE } });
      }
      return next;
    });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'trial.status_update', entityType: 'TrialProcess', entityId: trial.id, before: trial, after: updated });
    return updated;
  }
}
