import { BadRequestException } from '@nestjs/common';
import { FileAssetStatus, FileOwnerType, Role } from '@prisma/client';
import { validate } from 'class-validator';
import type { AuthenticatedUser } from '../src/shared/auth/auth.types';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import type { AuditService } from '../src/modules/audit/audit.service';
import type { StorageService, StoredObjectHead } from '../src/modules/files/storage.service';
import { StudiosService } from '../src/modules/studios/studios.service';
import { UpdateStudioBrandingDto } from '../src/modules/studios/studios.dto';
import { STUDIO_BRAND_COLORS } from '../src/modules/studios/studio-branding';

const user: AuthenticatedUser = {
  studioId: '11111111-1111-4111-8111-111111111111',
  staffMemberId: '22222222-2222-4222-8222-222222222222',
  deviceSessionId: '33333333-3333-4333-8333-333333333333',
  role: Role.ADMIN,
  permissions: ['studio_settings.manage', 'payments.manage'],
};

describe('studio onboarding and branding', () => {
  it('exposes default-compatible onboarding state for an existing studio', async () => {
    const context = createServiceContext();
    context.prisma.studio.findUniqueOrThrow.mockResolvedValue(studioRecord({ onboardingStep: 0 }));

    const result = await context.service.current(user, 'http://localhost:3000');

    expect(result).toMatchObject({
      id: user.studioId,
      brandColor: STUDIO_BRAND_COLORS[0],
      onboardingStep: 0,
      onboardingCompletedAt: null,
      settings: { defaultClassDurationMinutes: 50 },
      logo: null,
    });
  });

  it('advances onboarding profile without requiring optional address or CNPJ', async () => {
    const context = createServiceContext();
    context.prisma.studio.findUniqueOrThrow.mockResolvedValue(studioRecord({ onboardingStep: 0 }));
    context.prisma.studio.update.mockResolvedValue(studioRecord({ onboardingStep: 1, phone: '11999999999' }));

    const result = await context.service.updateProfile(user, { phone: '11999999999' });

    expect(result.onboardingStep).toBe(1);
    expect(context.prisma.studio.update).toHaveBeenCalledWith({
      where: { id: user.studioId },
      data: { phone: '11999999999', onboardingStep: { set: 1 } },
    });
  });

  it('saves operation settings and preserves resumed progress', async () => {
    const context = createServiceContext();
    const tx: OperationTransaction = {
        studio: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(studioRecord({ onboardingStep: 3 })),
          update: jest.fn(),
        },
        studioSettings: {
          update: jest.fn().mockResolvedValue({ studioId: user.studioId, defaultClassDurationMinutes: 55 }),
        },
    };
    context.prisma.$transaction.mockImplementation((callback: (transaction: OperationTransaction) => Promise<unknown>) =>
      callback(tx),
    );

    const result = await context.service.updateOperation(user, {
      defaultClassDurationMinutes: 55,
      defaultClassCapacity: 5,
      cancellationNoticeHours: 12,
      maxJustifiedAbsences: 1,
      replacementCreditValidityDays: 60,
      requireJustificationText: true,
      replacementNoShowConsumesCredit: false,
    });

    expect(result).toMatchObject({ defaultClassDurationMinutes: 55 });
  });

  it('creates initial plans and moves onboarding to the plans step', async () => {
    const context = createServiceContext();
    const tx = {
      plan: {
        create: jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve(data)),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      studio: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(studioRecord({ onboardingStep: 2 })),
        update: jest.fn(),
      },
    };
    context.prisma.$transaction.mockImplementation((callback: (transaction: PlansTransaction) => Promise<unknown>) =>
      callback(tx),
    );

    const result = await context.service.saveInitialPlans(user, {
      plans: [
        { name: 'Plano 1x', sessionsPerWeek: 1 },
        { name: 'Plano 2x', sessionsPerWeek: 2, defaultAmount: '250', defaultBillingDay: 10 },
      ],
    });

    expect(result.items).toHaveLength(2);
    expect(tx.plan.create).toHaveBeenCalledTimes(2);
    expect(tx.studio.update).toHaveBeenCalledWith({
      where: { id: user.studioId },
      data: { onboardingStep: { set: 3 } },
    });
  });

  it('rejects colors outside the predefined palette through DTO validation', async () => {
    const dto = new UpdateStudioBrandingDto();
    dto.brandColor = '#000000';

    await expect(validate(dto)).resolves.toHaveLength(1);
  });

  it('updates a valid brand color and can complete onboarding', async () => {
    const context = createServiceContext();
    context.prisma.studio.findUniqueOrThrow.mockResolvedValue(studioRecord({ onboardingStep: 3 }));
    context.prisma.studio.update.mockResolvedValue(
      studioRecord({ brandColor: STUDIO_BRAND_COLORS[1], onboardingStep: 4, onboardingCompletedAt: new Date() }),
    );

    const result = await context.service.updateBranding(user, {
      brandColor: STUDIO_BRAND_COLORS[1],
      completeOnboarding: true,
    });

    expect(result.brandColor).toBe(STUDIO_BRAND_COLORS[1]);
    expect(result.onboardingCompletedAt).toBeInstanceOf(Date);
  });

  it('requests only PNG or WebP studio logo uploads with a 2 MB limit', async () => {
    const context = createServiceContext();
    context.prisma.fileAsset.create.mockResolvedValue(fileRecord({ status: FileAssetStatus.PENDING }));
    context.storage.createUploadTarget.mockResolvedValue({
      uploadUrl: 'https://signed-put.example',
      expiresAt: new Date('2026-08-26T12:05:00.000Z'),
    });

    await expect(
      context.service.requestLogoUpload(user, 'http://localhost:3000', {
        mimeType: 'image/jpeg',
        size: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      context.service.requestLogoUpload(user, 'http://localhost:3000', {
        mimeType: 'image/png',
        size: 2_000_001,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const result = await context.service.requestLogoUpload(user, 'http://localhost:3000', {
      mimeType: 'image/png',
      size: 120,
      originalName: '../logo.png',
    });

    expect(result.fileAsset).toMatchObject({
      ownerType: FileOwnerType.STUDIO,
      ownerId: user.studioId,
      originalName: 'logo.png',
      status: FileAssetStatus.PENDING,
    });
    expect(result.fileAsset).not.toHaveProperty('storageKey');
  });

  it('confirms and removes only the authenticated studio logo', async () => {
    const context = createServiceContext();
    context.prisma.fileAsset.findFirstOrThrow.mockResolvedValue(fileRecord({ status: FileAssetStatus.PENDING }));
    context.storage.head.mockResolvedValue({ size: 120, mimeType: 'image/png' });
    context.prisma.$transaction.mockResolvedValue([fileRecord({ status: FileAssetStatus.AVAILABLE }), studioRecord({})]);

    const confirmed = await context.service.confirmLogoUpload(user, '55555555-5555-4555-8555-555555555555');

    expect(confirmed).toMatchObject({ status: FileAssetStatus.AVAILABLE });
    expect(confirmed).not.toHaveProperty('storageKey');

    context.prisma.studio.findUniqueOrThrow.mockResolvedValue(
      studioRecord({ logoFileAssetId: '55555555-5555-4555-8555-555555555555' }),
    );
    context.prisma.fileAsset.findFirst.mockResolvedValue(fileRecord({ status: FileAssetStatus.AVAILABLE }));
    context.prisma.$transaction.mockResolvedValue([
      fileRecord({ status: FileAssetStatus.DELETED }),
      studioRecord({ logoFileAssetId: null }),
    ]);

    await expect(context.service.removeLogo(user)).resolves.toEqual({ removed: true });
  });
});

function createServiceContext() {
  const prisma = {
    $transaction: jest.fn(),
    studio: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    studioSettings: {
      update: jest.fn(),
    },
    plan: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    fileAsset: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { record: jest.fn() };
  const storage = {
    createUploadTarget: jest.fn(),
    createDownloadTarget: jest.fn(),
    head: jest.fn<Promise<StoredObjectHead>, [string]>(),
    delete: jest.fn(),
  };
  const service = new StudiosService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    storage as unknown as StorageService,
  );
  return { service, prisma, audit, storage };
}

type OperationTransaction = {
  studio: {
    findUniqueOrThrow: jest.Mock;
    update: jest.Mock;
  };
  studioSettings: {
    update: jest.Mock;
  };
};

type PlansTransaction = {
  plan: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  studio: {
    findUniqueOrThrow: jest.Mock;
    update: jest.Mock;
  };
};

function studioRecord(input: {
  onboardingStep?: number;
  onboardingCompletedAt?: Date | null;
  brandColor?: string;
  phone?: string | null;
  logoFileAssetId?: string | null;
}) {
  return {
    id: user.studioId,
    name: 'Studio Teste',
    slug: 'studio-teste',
    email: 'teste@example.com',
    passwordHash: 'hash',
    phone: input.phone ?? null,
    whatsapp: null,
    zipCode: null,
    street: null,
    number: null,
    complement: null,
    district: null,
    city: null,
    state: null,
    cnpj: null,
    brandColor: input.brandColor ?? STUDIO_BRAND_COLORS[0],
    logoFileAssetId: input.logoFileAssetId ?? null,
    onboardingStep: input.onboardingStep ?? 0,
    onboardingCompletedAt: input.onboardingCompletedAt ?? null,
    timezone: 'America/Sao_Paulo',
    locale: 'pt-BR',
    currency: 'BRL',
    status: 'ACTIVE',
    createdAt: new Date('2026-08-26T12:00:00.000Z'),
    updatedAt: new Date('2026-08-26T12:00:00.000Z'),
    settings: {
      studioId: user.studioId,
      defaultClassDurationMinutes: 50,
      defaultClassCapacity: 6,
      cancellationNoticeHours: 12,
      maxJustifiedAbsences: 1,
      replacementCreditValidityDays: 30,
      requireJustificationText: true,
      replacementNoShowConsumesCredit: true,
    },
  };
}

function fileRecord(input: { status: FileAssetStatus }) {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    studioId: user.studioId,
    uploadedByStaffId: user.staffMemberId,
    ownerType: FileOwnerType.STUDIO,
    ownerId: user.studioId,
    storageKey: `studios/${user.studioId}/STUDIO/${user.studioId}/logo.png`,
    originalName: 'logo.png',
    mimeType: 'image/png',
    size: 120,
    checksum: null,
    status: input.status,
    createdAt: new Date('2026-08-26T12:00:00.000Z'),
    uploadedAt: input.status === FileAssetStatus.AVAILABLE ? new Date('2026-08-26T12:01:00.000Z') : null,
    deletedAt: input.status === FileAssetStatus.DELETED ? new Date('2026-08-26T12:02:00.000Z') : null,
  };
}
