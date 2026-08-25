import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FileAssetStatus, FileOwnerType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import type { Permission } from '@/shared/auth/permissions';
import { AppConfigService } from '@/shared/config/app-config.service';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from './storage.service';

type RequestUploadInput = {
  ownerType: FileOwnerType;
  ownerId: string;
  originalName?: string;
  mimeType: string;
  size: number;
  checksum?: string;
};

type CleanupInput = {
  olderThanMinutes: number;
};

type FileAssetRecord = {
  id: string;
  studioId: string;
  storageKey: string;
  mimeType: string;
  size: number;
  ownerType: FileOwnerType;
  ownerId: string;
  status: FileAssetStatus;
  deletedAt: Date | null;
};

const ALLOWED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: AppConfigService,
  ) {}

  list(user: AuthenticatedUser) {
    const ownerTypes = this.readableOwnerTypes(user);
    return this.prisma.fileAsset.findMany({
      where: {
        studioId: user.studioId,
        deletedAt: null,
        status: FileAssetStatus.AVAILABLE,
        ownerType: { in: ownerTypes },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMetadata(user: AuthenticatedUser, id: string) {
    const file = await this.findOwnedFile(user.studioId, id);
    this.assertOwnerPermission(user, file.ownerType, 'read');
    return this.prisma.fileAsset.findFirstOrThrow({
      where: { id: file.id, studioId: user.studioId, deletedAt: null },
    });
  }

  async requestUpload(user: AuthenticatedUser, baseUrl: string, input: RequestUploadInput) {
    this.assertOwnerPermission(user, input.ownerType, 'write');
    const mimeType = this.assertAllowedFile(input.mimeType, input.size);
    await this.assertOwnerBelongsToStudio(user.studioId, input.ownerType, input.ownerId);

    const storageKey = this.createStorageKey(user.studioId, input.ownerType, input.ownerId, mimeType);
    const originalName = sanitizeOriginalName(input.originalName);
    const file = await this.prisma.fileAsset.create({
      data: {
        studioId: user.studioId,
        uploadedByStaffId: user.staffMemberId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        storageKey,
        originalName,
        mimeType,
        size: input.size,
        checksum: input.checksum,
        status: FileAssetStatus.PENDING,
      },
    });
    const target = await this.storage.createUploadTarget({
      baseUrl,
      storageKey,
      mimeType,
      size: input.size,
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'files.upload_requested',
      entityType: 'FileAsset',
      entityId: file.id,
      metadata: { ownerType: input.ownerType, ownerId: input.ownerId, mimeType, size: input.size },
    });
    return { fileAsset: file, uploadUrl: target.uploadUrl, expiresAt: target.expiresAt };
  }

  async confirmUpload(user: AuthenticatedUser, id: string) {
    const file = await this.findOwnedFile(user.studioId, id);
    this.assertOwnerPermission(user, file.ownerType, 'write');
    if (file.status !== FileAssetStatus.PENDING) {
      throw new BadRequestException('File upload is not pending');
    }
    const object = await this.storage.head(file.storageKey);
    if (object.size !== file.size || object.mimeType !== file.mimeType) {
      throw new BadRequestException('Uploaded object does not match declared metadata');
    }
    const updated = await this.prisma.fileAsset.update({
      where: { id: file.id },
      data: { status: FileAssetStatus.AVAILABLE, uploadedAt: new Date() },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'files.upload_confirmed',
      entityType: 'FileAsset',
      entityId: file.id,
      metadata: { ownerType: file.ownerType, ownerId: file.ownerId, size: file.size, mimeType: file.mimeType },
    });
    return updated;
  }

  async createDownload(user: AuthenticatedUser, baseUrl: string, id: string) {
    const file = await this.findOwnedFile(user.studioId, id);
    this.assertOwnerPermission(user, file.ownerType, 'read');
    if (file.status !== FileAssetStatus.AVAILABLE) {
      throw new NotFoundException('File is not available');
    }
    const target = await this.storage.createDownloadTarget({
      baseUrl,
      storageKey: file.storageKey,
      mimeType: file.mimeType,
      size: file.size,
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'files.download_requested',
      entityType: 'FileAsset',
      entityId: file.id,
      metadata: { ownerType: file.ownerType, ownerId: file.ownerId },
    });
    return { downloadUrl: target.downloadUrl, expiresAt: target.expiresAt };
  }

  async delete(user: AuthenticatedUser, id: string) {
    const file = await this.findOwnedFile(user.studioId, id);
    this.assertOwnerPermission(user, file.ownerType, 'write');
    await this.storage.delete(file.storageKey);
    const updated = await this.prisma.fileAsset.update({
      where: { id: file.id },
      data: { status: FileAssetStatus.DELETED, deletedAt: new Date() },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'files.delete',
      entityType: 'FileAsset',
      entityId: file.id,
      metadata: { ownerType: file.ownerType, ownerId: file.ownerId },
    });
    return updated;
  }

  async cleanupPending(user: AuthenticatedUser, input: CleanupInput) {
    this.assertPermission(user, ['studio_settings.manage']);
    const olderThan = new Date(Date.now() - input.olderThanMinutes * 60_000);
    const pending = await this.prisma.fileAsset.findMany({
      where: {
        studioId: user.studioId,
        status: FileAssetStatus.PENDING,
        createdAt: { lt: olderThan },
        deletedAt: null,
      },
      take: 100,
    });
    for (const file of pending) {
      await this.storage.delete(file.storageKey);
    }
    if (pending.length > 0) {
      await this.prisma.fileAsset.updateMany({
        where: { id: { in: pending.map((file) => file.id) }, studioId: user.studioId },
        data: { status: FileAssetStatus.DELETED, deletedAt: new Date() },
      });
    }
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'files.cleanup_pending',
      entityType: 'FileAsset',
      metadata: { count: pending.length, olderThanMinutes: input.olderThanMinutes },
    });
    return { count: pending.length };
  }

  private async findOwnedFile(studioId: string, id: string): Promise<FileAssetRecord> {
    const file = await this.prisma.fileAsset.findFirstOrThrow({
      where: { id, studioId, deletedAt: null },
      select: {
        id: true,
        studioId: true,
        storageKey: true,
        mimeType: true,
        size: true,
        ownerType: true,
        ownerId: true,
        status: true,
        deletedAt: true,
      },
    });
    await this.assertOwnerBelongsToStudio(studioId, file.ownerType, file.ownerId);
    return file;
  }

  private async assertOwnerBelongsToStudio(
    studioId: string,
    ownerType: FileOwnerType,
    ownerId: string,
  ): Promise<void> {
    if (ownerType === FileOwnerType.STUDENT) {
      await this.prisma.student.findFirstOrThrow({ where: { id: ownerId, studioId, archivedAt: null } });
      return;
    }
    if (ownerType === FileOwnerType.STAFF) {
      await this.prisma.staffMember.findFirstOrThrow({ where: { id: ownerId, studioId, archivedAt: null } });
      return;
    }
    await this.prisma.assessment.findFirstOrThrow({ where: { id: ownerId, studioId } });
  }

  private assertAllowedFile(mimeType: string, size: number): keyof typeof ALLOWED_MIME_TYPES {
    if (!isAllowedMimeType(mimeType)) {
      throw new BadRequestException('Unsupported file type');
    }
    if (size < 1 || size > this.config.fileUploadMaxBytes) {
      throw new BadRequestException('File size exceeds the configured limit');
    }
    return mimeType;
  }

  private createStorageKey(
    studioId: string,
    ownerType: FileOwnerType,
    ownerId: string,
    mimeType: keyof typeof ALLOWED_MIME_TYPES,
  ): string {
    const extension = ALLOWED_MIME_TYPES[mimeType];
    return `studios/${studioId}/${ownerType}/${ownerId}/${randomUUID()}.${extension}`;
  }

  private assertOwnerPermission(user: AuthenticatedUser, ownerType: FileOwnerType, action: 'read' | 'write'): void {
    if (ownerType === FileOwnerType.ASSESSMENT) {
      this.assertPermission(user, action === 'read' ? ['assessments.read'] : ['assessments.create', 'assessments.update_draft']);
      return;
    }
    if (ownerType === FileOwnerType.STAFF) {
      this.assertPermission(user, ['staff.manage']);
      return;
    }
    this.assertPermission(user, action === 'read' ? ['students.read'] : ['students.update_basic']);
  }

  private readableOwnerTypes(user: AuthenticatedUser): FileOwnerType[] {
    if (user.role === 'ADMIN') {
      return [FileOwnerType.STUDENT, FileOwnerType.ASSESSMENT, FileOwnerType.STAFF];
    }
    const granted = new Set(user.permissions);
    const ownerTypes: FileOwnerType[] = [];
    if (granted.has('students.read')) {
      ownerTypes.push(FileOwnerType.STUDENT);
    }
    if (granted.has('assessments.read')) {
      ownerTypes.push(FileOwnerType.ASSESSMENT);
    }
    if (granted.has('staff.manage')) {
      ownerTypes.push(FileOwnerType.STAFF);
    }
    if (ownerTypes.length === 0) {
      throw new ForbiddenException('Permission denied');
    }
    return ownerTypes;
  }

  private assertPermission(user: AuthenticatedUser, permissions: Permission[]): void {
    if (user.role === 'ADMIN') {
      return;
    }
    const granted = new Set(user.permissions);
    if (!permissions.some((permission) => granted.has(permission))) {
      throw new ForbiddenException('Permission denied');
    }
  }
}

export function isAllowedMimeType(mimeType: string): mimeType is keyof typeof ALLOWED_MIME_TYPES {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TYPES, mimeType);
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
