import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssessmentAudience, AssessmentTemplateStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../src/shared/auth/auth.types';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import type { AuditService } from '../src/modules/audit/audit.service';
import { AssessmentTemplatesService } from '../src/modules/assessments/assessment-templates.service';
import { ASSESSMENT_PRESETS } from '../src/modules/assessments/assessment-presets';

const user: AuthenticatedUser = {
  studioId: '11111111-1111-4111-8111-111111111111',
  staffMemberId: '22222222-2222-4222-8222-222222222222',
  deviceSessionId: '33333333-3333-4333-8333-333333333333',
  role: 'ADMIN',
  permissions: ['assessments.read', 'assessment_templates.manage'],
};

describe('assessment templates', () => {
  it('blocks a fourth published template', async () => {
    const context = createContext();
    context.prisma.assessmentTemplate.count.mockResolvedValue(3);
    await expect(context.service.create(user, templateInput(AssessmentTemplateStatus.PUBLISHED))).rejects.toBeInstanceOf(BadRequestException);
    expect(context.prisma.assessmentTemplate.create).not.toHaveBeenCalled();
  });

  it('allows drafts while three templates are published', async () => {
    const context = createContext();
    context.prisma.assessmentTemplate.count.mockResolvedValue(3);
    context.prisma.assessmentTemplate.create.mockResolvedValue(templateRecord({ status: AssessmentTemplateStatus.DRAFT }));
    await expect(context.service.create(user, templateInput(AssessmentTemplateStatus.DRAFT))).resolves.toMatchObject({ status: AssessmentTemplateStatus.DRAFT });
  });

  it('clones both code-owned presets as drafts with the correct audience', async () => {
    const context = createContext();
    context.prisma.assessmentTemplate.findFirst.mockResolvedValue(null);
    context.prisma.assessmentTemplate.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(templateRecord(data)));
    for (const preset of ASSESSMENT_PRESETS) {
      const result = await context.service.clonePreset(user, preset.key);
      expect(result).toMatchObject({ name: preset.name, audience: preset.audience, status: AssessmentTemplateStatus.DRAFT, active: false });
    }
  });

  it('keeps the Pilates anamnesis preset at exactly forty questions', () => {
    const preset = ASSESSMENT_PRESETS.find((item) => item.key === 'initial_anamnesis');
    expect(preset).toBeDefined();
    expect(preset?.name).toBe('Anamnese inicial — Pilates');
    expect(preset?.fields.filter((item) => item.type !== 'section')).toHaveLength(40);
  });

  it('rejects an unknown preset', async () => {
    const context = createContext();
    await expect(context.service.clonePreset(user, 'unknown')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('publishes only when a slot is available', async () => {
    const context = createContext();
    context.prisma.assessmentTemplate.findFirstOrThrow.mockResolvedValue(templateRecord({ status: AssessmentTemplateStatus.DRAFT }));
    context.prisma.assessmentTemplate.count.mockResolvedValue(2);
    context.prisma.assessmentTemplate.update.mockResolvedValue(templateRecord({ status: AssessmentTemplateStatus.PUBLISHED, active: true }));
    await expect(context.service.publish(user, '55555555-5555-4555-8555-555555555555')).resolves.toMatchObject({ status: AssessmentTemplateStatus.PUBLISHED });
  });

  it('creates a new draft version and archives the published version', async () => {
    const context = createContext();
    context.prisma.assessmentTemplate.findFirstOrThrow.mockResolvedValue(templateRecord({ status: AssessmentTemplateStatus.PUBLISHED, version: 1 }));
    const tx = {
      assessmentTemplate: {
        update: jest.fn(),
        create: jest.fn().mockResolvedValue(templateRecord({ status: AssessmentTemplateStatus.DRAFT, version: 2 })),
      },
    };
    context.prisma.$transaction.mockImplementation((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
    const result = await context.service.update(user, '55555555-5555-4555-8555-555555555555', templateInput());
    expect(result).toMatchObject({ version: 2, status: AssessmentTemplateStatus.DRAFT });
    expect(tx.assessmentTemplate.update).toHaveBeenCalled();
  });
});

function createContext() {
  const prisma = {
    $transaction: jest.fn(),
    assessmentTemplate: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { record: jest.fn() };
  return {
    service: new AssessmentTemplatesService(prisma as unknown as PrismaService, audit as unknown as AuditService),
    prisma,
  };
}

function templateInput(status?: AssessmentTemplateStatus) {
  return {
    name: 'Modelo de teste',
    description: 'Descricao',
    audience: AssessmentAudience.STUDENT,
    status,
    fields: [{ id: 'question', label: 'Question', type: 'short_text', required: true }],
  };
}

function templateRecord(input: Record<string, unknown> = {}) {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    studioId: user.studioId,
    name: 'Modelo de teste',
    description: 'Descricao',
    version: 1,
    fields: [{ id: 'question', label: 'Question', type: 'short_text' }],
    audience: AssessmentAudience.STUDENT,
    status: AssessmentTemplateStatus.DRAFT,
    active: false,
    createdByStaffId: user.staffMemberId,
    archivedAt: null,
    ...input,
  };
}
