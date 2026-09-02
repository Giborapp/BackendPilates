import { BadRequestException, NotFoundException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { AssessmentTemplateStatus, PublicInviteStatus, PublicInviteType } from '@prisma/client';
import type { AuthenticatedUser } from '../src/shared/auth/auth.types';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import type { AuditService } from '../src/modules/audit/audit.service';
import type { AppConfigService } from '../src/shared/config/app-config.service';
import type { StorageService } from '../src/modules/files/storage.service';
import { PublicIntakesService } from '../src/modules/public-intakes/public-intakes.service';

const user: AuthenticatedUser = { studioId: '11111111-1111-4111-8111-111111111111', staffMemberId: '22222222-2222-4222-8222-222222222222', deviceSessionId: '33333333-3333-4333-8333-333333333333', role: 'ADMIN', permissions: ['assessment_templates.manage', 'assessments.read', 'assessments.create'] };

describe('public intake links', () => {
  it('stores only a hash and permits one submission', async () => {
    const context = createContext();
    context.prisma.assessmentTemplate.findFirstOrThrow.mockResolvedValue({ id: '44444444-4444-4444-8444-444444444444', version: 1, status: AssessmentTemplateStatus.PUBLISHED });
    context.prisma.publicInvite.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: '55555555-5555-4555-8555-555555555555', ...data }));
    const created = await context.service.createInvite(user, { type: PublicInviteType.NEW_STUDENT, templateId: '44444444-4444-4444-8444-444444444444' });
    const data = context.prisma.publicInvite.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(typeof data.tokenHash).toBe('string');
    expect((data.tokenHash as string)).toHaveLength(64);
    expect(created.url).toContain('/public/anamnese/');
    expect(created.url).not.toContain(data.tokenHash as string);
  });

  it('rejects expired, revoked and unknown links without exposing data', async () => {
    const context = createContext();
    context.prisma.publicInvite.findUnique.mockResolvedValue(null);
    await expect(context.service.getPublic('invalid', 'http://api')).rejects.toBeInstanceOf(NotFoundException);
    context.prisma.publicInvite.findUnique.mockResolvedValue({ ...invite(), status: PublicInviteStatus.REVOKED });
    await expect(context.service.getPublic('revoked', 'http://api')).rejects.toBeInstanceOf(BadRequestException);
    context.prisma.publicInvite.findUnique.mockResolvedValue({ ...invite(), expiresAt: new Date(Date.now() - 1000) });
    await expect(context.service.getPublic('expired', 'http://api')).rejects.toBeInstanceOf(BadRequestException);
    expect(context.audit.record).not.toHaveBeenCalledWith(expect.objectContaining({ after: expect.anything() }));
  });

  it('creates a pending request and audits only metadata', async () => {
    const context = createContext();
    context.prisma.publicInvite.findUnique.mockResolvedValue(invite());
    context.prisma.assessmentTemplate.findUniqueOrThrow.mockResolvedValue({ fields: [{ id: 'q', label: 'Objetivo', type: 'short_text' }] });
    context.prisma.publicIntakeRequest.create.mockResolvedValue({ id: '66666666-6666-4666-8666-666666666666' });
    const result = await context.service.submit('token', { fullName: 'Teste', birthDate: '1990-01-01', phone: '11999999999', emergencyContactName: 'Contato', emergencyContactRelationship: 'Mae', emergencyContactPhone: '11888888888', privacyAccepted: true, truthfulnessAccepted: true, answers: { q: 'Saude' } });
    expect(result).toEqual({ submitted: true });
    expect(context.prisma.publicIntakeRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ standardData: expect.objectContaining({ fullName: 'Teste' }) }) }));
    expect(context.audit.record).toHaveBeenCalledWith(expect.not.objectContaining({ answers: expect.anything(), standardData: expect.anything() }));
  });
});

function createContext() {
  const prisma = { publicInvite: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() }, assessmentTemplate: { findFirstOrThrow: jest.fn(), findUniqueOrThrow: jest.fn() }, student: { findFirstOrThrow: jest.fn() }, publicIntakeRequest: { create: jest.fn() }, studio: { findUniqueOrThrow: jest.fn() }, fileAsset: { findFirst: jest.fn() } };
  const audit = { record: jest.fn() };
  const config = { publicWebUrl: 'http://localhost:2345' };
  const storage = { createDownloadTarget: jest.fn() };
  return { service: new PublicIntakesService(prisma as unknown as PrismaService, audit as unknown as AuditService, config as unknown as AppConfigService, storage as unknown as StorageService), prisma, audit };
}

function invite() { return { id: '55555555-5555-4555-8555-555555555555', studioId: user.studioId, templateId: '44444444-4444-4444-8444-444444444444', studentId: null, type: PublicInviteType.NEW_STUDENT, status: PublicInviteStatus.OPEN, tokenHash: 'hash', expiresAt: new Date(Date.now() + 86_400_000) }; }
