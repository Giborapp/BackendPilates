import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfigService } from '@/shared/config/app-config.service';

type UploadTarget = {
  uploadUrl: string;
  expiresAt: Date;
};

type DownloadTarget = {
  downloadUrl: string;
  expiresAt: Date;
};

export type StoredObjectHead = {
  size: number;
  mimeType: string;
};

export type LocalDownload = StoredObjectHead & {
  stream: NodeJS.ReadableStream;
};

type LocalTokenPayload = {
  operation: 'put' | 'get';
  storageKey: string;
  mimeType: string;
  size: number;
  exp: number;
};

const UPLOAD_TTL_SECONDS = 5 * 60;
const DOWNLOAD_TTL_SECONDS = 2 * 60;
const LOCAL_META_SUFFIX = '.meta.json';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client | null;

  constructor(private readonly config: AppConfigService) {
    this.s3Client =
      this.config.storageDriver === 's3'
        ? new S3Client({
            endpoint: this.config.s3Endpoint,
            region: this.config.s3Region,
            forcePathStyle: true,
            credentials: {
              accessKeyId: this.config.s3AccessKeyId,
              secretAccessKey: this.config.s3SecretAccessKey,
            },
          })
        : null;
  }

  async createUploadTarget(input: {
    baseUrl: string;
    storageKey: string;
    mimeType: string;
    size: number;
  }): Promise<UploadTarget> {
    const expiresAt = new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000);
    if (this.config.storageDriver === 'local') {
      return {
        uploadUrl: `${input.baseUrl}/files/local-upload?token=${this.signLocalToken({
          operation: 'put',
          storageKey: input.storageKey,
          mimeType: input.mimeType,
          size: input.size,
          exp: Math.floor(expiresAt.getTime() / 1000),
        })}`,
        expiresAt,
      };
    }

    const client = this.requireS3Client();
    const command = new PutObjectCommand({
      Bucket: this.config.s3Bucket,
      Key: input.storageKey,
      ContentType: input.mimeType,
      ContentLength: input.size,
    });
    return { uploadUrl: await getSignedUrl(client, command, { expiresIn: UPLOAD_TTL_SECONDS }), expiresAt };
  }

  async createDownloadTarget(input: {
    baseUrl: string;
    storageKey: string;
    mimeType: string;
    size: number;
  }): Promise<DownloadTarget> {
    const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000);
    if (this.config.storageDriver === 'local') {
      return {
        downloadUrl: `${input.baseUrl}/files/local-download?token=${this.signLocalToken({
          operation: 'get',
          storageKey: input.storageKey,
          mimeType: input.mimeType,
          size: input.size,
          exp: Math.floor(expiresAt.getTime() / 1000),
        })}`,
        expiresAt,
      };
    }

    const client = this.requireS3Client();
    const command = new GetObjectCommand({ Bucket: this.config.s3Bucket, Key: input.storageKey });
    return { downloadUrl: await getSignedUrl(client, command, { expiresIn: DOWNLOAD_TTL_SECONDS }), expiresAt };
  }

  async head(storageKey: string): Promise<StoredObjectHead> {
    if (this.config.storageDriver === 'local') {
      const objectPath = this.localObjectPath(storageKey);
      const metadata = await this.readLocalMetadata(storageKey);
      const fileStat = await stat(objectPath).catch(() => null);
      if (!fileStat?.isFile()) {
        throw new NotFoundException('Stored object not found');
      }
      return { size: fileStat.size, mimeType: metadata.mimeType };
    }

    const client = this.requireS3Client();
    const response = await client.send(new HeadObjectCommand({ Bucket: this.config.s3Bucket, Key: storageKey }));
    if (!response.ContentLength || !response.ContentType) {
      throw new NotFoundException('Stored object metadata incomplete');
    }
    return { size: response.ContentLength, mimeType: response.ContentType };
  }

  async delete(storageKey: string): Promise<void> {
    if (this.config.storageDriver === 'local') {
      await rm(this.localObjectPath(storageKey), { force: true });
      await rm(this.localMetaPath(storageKey), { force: true });
      return;
    }

    const client = this.requireS3Client();
    await client.send(new DeleteObjectCommand({ Bucket: this.config.s3Bucket, Key: storageKey }));
  }

  async acceptLocalUpload(token: string, request: Request): Promise<void> {
    const payload = this.verifyLocalToken(token, 'put');
    const contentType = readSingleHeader(request.headers['content-type']);
    if (contentType !== payload.mimeType) {
      throw new UnauthorizedException('Invalid upload content type');
    }
    const contentLength = Number(readSingleHeader(request.headers['content-length']) ?? '0');
    if (contentLength !== payload.size) {
      throw new UnauthorizedException('Invalid upload content length');
    }
    await this.writeObject({
      storageKey: payload.storageKey,
      mimeType: payload.mimeType,
      size: payload.size,
      body: request,
    });
  }

  async writeObject(input: {
    storageKey: string;
    mimeType: string;
    size: number;
    body: NodeJS.ReadableStream;
  }): Promise<void> {
    if (this.config.storageDriver !== 'local') {
      const client = this.requireS3Client();
      await client.send(new PutObjectCommand({
        Bucket: this.config.s3Bucket,
        Key: input.storageKey,
        ContentType: input.mimeType,
        ContentLength: input.size,
        Body: input.body as unknown as Readable,
      }));
      return;
    }

    const objectPath = this.localObjectPath(input.storageKey);
    await mkdir(dirname(objectPath), { recursive: true });
    const handle = await open(objectPath, 'w');
    let written = 0;
    try {
      for await (const chunk of input.body) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        written += buffer.length;
        if (written > input.size) {
          throw new UnauthorizedException('Upload exceeded declared size');
        }
        await handle.write(buffer);
      }
    } catch (error) {
      await handle.close();
      await rm(objectPath, { force: true });
      throw error;
    }
    await handle.close();
    if (written !== input.size) {
      await rm(objectPath, { force: true });
      throw new UnauthorizedException('Incomplete upload');
    }
    await writeFile(
      this.localMetaPath(input.storageKey),
      JSON.stringify({ mimeType: input.mimeType, size: input.size }),
      'utf8',
    );
  }

  async openLocalDownload(token: string): Promise<LocalDownload> {
    const payload = this.verifyLocalToken(token, 'get');
    const head = await this.head(payload.storageKey);
    if (head.size !== payload.size || head.mimeType !== payload.mimeType) {
      throw new UnauthorizedException('Invalid download token');
    }
    return { ...head, stream: createReadStream(this.localObjectPath(payload.storageKey)) };
  }

  private requireS3Client(): S3Client {
    if (!this.s3Client) {
      throw new Error('S3 storage client is not configured');
    }
    return this.s3Client;
  }

  private signLocalToken(payload: LocalTokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', this.config.accessTokenSecret)
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedPayload}.${signature}`;
  }

  private verifyLocalToken(token: string, operation: LocalTokenPayload['operation']): LocalTokenPayload {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid file token');
    }
    const expectedSignature = createHmac('sha256', this.config.accessTokenSecret)
      .update(encodedPayload)
      .digest('base64url');
    if (!safeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid file token');
    }
    const payload = parseJsonObject(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<LocalTokenPayload>;
    if (
      payload.operation !== operation ||
      typeof payload.storageKey !== 'string' ||
      typeof payload.mimeType !== 'string' ||
      typeof payload.size !== 'number' ||
      typeof payload.exp !== 'number' ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException('Invalid file token');
    }
    return {
      operation: payload.operation,
      storageKey: payload.storageKey,
      mimeType: payload.mimeType,
      size: payload.size,
      exp: payload.exp,
    };
  }

  private localObjectPath(storageKey: string): string {
    const root = resolve(this.config.localStoragePath);
    const target = resolve(root, storageKey);
    const relativeTarget = relative(root, target);
    if (relativeTarget.startsWith('..') || isAbsolute(relativeTarget)) {
      throw new UnauthorizedException('Invalid storage key');
    }
    return target;
  }

  private localMetaPath(storageKey: string): string {
    return `${this.localObjectPath(storageKey)}${LOCAL_META_SUFFIX}`;
  }

  private async readLocalMetadata(storageKey: string): Promise<StoredObjectHead> {
    const raw = await readFile(this.localMetaPath(storageKey), 'utf8').catch(() => null);
    if (!raw) {
      throw new NotFoundException('Stored object metadata not found');
    }
    const metadata = parseJsonObject(raw) as Partial<StoredObjectHead>;
    if (typeof metadata.mimeType !== 'string' || typeof metadata.size !== 'number') {
      throw new NotFoundException('Stored object metadata invalid');
    }
    return { mimeType: metadata.mimeType, size: metadata.size };
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function readSingleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
