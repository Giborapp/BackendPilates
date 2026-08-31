import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssessmentAudience, AssessmentTemplateStatus } from '@prisma/client';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { findAssessmentPreset, ASSESSMENT_PRESETS } from './assessment-presets';
import { CreateTemplateDto } from '@/shared/http/common.dto';
import { parseTemplateFields } from '@/shared/domain/assessment-validator';

const MAX_PUBLISHED_TEMPLATES = 3;

@Injectable()
export class AssessmentTemplatesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(user: AuthenticatedUser) {
    return this.prisma.assessmentTemplate.findMany({
      where: { studioId: user.studioId, ...(user.permissions.includes('assessments.clinical_read') ? {} : { audience: AssessmentAudience.STUDENT }) },
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
    });
  }

  get(user: AuthenticatedUser, id: string) {
    return this.prisma.assessmentTemplate.findFirstOrThrow({ where: { id, studioId: user.studioId, ...(user.permissions.includes('assessments.clinical_read') ? {} : { audience: AssessmentAudience.STUDENT }) } });
  }

  async create(user: AuthenticatedUser, dto: CreateTemplateDto) {
    const fields = parseTemplateFields(dto.fields);
    const status = dto.status ?? AssessmentTemplateStatus.DRAFT;
    await this.assertCanPublish(user.studioId, status);
    const template = await this.prisma.assessmentTemplate.create({
      data: {
        studioId: user.studioId,
        name: dto.name.trim(),
        description: dto.description,
        audience: dto.audience ?? AssessmentAudience.STUDENT,
        status,
        active: status === AssessmentTemplateStatus.PUBLISHED,
        fields,
        createdByStaffId: user.staffMemberId,
      },
    });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'assessment_templates.create', entityType: 'AssessmentTemplate', entityId: template.id, metadata: { status, audience: template.audience, questions: countQuestions(fields) } });
    return template;
  }

  async update(user: AuthenticatedUser, id: string, dto: CreateTemplateDto) {
    const before = await this.prisma.assessmentTemplate.findFirstOrThrow({ where: { id, studioId: user.studioId } });
    if (before.status === AssessmentTemplateStatus.ARCHIVED) {
      throw new BadRequestException('Archived assessment versions cannot be edited');
    }
    const fields = parseTemplateFields(dto.fields);
    if (before.status === AssessmentTemplateStatus.PUBLISHED) {
      const next = await this.prisma.$transaction(async (tx) => {
        await tx.assessmentTemplate.update({ where: { id: before.id }, data: { active: false, status: AssessmentTemplateStatus.ARCHIVED, archivedAt: new Date() } });
        return tx.assessmentTemplate.create({
          data: {
            studioId: user.studioId,
            name: dto.name?.trim() || before.name,
            description: dto.description ?? before.description,
            audience: dto.audience ?? before.audience,
            status: AssessmentTemplateStatus.DRAFT,
            active: false,
            version: before.version + 1,
            fields,
            createdByStaffId: user.staffMemberId,
          },
        });
      });
      await this.auditTemplateChange(user, 'assessment_templates.new_version', next.id, { fromVersion: before.version, toVersion: next.version });
      return next;
    }
    const updated = await this.prisma.assessmentTemplate.update({
      where: { id: before.id },
      data: { name: dto.name?.trim(), description: dto.description, audience: dto.audience, fields },
    });
    await this.auditTemplateChange(user, 'assessment_templates.update_draft', updated.id, { version: updated.version });
    return updated;
  }

  async publish(user: AuthenticatedUser, id: string) {
    const template = await this.prisma.assessmentTemplate.findFirstOrThrow({ where: { id, studioId: user.studioId } });
    if (template.status === AssessmentTemplateStatus.PUBLISHED) return template;
    await this.assertCanPublish(user.studioId, AssessmentTemplateStatus.PUBLISHED);
    const updated = await this.prisma.assessmentTemplate.update({ where: { id }, data: { status: AssessmentTemplateStatus.PUBLISHED, active: true, archivedAt: null } });
    await this.auditTemplateChange(user, 'assessment_templates.publish', id, { version: updated.version });
    return updated;
  }

  async archive(user: AuthenticatedUser, id: string) {
    const template = await this.prisma.assessmentTemplate.findFirstOrThrow({ where: { id, studioId: user.studioId } });
    const updated = await this.prisma.assessmentTemplate.update({ where: { id }, data: { status: AssessmentTemplateStatus.ARCHIVED, active: false, archivedAt: new Date() } });
    await this.auditTemplateChange(user, 'assessment_templates.archive', id, { previousStatus: template.status });
    return updated;
  }

  async restore(user: AuthenticatedUser, id: string) {
    const template = await this.prisma.assessmentTemplate.findFirstOrThrow({ where: { id, studioId: user.studioId } });
    await this.assertCanPublish(user.studioId, AssessmentTemplateStatus.PUBLISHED);
    const updated = await this.prisma.assessmentTemplate.update({ where: { id }, data: { status: AssessmentTemplateStatus.PUBLISHED, active: true, archivedAt: null } });
    await this.auditTemplateChange(user, 'assessment_templates.restore', id, { previousStatus: template.status });
    return updated;
  }

  presets() {
    return ASSESSMENT_PRESETS.map(({ key, name, description, audience, fields }) => ({ key, name, description, audience, questionCount: countQuestions(fields) }));
  }

  async clonePreset(user: AuthenticatedUser, key: string) {
    const preset = findAssessmentPreset(key);
    if (!preset) throw new NotFoundException('Assessment preset not found');
    const fields = parseTemplateFields(preset.fields);
    const existing = await this.prisma.assessmentTemplate.findFirst({ where: { studioId: user.studioId, name: preset.name }, orderBy: { version: 'desc' } });
    const template = await this.prisma.assessmentTemplate.create({
      data: {
        studioId: user.studioId,
        name: preset.name,
        description: preset.description,
        audience: preset.audience,
        version: (existing?.version ?? 0) + 1,
        status: AssessmentTemplateStatus.DRAFT,
        active: false,
        fields,
        createdByStaffId: user.staffMemberId,
      },
    });
    await this.auditTemplateChange(user, 'assessment_templates.clone_preset', template.id, { preset: key, audience: preset.audience });
    return template;
  }

  private async assertCanPublish(studioId: string, status: AssessmentTemplateStatus): Promise<void> {
    if (status !== AssessmentTemplateStatus.PUBLISHED) return;
    const count = await this.prisma.assessmentTemplate.count({ where: { studioId, status: AssessmentTemplateStatus.PUBLISHED, active: true, archivedAt: null } });
    if (count >= MAX_PUBLISHED_TEMPLATES) throw new BadRequestException('A studio can have at most 3 published assessment templates');
  }

  private async auditTemplateChange(user: AuthenticatedUser, action: string, entityId: string, metadata: Record<string, string | number>) {
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action, entityType: 'AssessmentTemplate', entityId, metadata });
  }
}

function countQuestions(fields: Array<{ type?: unknown }>): number {
  return fields.filter((field) => field.type !== 'section').length;
}
