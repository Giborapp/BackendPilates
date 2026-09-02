import { BadRequestException, Injectable } from '@nestjs/common';
import { FileAssetStatus, FileOwnerType, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../files/storage.service';
import {
  RequestStudioLogoUploadDto,
  SaveInitialPlansDto,
  UpdateStudioBrandingDto,
  UpdateStudioOperationDto,
  UpdateStudioProfileDto,
} from './studios.dto';
import {
  STUDIO_LOGO_MAX_BYTES,
  isStudioLogoMimeType,
} from './studio-branding';

@Injectable()
export class StudiosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async current(user: AuthenticatedUser, baseUrl: string) {
    const studio = await this.prisma.studio.findUniqueOrThrow({
      where: { id: user.studioId },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        responsibleCpf: true,
        phone: true,
        whatsapp: true,
        zipCode: true,
        street: true,
        number: true,
        complement: true,
        district: true,
        city: true,
        state: true,
        cnpj: true,
        brandColor: true,
        logoFileAssetId: true,
        onboardingStep: true,
        onboardingCompletedAt: true,
        timezone: true,
        locale: true,
        currency: true,
        status: true,
        settings: true,
      },
    });
    return { ...studio, logo: await this.createLogoView(baseUrl, studio.logoFileAssetId) };
  }

  async updateProfile(user: AuthenticatedUser, dto: UpdateStudioProfileDto) {
    const before = await this.prisma.studio.findUniqueOrThrow({ where: { id: user.studioId } });
    const after = await this.prisma.studio.update({
      where: { id: user.studioId },
      data: { ...dto, onboardingStep: { set: Math.max(before.onboardingStep, 1) } },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'studios.onboarding.profile_update',
      entityType: 'Studio',
      entityId: user.studioId,
      metadata: { onboardingStep: 1 },
    });
    return after;
  }

  async updateOperation(user: AuthenticatedUser, dto: UpdateStudioOperationDto) {
    const after = await this.prisma.$transaction(async (tx) => {
      const studio = await tx.studio.findUniqueOrThrow({ where: { id: user.studioId } });
      await tx.studio.update({
        where: { id: user.studioId },
        data: { onboardingStep: { set: Math.max(studio.onboardingStep, 2) } },
      });
      return tx.studioSettings.update({
        where: { studioId: user.studioId },
        data: dto,
      });
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'studios.onboarding.operation_update',
      entityType: 'StudioSettings',
      entityId: user.studioId,
      metadata: { onboardingStep: 2 },
    });
    return after;
  }

  async saveInitialPlans(user: AuthenticatedUser, dto: SaveInitialPlansDto) {
    const plans = await this.prisma.$transaction(async (tx) => {
      const saved = [];
      for (const plan of dto.plans) {
        const existing = await tx.plan.findFirst({
          where: { studioId: user.studioId, name: plan.name, active: true },
        });
        saved.push(
          existing
            ? await tx.plan.update({
                where: { id: existing.id },
                data: {
                  sessionsPerWeek: plan.sessionsPerWeek,
                  defaultAmount: plan.defaultAmount ?? '0',
                  defaultBillingDay: plan.defaultBillingDay ?? 10,
                },
              })
            : await tx.plan.create({
                data: {
                  studioId: user.studioId,
                  name: plan.name,
                  sessionsPerWeek: plan.sessionsPerWeek,
                  defaultAmount: plan.defaultAmount ?? '0',
                  defaultBillingDay: plan.defaultBillingDay ?? 10,
                },
              }),
        );
      }
      const studio = await tx.studio.findUniqueOrThrow({ where: { id: user.studioId } });
      await tx.studio.update({
        where: { id: user.studioId },
        data: { onboardingStep: { set: Math.max(studio.onboardingStep, 3) } },
      });
      return saved;
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'studios.onboarding.initial_plans_saved',
      entityType: 'Plan',
      metadata: { count: plans.length, onboardingStep: 3 },
    });
    return { items: plans };
  }

  async updateBranding(user: AuthenticatedUser, dto: UpdateStudioBrandingDto) {
    const before = await this.prisma.studio.findUniqueOrThrow({ where: { id: user.studioId } });
    const onboardingStep = Math.max(before.onboardingStep, 4);
    const after = await this.prisma.studio.update({
      where: { id: user.studioId },
      data: {
        brandColor: dto.brandColor,
        onboardingStep,
        onboardingCompletedAt: dto.completeOnboarding
          ? (before.onboardingCompletedAt ?? new Date())
          : undefined,
      },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'studios.branding.update',
      entityType: 'Studio',
      entityId: user.studioId,
      metadata: {
        previousColor: before.brandColor,
        brandColor: after.brandColor,
        onboardingCompleted: Boolean(dto.completeOnboarding),
      },
    });
    return after;
  }

  async requestLogoUpload(user: AuthenticatedUser, baseUrl: string, dto: RequestStudioLogoUploadDto) {
    if (!isStudioLogoMimeType(dto.mimeType)) {
      throw new BadRequestException('Studio logo must be PNG or WebP');
    }
    if (dto.size > STUDIO_LOGO_MAX_BYTES) {
      throw new BadRequestException('Studio logo exceeds 2 MB');
    }
    const storageKey = this.createLogoStorageKey(user.studioId, dto.mimeType);
    const file = await this.prisma.fileAsset.create({
      data: {
        studioId: user.studioId,
        uploadedByStaffId: user.staffMemberId,
        ownerType: FileOwnerType.STUDIO,
        ownerId: user.studioId,
        storageKey,
        originalName: sanitizeOriginalName(dto.originalName),
        mimeType: dto.mimeType,
        size: dto.size,
        checksum: dto.checksum,
        status: FileAssetStatus.PENDING,
      },
    });
    const target = await this.storage.createUploadTarget({
      baseUrl,
      storageKey,
      mimeType: dto.mimeType,
      size: dto.size,
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'studios.logo.upload_requested',
      entityType: 'FileAsset',
      entityId: file.id,
      metadata: { mimeType: dto.mimeType, size: dto.size },
    });
    return { fileAsset: withoutStorageKey(file), uploadUrl: target.uploadUrl, expiresAt: target.expiresAt };
  }

  async confirmLogoUpload(user: AuthenticatedUser, id: string) {
    const file = await this.prisma.fileAsset.findFirstOrThrow({
      where: {
        id,
        studioId: user.studioId,
        ownerType: FileOwnerType.STUDIO,
        ownerId: user.studioId,
        deletedAt: null,
      },
    });
    if (file.status !== FileAssetStatus.PENDING) {
      throw new BadRequestException('Studio logo upload is not pending');
    }
    const object = await this.storage.head(file.storageKey);
    if (object.size !== file.size || object.mimeType !== file.mimeType) {
      throw new BadRequestException('Uploaded logo does not match declared metadata');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.fileAsset.update({
        where: { id: file.id },
        data: { status: FileAssetStatus.AVAILABLE, uploadedAt: new Date() },
      }),
      this.prisma.studio.update({
        where: { id: user.studioId },
        data: { logoFileAssetId: file.id },
      }),
    ]);
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'studios.logo.confirmed',
      entityType: 'FileAsset',
      entityId: file.id,
      metadata: { mimeType: file.mimeType, size: file.size },
    });
    return withoutStorageKey(updated);
  }

  async removeLogo(user: AuthenticatedUser) {
    const studio = await this.prisma.studio.findUniqueOrThrow({
      where: { id: user.studioId },
      select: { logoFileAssetId: true },
    });
    if (!studio.logoFileAssetId) {
      return { removed: false };
    }
    const file = await this.prisma.fileAsset.findFirst({
      where: {
        id: studio.logoFileAssetId,
        studioId: user.studioId,
        ownerType: FileOwnerType.STUDIO,
        ownerId: user.studioId,
        deletedAt: null,
      },
    });
    if (!file) {
      await this.prisma.studio.update({
        where: { id: user.studioId },
        data: { logoFileAssetId: null },
      });
      return { removed: false };
    }
    await this.storage.delete(file.storageKey);
    await this.prisma.$transaction([
      this.prisma.fileAsset.update({
        where: { id: file.id },
        data: { status: FileAssetStatus.DELETED, deletedAt: new Date() },
      }),
      this.prisma.studio.update({
        where: { id: user.studioId },
        data: { logoFileAssetId: null },
      }),
    ]);
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'studios.logo.removed',
      entityType: 'FileAsset',
      entityId: file.id,
    });
    return { removed: true };
  }

  private async createLogoView(baseUrl: string, logoFileAssetId: string | null) {
    if (!logoFileAssetId) {
      return null;
    }
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: logoFileAssetId, status: FileAssetStatus.AVAILABLE, deletedAt: null },
      select: { id: true, storageKey: true, mimeType: true, size: true, originalName: true },
    });
    if (!file) {
      return null;
    }
    const target = await this.storage.createDownloadTarget({
      baseUrl,
      storageKey: file.storageKey,
      mimeType: file.mimeType,
      size: file.size,
    });
    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      downloadUrl: target.downloadUrl,
      expiresAt: target.expiresAt,
    };
  }

  private createLogoStorageKey(studioId: string, mimeType: 'image/png' | 'image/webp'): string {
    const extension = mimeType === 'image/png' ? 'png' : 'webp';
    return `studios/${studioId}/STUDIO/${studioId}/logo-${randomUUID()}.${extension}`;
  }
}

type FileAssetPublic = Prisma.FileAssetGetPayload<object> & {
  storageKey?: string;
};

function withoutStorageKey(file: FileAssetPublic) {
  const { storageKey, ...safeFile } = file;
  void storageKey;
  return safeFile;
}

function sanitizeOriginalName(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const sanitized = value
    .split(/[\\/]/)
    .at(-1)
    ?.replace(/[^a-zA-Z0-9._ -]/g, '')
    .trim()
    .slice(0, 120);
  return sanitized && sanitized.length > 0 ? sanitized : undefined;
}
