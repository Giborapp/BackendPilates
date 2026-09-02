import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AssessmentStatus, AssessmentTemplateStatus, ClinicalReviewStatus, IntakeRequestStatus, Prisma, PublicInviteStatus, PublicInviteType, StudentStatus } from '@prisma/client';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../files/storage.service';
import { parseTemplateFields, requiresProfessionalReview, validateAnswers } from '@/shared/domain/assessment-validator';
import { AppConfigService } from '@/shared/config/app-config.service';
import { CreatePublicInviteDto, IntakeRequestQueryDto, MergeIntakeRequestDto, RejectIntakeRequestDto, SubmitPublicIntakeDto } from './public-intakes.dto';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class PublicIntakesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly config: AppConfigService, private readonly storage: StorageService) {}

  async createInvite(user: AuthenticatedUser, dto: CreatePublicInviteDto): Promise<{ id: string; url: string; expiresAt: Date }> {
    const template = await this.prisma.assessmentTemplate.findFirstOrThrow({ where: { id: dto.templateId, studioId: user.studioId, audience: 'STUDENT', status: AssessmentTemplateStatus.PUBLISHED, active: true, archivedAt: null } });
    if (dto.type === PublicInviteType.EXISTING_STUDENT && !dto.studentId) throw new BadRequestException('Student is required for an existing-student invite');
    if (dto.type === PublicInviteType.NEW_STUDENT && dto.studentId) throw new BadRequestException('New-student invites cannot include a student');
    if (dto.studentId) await this.prisma.student.findFirstOrThrow({ where: { id: dto.studentId, studioId: user.studioId, archivedAt: null } });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
    const invite = await this.prisma.publicInvite.create({ data: { studioId: user.studioId, templateId: template.id, studentId: dto.studentId, type: dto.type, tokenHash: hashToken(token), expiresAt } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'public_intakes.invite_created', entityType: 'PublicInvite', entityId: invite.id, metadata: { type: dto.type, templateVersion: template.version, expiresAt: expiresAt.toISOString() } });
    const base = this.config.publicWebUrl ?? 'http://localhost:3000';
    return { id: invite.id, url: `${base}/public/anamnese/${token}`, expiresAt };
  }

  async revokeInvite(user: AuthenticatedUser, id: string) {
    const invite = await this.prisma.publicInvite.findFirstOrThrow({ where: { id, studioId: user.studioId } });
    if (invite.status !== PublicInviteStatus.OPEN) throw new BadRequestException('Invite is no longer open');
    const updated = await this.prisma.publicInvite.update({ where: { id }, data: { status: PublicInviteStatus.REVOKED, revokedAt: new Date() } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'public_intakes.invite_revoked', entityType: 'PublicInvite', entityId: id });
    return { id: updated.id, status: updated.status };
  }

  async getPublic(token: string, baseUrl: string) {
    const invite = await this.findOpenInvite(token);
    const [template, studio] = await Promise.all([
      this.prisma.assessmentTemplate.findUniqueOrThrow({ where: { id: invite.templateId }, select: { name: true, description: true, fields: true, audience: true } }),
      this.prisma.studio.findUniqueOrThrow({ where: { id: invite.studioId }, select: { id: true, name: true, brandColor: true, logoFileAssetId: true, settings: { select: { publicPrivacyNotice: true, publicPrivacyContact: true } } } }),
    ]);
    const logo = studio.logoFileAssetId ? await this.prisma.fileAsset.findFirst({ where: { id: studio.logoFileAssetId, studioId: studio.id, status: 'AVAILABLE', deletedAt: null } }) : null;
    const logoTarget = logo ? await this.storage.createDownloadTarget({ baseUrl, storageKey: logo.storageKey, mimeType: logo.mimeType, size: logo.size }) : null;
    return { studio: { name: studio.name, brandColor: studio.brandColor, logo: logoTarget ? { downloadUrl: logoTarget.downloadUrl, expiresAt: logoTarget.expiresAt } : null }, template: { name: template.name, description: template.description, fields: template.fields }, expiresAt: invite.expiresAt, type: invite.type, privacy: studio.settings };
  }

  async submit(token: string, dto: SubmitPublicIntakeDto) {
    if (!dto.privacyAccepted || !dto.truthfulnessAccepted) throw new BadRequestException('Privacy and truthfulness acceptance are required');
    await this.verifyTurnstile(dto.turnstileToken);
    const invite = await this.findOpenInvite(token);
    const template = await this.prisma.assessmentTemplate.findUniqueOrThrow({ where: { id: invite.templateId } });
    const fields = parseTemplateFields(template.fields);
    validateAnswers(fields, dto.answers);
    const request = await this.prisma.publicIntakeRequest.create({ data: { studioId: invite.studioId, inviteId: invite.id, studentId: invite.studentId, standardData: { fullName: dto.fullName.trim(), birthDate: dto.birthDate, phone: dto.phone.trim(), email: dto.email?.trim(), emergencyContactName: dto.emergencyContactName.trim(), emergencyContactRelationship: dto.emergencyContactRelationship.trim(), emergencyContactPhone: dto.emergencyContactPhone.trim(), privacyAccepted: true, truthfulnessAccepted: true }, answers: dto.answers as Prisma.InputJsonValue } });
    await this.prisma.publicInvite.update({ where: { id: invite.id }, data: { status: PublicInviteStatus.SUBMITTED, submittedAt: new Date() } });
    await this.audit.record({ studioId: invite.studioId, action: 'public_intakes.submitted', entityType: 'PublicIntakeRequest', entityId: request.id, metadata: { inviteType: invite.type } });
    return { submitted: true };
  }

  private async verifyTurnstile(token: string | undefined): Promise<void> {
    const secret = this.config.turnstileSecretKey;
    if (!secret) return;
    if (!token) throw new BadRequestException('Anti-bot verification is required');
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ secret, response: token }) });
    const result = (await response.json()) as { success?: boolean };
    if (!response.ok || result.success !== true) throw new BadRequestException('Anti-bot verification failed');
  }

  async list(user: AuthenticatedUser, query: IntakeRequestQueryDto) {
    const requests = await this.prisma.publicIntakeRequest.findMany({ where: { studioId: user.studioId, status: query.status }, include: { invite: { select: { type: true, expiresAt: true } } }, orderBy: { createdAt: 'desc' } });
    return user.permissions.includes('assessments.clinical_read') ? requests : requests.map(({ answers: omittedAnswers, ...request }) => { void omittedAnswers; return request; });
  }

  async approve(user: AuthenticatedUser, id: string) {
    const request = await this.getPendingRequest(user, id);
    if (request.invite.type === PublicInviteType.EXISTING_STUDENT) {
      if (!request.studentId) throw new BadRequestException('Existing-student intake has no student');
      return this.merge(user, id, { studentId: request.studentId });
    }
    const standard = asStandardData(request.standardData);
    const template = await this.prisma.assessmentTemplate.findUniqueOrThrow({ where: { id: request.invite.templateId } });
    const result = await this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.student.findFirst({ where: { studioId: user.studioId, OR: [{ phone: standard.phone }, ...(standard.email ? [{ email: standard.email }] : [])], archivedAt: null } });
      if (duplicate) throw new BadRequestException('A possible duplicate student exists; merge explicitly instead');
      const student = await tx.student.create({ data: { studioId: user.studioId, fullName: standard.fullName, birthDate: new Date(standard.birthDate), phone: standard.phone, email: standard.email, emergencyContactName: standard.emergencyContactName, emergencyContactRelationship: standard.emergencyContactRelationship, emergencyContactPhone: standard.emergencyContactPhone, status: StudentStatus.ACTIVE } });
      const assessment = await tx.assessment.create({ data: { studioId: user.studioId, studentId: student.id, templateId: template.id, templateVersion: template.version, answers: request.answers as Prisma.InputJsonValue, status: AssessmentStatus.COMPLETED, clinicalReviewStatus: requiresProfessionalReview(parseTemplateFields(template.fields), request.answers) ? ClinicalReviewStatus.REQUIRES_PROFESSIONAL_REVIEW : ClinicalReviewStatus.NOT_REQUIRED, completedAt: new Date(), performedByStaffId: user.staffMemberId } });
      await tx.publicIntakeRequest.update({ where: { id }, data: { status: IntakeRequestStatus.APPROVED, studentId: student.id, reviewedByStaffId: user.staffMemberId, reviewedAt: new Date() } });
      return { studentId: student.id, assessmentId: assessment.id };
    });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'public_intakes.approved', entityType: 'PublicIntakeRequest', entityId: id, metadata: result });
    return result;
  }

  async merge(user: AuthenticatedUser, id: string, dto: MergeIntakeRequestDto) {
    const request = await this.getPendingRequest(user, id);
    await this.prisma.student.findFirstOrThrow({ where: { id: dto.studentId, studioId: user.studioId, archivedAt: null } });
    const assessment = await this.prisma.$transaction(async (tx) => {
      const template = await tx.assessmentTemplate.findUniqueOrThrow({ where: { id: request.invite.templateId } });
      const created = await tx.assessment.create({ data: { studioId: user.studioId, studentId: dto.studentId, templateId: template.id, templateVersion: template.version, answers: request.answers as Prisma.InputJsonValue, status: AssessmentStatus.COMPLETED, clinicalReviewStatus: requiresProfessionalReview(parseTemplateFields(template.fields), request.answers) ? ClinicalReviewStatus.REQUIRES_PROFESSIONAL_REVIEW : ClinicalReviewStatus.NOT_REQUIRED, completedAt: new Date(), performedByStaffId: user.staffMemberId } });
      await tx.publicIntakeRequest.update({ where: { id }, data: { status: IntakeRequestStatus.MERGED, studentId: dto.studentId, reviewedByStaffId: user.staffMemberId, reviewedAt: new Date() } });
      return created;
    });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'public_intakes.merged', entityType: 'PublicIntakeRequest', entityId: id, metadata: { studentId: dto.studentId, assessmentId: assessment.id } });
    return { studentId: dto.studentId, assessmentId: assessment.id };
  }

  async reject(user: AuthenticatedUser, id: string, dto: RejectIntakeRequestDto) {
    await this.getPendingRequest(user, id);
    const request = await this.prisma.publicIntakeRequest.update({ where: { id }, data: { status: IntakeRequestStatus.REJECTED, rejectionReason: dto.reason, reviewedByStaffId: user.staffMemberId, reviewedAt: new Date() } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'public_intakes.rejected', entityType: 'PublicIntakeRequest', entityId: id, metadata: { hasReason: Boolean(dto.reason) } });
    return { id: request.id, status: request.status };
  }

  private async findOpenInvite(token: string) {
    const invite = await this.prisma.publicInvite.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!invite) throw new NotFoundException('Public form not found');
    if (invite.status !== PublicInviteStatus.OPEN) throw new BadRequestException('Public form is no longer available');
    if (invite.expiresAt <= new Date()) {
      await this.prisma.publicInvite.update({ where: { id: invite.id }, data: { status: PublicInviteStatus.EXPIRED } });
      throw new BadRequestException('Public form has expired');
    }
    return invite;
  }

  private async getPendingRequest(user: AuthenticatedUser, id: string) {
    const request = await this.prisma.publicIntakeRequest.findFirst({ where: { id, studioId: user.studioId, status: IntakeRequestStatus.PENDING }, include: { invite: true } });
    if (!request) throw new NotFoundException('Pending intake request not found');
    return request;
  }
}

function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }

function asStandardData(value: Prisma.JsonValue): { fullName: string; birthDate: string; phone: string; email?: string; emergencyContactName: string; emergencyContactRelationship: string; emergencyContactPhone: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Invalid standard intake data');
  const record = value as Record<string, unknown>;
  const required = ['fullName', 'birthDate', 'phone', 'emergencyContactName', 'emergencyContactRelationship', 'emergencyContactPhone'];
  if (required.some((key) => typeof record[key] !== 'string')) throw new BadRequestException('Invalid standard intake data');
  return { fullName: record.fullName as string, birthDate: record.birthDate as string, phone: record.phone as string, email: typeof record.email === 'string' ? record.email : undefined, emergencyContactName: record.emergencyContactName as string, emergencyContactRelationship: record.emergencyContactRelationship as string, emergencyContactPhone: record.emergencyContactPhone as string };
}
