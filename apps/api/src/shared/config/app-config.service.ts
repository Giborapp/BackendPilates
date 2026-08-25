import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get corsOrigins(): string[] {
    return this.config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get accessTokenSecret(): string {
    return this.config.get('ACCESS_TOKEN_SECRET', { infer: true });
  }

  get refreshTokenSecret(): string {
    return this.config.get('REFRESH_TOKEN_SECRET', { infer: true });
  }

  get deviceTokenSecret(): string {
    return this.config.get('DEVICE_TOKEN_SECRET', { infer: true });
  }

  get accessTokenExpiresIn(): string {
    return this.config.get('ACCESS_TOKEN_EXPIRES_IN', { infer: true });
  }

  get refreshTokenExpiresIn(): string {
    return this.config.get('REFRESH_TOKEN_EXPIRES_IN', { infer: true });
  }

  get deviceSessionExpiresIn(): string {
    return this.config.get('DEVICE_SESSION_EXPIRES_IN', { infer: true });
  }

  get cookieDomain(): string | undefined {
    const domain = this.config.get('COOKIE_DOMAIN', { infer: true });
    return domain.length > 0 ? domain : undefined;
  }

  get storageDriver(): Env['STORAGE_DRIVER'] {
    return this.config.get('STORAGE_DRIVER', { infer: true });
  }

  get localStoragePath(): string {
    return this.config.get('LOCAL_STORAGE_PATH', { infer: true });
  }

  get fileUploadMaxBytes(): number {
    return this.config.get('FILE_UPLOAD_MAX_BYTES', { infer: true });
  }

  get bootstrapSetupToken(): string | undefined {
    return this.config.get('BOOTSTRAP_SETUP_TOKEN', { infer: true });
  }

  get s3Endpoint(): string {
    return this.config.get('S3_ENDPOINT', { infer: true });
  }

  get s3Region(): string {
    return this.config.get('S3_REGION', { infer: true });
  }

  get s3Bucket(): string {
    return this.config.get('S3_BUCKET', { infer: true });
  }

  get s3AccessKeyId(): string {
    return this.config.get('S3_ACCESS_KEY_ID', { infer: true });
  }

  get s3SecretAccessKey(): string {
    return this.config.get('S3_SECRET_ACCESS_KEY', { infer: true });
  }
}
