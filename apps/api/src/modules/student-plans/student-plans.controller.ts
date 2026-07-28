import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateStudentPlanDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('student-plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('student-plans')
export class StudentPlansController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('payments.read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.studentPlan.findMany({ where: { studioId: user.studioId }, include: { student: true, plan: true } });
  }

  @Post()
  @RequirePermissions('payments.manage')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStudentPlanDto) {
    await Promise.all([
      this.prisma.student.findFirstOrThrow({ where: { id: dto.studentId, studioId: user.studioId } }),
      this.prisma.plan.findFirstOrThrow({ where: { id: dto.planId, studioId: user.studioId } }),
    ]);
    const studentPlan = await this.prisma.studentPlan.create({
      data: { ...dto, studioId: user.studioId, startDate: new Date(dto.startDate), endDate: dto.endDate ? new Date(dto.endDate) : undefined },
    });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'student_plans.create', entityType: 'StudentPlan', entityId: studentPlan.id, after: studentPlan });
    return studentPlan;
  }
}
