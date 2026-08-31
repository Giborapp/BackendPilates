import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AssessmentAudience, AssessmentStatus, AssessmentTemplateStatus, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { AssessmentQueryDto, CreateAssessmentDto, IdParamDto } from '@/shared/http/common.dto';
import { parseTemplateFields, validateAnswers } from '@/shared/domain/assessment-validator';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('assessments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('assessments.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: AssessmentQueryDto) {
    return this.prisma.assessment.findMany({
      where: { studioId: user.studioId, studentId: query.studentId, ...(user.permissions.includes('assessments.clinical_read') ? {} : { template: { audience: AssessmentAudience.STUDENT } }) },
      include: { student: true, template: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  @RequirePermissions('assessments.create')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAssessmentDto) {
    await this.prisma.student.findFirstOrThrow({ where: { id: dto.studentId, studioId: user.studioId } });
    const template = await this.prisma.assessmentTemplate.findFirstOrThrow({ where: { id: dto.templateId, studioId: user.studioId, active: true, status: AssessmentTemplateStatus.PUBLISHED } });
    if (template.audience === AssessmentAudience.PROFESSIONAL && !user.permissions.includes('assessments.clinical_manage')) {
      throw new BadRequestException('Professional assessment permission required');
    }
    const fields = parseTemplateFields(template.fields);
    validateAnswers(fields, dto.answers);
    const assessment = await this.prisma.assessment.create({ data: { studioId: user.studioId, studentId: dto.studentId, templateId: template.id, templateVersion: template.version, answers: dto.answers as Prisma.InputJsonValue, status: dto.status ?? AssessmentStatus.DRAFT, performedByStaffId: user.staffMemberId, completedAt: dto.status === AssessmentStatus.COMPLETED ? new Date() : undefined } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'assessments.create', entityType: 'Assessment', entityId: assessment.id });
    return assessment;
  }

  @Patch(':id')
  @RequirePermissions('assessments.update_draft')
  async updateDraft(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: Partial<CreateAssessmentDto>) {
    const assessment = await this.prisma.assessment.findFirstOrThrow({ where: { id: params.id, studioId: user.studioId } });
    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new BadRequestException('Completed assessments cannot be edited silently');
    }
    const template = await this.prisma.assessmentTemplate.findFirstOrThrow({ where: { id: assessment.templateId, studioId: user.studioId } });
    if (template.audience === AssessmentAudience.PROFESSIONAL && !user.permissions.includes('assessments.clinical_manage')) throw new BadRequestException('Professional assessment permission required');
    if (dto.answers) {
      validateAnswers(parseTemplateFields(template.fields), dto.answers);
    }
    const updated = await this.prisma.assessment.update({ where: { id: assessment.id }, data: { answers: dto.answers as Prisma.InputJsonValue | undefined, status: dto.status, completedAt: dto.status === AssessmentStatus.COMPLETED ? new Date() : undefined } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'assessments.update', entityType: 'Assessment', entityId: updated.id, metadata: { status: updated.status, templateVersion: updated.templateVersion } });
    return updated;
  }
}
