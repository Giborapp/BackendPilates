import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { FileAssetStatus, FileOwnerType, Role } from '@prisma/client';
import type { AuthenticatedUser } from '../src/shared/auth/auth.types';
import type { AppConfigService } from '../src/shared/config/app-config.service';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import type { AuditService } from '../src/modules/audit/audit.service';
import { FilesService } from '../src/modules/files/files.service';
import { StorageService, type StoredObjectHead } from '../src/modules/files/storage.service';

const user: AuthenticatedUser = {
  studioId: '11111111-1111-4111-8111-111111111111',
  staffMemberId: '22222222-2222-4222-8222-222222222222',
  deviceSessionId: '33333333-3333-4333-8333-333333333333',
  role: Role.RECEPTION,
  permissions: ['students.read', 'students.update_basic'],
};

const studentId = '44444444-4444-4444-8444-444444444444';
const fileId = '55555555-5555-4555-8555-555555555555';

describe('FilesService', () => {
  it('lists only files allowed by the user permissions', async () => {
    const context = createServiceContext();
    context.prisma.fileAsset.findMany.mockResolvedValue([]);

    await context.service.list(user);

    expect(context.prisma.fileAsset.findMany).toHaveBeenCalledWith({
      where: {
        studioId: user.studioId,
        deletedAt: null,
        status: FileAssetStatus.AVAILABLE,
        ownerType: { in: [FileOwnerType.STUDENT] },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('creates an authorized pending upload', async () => {
    const context = createServiceContext();
    context.prisma.student.findFirstOrThrow.mockResolvedValue({ id: studentId });
    context.prisma.fileAsset.create.mockResolvedValue(fileRecord({ status: FileAssetStatus.PENDING }));
    context.storage.createUploadTarget.mockResolvedValue({
      uploadUrl: 'https://signed-put.example',
      expiresAt: new Date('2026-08-25T12:05:00.000Z'),
    });

    const result = await context.service.requestUpload(user, 'http://localhost:3000', {
      ownerType: FileOwnerType.STUDENT,
      ownerId: studentId,
      originalName: '../exam.pdf',
      mimeType: 'application/pdf',
      size: 120,
    });

    expect(result.uploadUrl).toBe('https://signed-put.example');
    expect(context.prisma.fileAsset.create).toHaveBeenCalled();
    expect(context.prisma.fileAsset.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        studioId: user.studioId,
        ownerType: FileOwnerType.STUDENT,
        ownerId: studentId,
        originalName: 'exam.pdf',
        mimeType: 'application/pdf',
        size: 120,
        status: FileAssetStatus.PENDING,
      },
    });
  });

  it('rejects forbidden file types', async () => {
    const context = createServiceContext();
    await expect(
      context.service.requestUpload(user, 'http://localhost:3000', {
        ownerType: FileOwnerType.STUDENT,
        ownerId: studentId,
        mimeType: 'text/html',
        size: 120,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects files above the configured limit', async () => {
    const context = createServiceContext({ fileUploadMaxBytes: 100 });
    await expect(
      context.service.requestUpload(user, 'http://localhost:3000', {
        ownerType: FileOwnerType.STUDENT,
        ownerId: studentId,
        mimeType: 'application/pdf',
        size: 101,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects users without owner permissions', async () => {
    const context = createServiceContext();
    await expect(
      context.service.requestUpload({ ...user, permissions: ['students.read'] }, 'http://localhost:3000', {
        ownerType: FileOwnerType.STUDENT,
        ownerId: studentId,
        mimeType: 'application/pdf',
        size: 100,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an owner from another studio', async () => {
    const context = createServiceContext();
    context.prisma.student.findFirstOrThrow.mockRejectedValue(new NotFoundException('Not found'));
    await expect(
      context.service.requestUpload(user, 'http://localhost:3000', {
        ownerType: FileOwnerType.STUDENT,
        ownerId: studentId,
        mimeType: 'application/pdf',
        size: 100,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects confirmation when the object does not exist', async () => {
    const context = createServiceContext();
    context.prisma.fileAsset.findFirstOrThrow.mockResolvedValue(fileRecord({ status: FileAssetStatus.PENDING }));
    context.prisma.student.findFirstOrThrow.mockResolvedValue({ id: studentId });
    context.storage.head.mockRejectedValue(new NotFoundException('Missing object'));

    await expect(context.service.confirmUpload(user, fileId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates an authorized download URL', async () => {
    const context = createServiceContext();
    context.prisma.fileAsset.findFirstOrThrow.mockResolvedValue(fileRecord({ status: FileAssetStatus.AVAILABLE }));
    context.prisma.student.findFirstOrThrow.mockResolvedValue({ id: studentId });
    context.storage.createDownloadTarget.mockResolvedValue({
      downloadUrl: 'https://signed-get.example',
      expiresAt: new Date('2026-08-25T12:02:00.000Z'),
    });

    const result = await context.service.createDownload(user, 'http://localhost:3000', fileId);

    expect(result.downloadUrl).toBe('https://signed-get.example');
  });

  it('deletes the object and synchronizes FileAsset', async () => {
    const context = createServiceContext();
    context.prisma.fileAsset.findFirstOrThrow.mockResolvedValue(fileRecord({ status: FileAssetStatus.AVAILABLE }));
    context.prisma.student.findFirstOrThrow.mockResolvedValue({ id: studentId });
    context.prisma.fileAsset.update.mockResolvedValue(fileRecord({ status: FileAssetStatus.DELETED }));

    await context.service.delete(user, fileId);

    expect(context.storage.delete).toHaveBeenCalledWith(expect.stringContaining(`studios/${user.studioId}`));
    expect(context.prisma.fileAsset.update).toHaveBeenCalled();
    expect(context.prisma.fileAsset.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: fileId },
      data: { status: FileAssetStatus.DELETED },
    });
  });

  it('prevents cross-studio file access', async () => {
    const context = createServiceContext();
    context.prisma.fileAsset.findFirstOrThrow.mockRejectedValue(new NotFoundException('Not found'));

    await expect(context.service.createDownload(user, 'http://localhost:3000', fileId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('allows studio-owned files only for studio settings managers', async () => {
    const context = createServiceContext();
    context.prisma.studio.findFirstOrThrow.mockResolvedValue({ id: user.studioId });
    context.prisma.fileAsset.create.mockResolvedValue({
      ...fileRecord({ status: FileAssetStatus.PENDING }),
      ownerType: FileOwnerType.STUDIO,
      ownerId: user.studioId,
    });
    context.storage.createUploadTarget.mockResolvedValue({
      uploadUrl: 'https://signed-logo-put.example',
      expiresAt: new Date('2026-08-25T12:05:00.000Z'),
    });

    await expect(
      context.service.requestUpload(user, 'http://localhost:3000', {
        ownerType: FileOwnerType.STUDIO,
        ownerId: user.studioId,
        mimeType: 'image/png',
        size: 120,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const result = await context.service.requestUpload(
      { ...user, permissions: ['studio_settings.manage'] },
      'http://localhost:3000',
      {
        ownerType: FileOwnerType.STUDIO,
        ownerId: user.studioId,
        mimeType: 'image/png',
        size: 120,
      },
    );

    expect(result.uploadUrl).toBe('https://signed-logo-put.example');
  });

  it('rejects studio-owned files when ownerId is not the authenticated studio', async () => {
    const context = createServiceContext();

    await expect(
      context.service.requestUpload(
        { ...user, permissions: ['studio_settings.manage'] },
        'http://localhost:3000',
        {
          ownerType: FileOwnerType.STUDIO,
          ownerId: '99999999-9999-4999-8999-999999999999',
          mimeType: 'image/png',
          size: 120,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('StorageService local driver', () => {
  let storagePath: string;

  beforeEach(async () => {
    storagePath = await mkdtemp(join(tmpdir(), 'pilates-storage-'));
  });

  afterEach(async () => {
    await rm(storagePath, { recursive: true, force: true });
  });

  it('stores, verifies, downloads, and deletes a local object through signed URLs', async () => {
    const storage = new StorageService(createConfig({ localStoragePath: storagePath }));
    const target = await storage.createUploadTarget({
      baseUrl: 'http://localhost:3000',
      storageKey: `studios/${user.studioId}/STUDENT/${studentId}/file.pdf`,
      mimeType: 'application/pdf',
      size: 3,
    });
    const token = new URL(target.uploadUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    await storage.acceptLocalUpload(token ?? '', requestFromBuffer(Buffer.from('pdf'), 'application/pdf'));

    await expect(storage.head(`studios/${user.studioId}/STUDENT/${studentId}/file.pdf`)).resolves.toEqual({
      size: 3,
      mimeType: 'application/pdf',
    });

    const download = await storage.createDownloadTarget({
      baseUrl: 'http://localhost:3000',
      storageKey: `studios/${user.studioId}/STUDENT/${studentId}/file.pdf`,
      mimeType: 'application/pdf',
      size: 3,
    });
    const downloadToken = new URL(download.downloadUrl).searchParams.get('token');
    await expect(storage.openLocalDownload(downloadToken ?? '')).resolves.toMatchObject({
      size: 3,
      mimeType: 'application/pdf',
    });

    await storage.delete(`studios/${user.studioId}/STUDENT/${studentId}/file.pdf`);
    await expect(storage.head(`studios/${user.studioId}/STUDENT/${studentId}/file.pdf`)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

function createServiceContext(options: { fileUploadMaxBytes?: number } = {}) {
  const prisma = {
    student: { findFirstOrThrow: jest.fn() },
    studio: { findFirstOrThrow: jest.fn() },
    staffMember: { findFirstOrThrow: jest.fn() },
    assessment: { findFirstOrThrow: jest.fn() },
    fileAsset: {
      create: jest.fn<Promise<unknown>, [{ data: Record<string, unknown> }]>(),
      findFirstOrThrow: jest.fn(),
      findMany: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>(),
      update: jest.fn<Promise<unknown>, [{ where: { id: string }; data: Record<string, unknown> }]>(),
      updateMany: jest.fn(),
    },
  };
  const storage = {
    createUploadTarget: jest.fn(),
    head: jest.fn<Promise<StoredObjectHead>, [string]>(),
    createDownloadTarget: jest.fn(),
    delete: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const service = new FilesService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
    audit as unknown as AuditService,
    createConfig({ fileUploadMaxBytes: options.fileUploadMaxBytes }),
  );
  return { service, prisma, storage, audit };
}

function createConfig(options: { fileUploadMaxBytes?: number; localStoragePath?: string } = {}): AppConfigService {
  return {
    get storageDriver() {
      return 'local';
    },
    get localStoragePath() {
      return options.localStoragePath ?? './storage';
    },
    get fileUploadMaxBytes() {
      return options.fileUploadMaxBytes ?? 10_000_000;
    },
    get accessTokenSecret() {
      return 'a'.repeat(32);
    },
  } as AppConfigService;
}

function fileRecord(input: { status: FileAssetStatus }) {
  return {
    id: fileId,
    studioId: user.studioId,
    uploadedByStaffId: user.staffMemberId,
    ownerType: FileOwnerType.STUDENT,
    ownerId: studentId,
    storageKey: `studios/${user.studioId}/STUDENT/${studentId}/file.pdf`,
    originalName: 'file.pdf',
    mimeType: 'application/pdf',
    size: 100,
    checksum: null,
    status: input.status,
    createdAt: new Date('2026-08-25T12:00:00.000Z'),
    uploadedAt: input.status === FileAssetStatus.AVAILABLE ? new Date('2026-08-25T12:01:00.000Z') : null,
    deletedAt: input.status === FileAssetStatus.DELETED ? new Date('2026-08-25T12:02:00.000Z') : null,
  };
}

function requestFromBuffer(buffer: Buffer, mimeType: string): Request {
  const request = Readable.from([buffer]);
  return Object.assign(request, {
    headers: {
      'content-type': mimeType,
      'content-length': String(buffer.length),
    },
  }) as unknown as Request;
}
