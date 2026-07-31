import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AppConfigService } from '@/shared/config/app-config.service';
import { AuditService } from '../audit/audit.service';
import { mergePermissions } from '@/shared/auth/permissions';
import { addDuration, randomToken, sha256 } from './token.util';
import { assertRegistrationPinsAllowed } from './studio-registration';

type StudioLoginInput = {
  email: string;
  password: string;
  deviceName?: string;
  userAgent?: string;
};

type StudioRegisterInput = {
  studioName: string;
  email: string;
  password: string;
  adminName: string;
  adminPin: string;
  professionalName?: string;
  professionalPin?: string;
  receptionName?: string;
  receptionPin?: string;
  deviceName?: string;
  userAgent?: string;
};

type PinAttempt = {
  count: number;
  lockedUntil?: Date;
};

@Injectable()
export class AuthService {
  private readonly pinAttempts = new Map<string, PinAttempt>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  async registerStudio(input: StudioRegisterInput) {
    const email = input.email.trim().toLowerCase();
    const studioName = input.studioName.trim();
    const professionalName = input.professionalName?.trim();
    const receptionName = input.receptionName?.trim();
    assertRegistrationPinsAllowed([
      { label: 'Admin PIN', pin: input.adminPin },
      { label: 'Professional PIN', pin: input.professionalPin },
      { label: 'Reception PIN', pin: input.receptionPin },
    ]);
    assertOptionalStaffComplete('Professional', professionalName, input.professionalPin);
    assertOptionalStaffComplete('Reception', receptionName, input.receptionPin);

    const existing = await this.prisma.studio.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A studio with this e-mail already exists');
    }

    const now = new Date();
    const rawDeviceToken = randomToken();
    const deviceExpiresAt = addDuration(now, this.config.deviceSessionExpiresIn);
    const passwordHash = await argon2.hash(input.password);
    const adminPinHash = await argon2.hash(input.adminPin);
    const professionalPinHash = input.professionalPin
      ? await argon2.hash(input.professionalPin)
      : undefined;
    const receptionPinHash = input.receptionPin ? await argon2.hash(input.receptionPin) : undefined;

    const created = await this.prisma.$transaction(async (tx) => {
      const studio = await tx.studio.create({
        data: {
          name: studioName,
          slug: await this.uniqueSlug(studioName),
          email,
          passwordHash,
          settings: { create: {} },
        },
      });

      const admin = await tx.staffMember.create({
        data: {
          studioId: studio.id,
          name: input.adminName.trim(),
          role: Role.ADMIN,
          pinHash: adminPinHash,
          pinLookupHash: sha256(`${studio.id}:${input.adminPin}`),
        },
      });

      if (professionalName && input.professionalPin && professionalPinHash) {
        await tx.staffMember.create({
          data: {
            studioId: studio.id,
            name: professionalName,
            role: Role.PROFESSIONAL,
            pinHash: professionalPinHash,
            pinLookupHash: sha256(`${studio.id}:${input.professionalPin}`),
          },
        });
      }

      if (receptionName && input.receptionPin && receptionPinHash) {
        await tx.staffMember.create({
          data: {
            studioId: studio.id,
            name: receptionName,
            role: Role.RECEPTION,
            pinHash: receptionPinHash,
            pinLookupHash: sha256(`${studio.id}:${input.receptionPin}`),
          },
        });
      }

      const device = await tx.deviceSession.create({
        data: {
          studioId: studio.id,
          tokenHash: sha256(rawDeviceToken),
          name: input.deviceName,
          userAgent: input.userAgent,
          expiresAt: deviceExpiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          studioId: studio.id,
          actorStaffId: admin.id,
          action: 'studio.register',
          entityType: 'Studio',
          entityId: studio.id,
          metadata: { deviceName: input.deviceName ?? null },
        },
      });

      return { studio, device };
    });

    const deviceToken = await this.jwt.signAsync(
      { sub: created.device.id, studioId: created.studio.id, typ: 'device' },
      { secret: this.config.deviceTokenSecret, expiresIn: this.config.deviceSessionExpiresIn },
    );

    return {
      deviceToken,
      studio: {
        id: created.studio.id,
        name: created.studio.name,
        timezone: created.studio.timezone,
        locale: created.studio.locale,
      },
      expiresAt: deviceExpiresAt,
    };
  }

  async studioLogin(input: StudioLoginInput) {
    const email = input.email.trim().toLowerCase();
    const studio = await this.prisma.studio.findUnique({ where: { email } });
    if (!studio || studio.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }
    const passwordOk = await argon2.verify(studio.passwordHash, input.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const now = new Date();
    const rawToken = randomToken();
    const expiresAt = addDuration(now, this.config.deviceSessionExpiresIn);
    const device = await this.prisma.deviceSession.create({
      data: {
        studioId: studio.id,
        tokenHash: sha256(rawToken),
        name: input.deviceName,
        userAgent: input.userAgent,
        expiresAt,
      },
    });
    const deviceJwt = await this.jwt.signAsync(
      { sub: device.id, studioId: studio.id, typ: 'device' },
      { secret: this.config.deviceTokenSecret, expiresIn: this.config.deviceSessionExpiresIn },
    );
    await this.audit.record({
      studioId: studio.id,
      action: 'auth.studio_login',
      entityType: 'DeviceSession',
      entityId: device.id,
      metadata: { deviceName: input.deviceName ?? null },
    });
    return {
      deviceToken: deviceJwt,
      studio: {
        id: studio.id,
        name: studio.name,
        timezone: studio.timezone,
        locale: studio.locale,
      },
      expiresAt,
    };
  }

  async deviceStatus(studioId: string, deviceSessionId: string) {
    const device = await this.prisma.deviceSession.findFirst({
      where: { id: deviceSessionId, studioId, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { studio: true },
    });
    if (!device) {
      throw new UnauthorizedException('Device revoked or expired');
    }
    return {
      connected: true,
      studio: { id: device.studio.id, name: device.studio.name, timezone: device.studio.timezone },
      device: { id: device.id, name: device.name, lastUsedAt: device.lastUsedAt },
    };
  }

  async unlockWithPin(studioId: string, deviceSessionId: string, pin: string) {
    const key = `${studioId}:${deviceSessionId}`;
    const attempt = this.pinAttempts.get(key);
    if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
      throw new ForbiddenException('PIN temporarily locked');
    }
    const pinLookupHash = sha256(`${studioId}:${pin}`);
    const staff = await this.prisma.staffMember.findFirst({
      where: { studioId, pinLookupHash, archivedAt: null },
    });
    const valid = staff ? await argon2.verify(staff.pinHash, pin) : false;
    if (!staff || !valid) {
      this.registerFailedPin(key);
      throw new UnauthorizedException('Invalid PIN');
    }
    if (!staff.active) {
      throw new UnauthorizedException('Invalid PIN');
    }
    this.pinAttempts.delete(key);
    const tokens = await this.createStaffSession(studioId, deviceSessionId, staff.id);
    await this.prisma.staffMember.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.record({
      studioId,
      actorStaffId: staff.id,
      action: 'auth.pin_unlock',
      entityType: 'StaffMember',
      entityId: staff.id,
    });
    return {
      ...tokens,
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        permissions: mergePermissions(staff.role, staff.permissions),
      },
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }
    const payload = await this.jwt.verifyAsync<{ sub: string; typ: 'refresh' }>(refreshToken, {
      secret: this.config.refreshTokenSecret,
    });
    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const existing = await this.prisma.refreshSession.findUnique({ where: { id: payload.sub } });
    if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const valid = await argon2.verify(existing.tokenHash, refreshToken);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshSession.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    return this.createStaffSession(
      existing.studioId,
      existing.deviceSessionId,
      existing.staffMemberId,
    );
  }

  async lock(studioId: string, staffMemberId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { studioId, staffMemberId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      studioId,
      actorStaffId: staffMemberId,
      action: 'auth.session_lock',
      entityType: 'StaffMember',
      entityId: staffMemberId,
    });
  }

  async studioLogout(
    studioId: string,
    deviceSessionId: string,
    actorStaffId?: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshSession.updateMany({
        where: { studioId, deviceSessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.deviceSession.updateMany({
        where: { studioId, id: deviceSessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.record({
      studioId,
      actorStaffId,
      action: 'auth.studio_logout',
      entityType: 'DeviceSession',
      entityId: deviceSessionId,
    });
  }

  async me(studioId: string, staffMemberId: string) {
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffMemberId, studioId, active: true, archivedAt: null },
      select: {
        id: true,
        name: true,
        photoUrl: true,
        role: true,
        permissions: true,
        lastLoginAt: true,
      },
    });
    if (!staff) {
      throw new UnauthorizedException('Invalid session');
    }
    return { ...staff, permissions: mergePermissions(staff.role, staff.permissions) };
  }

  private registerFailedPin(key: string): void {
    const current = this.pinAttempts.get(key) ?? { count: 0 };
    const count = current.count + 1;
    this.pinAttempts.set(key, {
      count,
      lockedUntil: count >= 5 ? new Date(Date.now() + 5 * 60_000) : undefined,
    });
  }

  private async createStaffSession(
    studioId: string,
    deviceSessionId: string,
    staffMemberId: string,
  ) {
    const now = new Date();
    const refreshExpiresAt = addDuration(now, this.config.refreshTokenExpiresIn);
    const refreshSession = await this.prisma.refreshSession.create({
      data: {
        studioId,
        staffMemberId,
        deviceSessionId,
        tokenHash: 'pending',
        expiresAt: refreshExpiresAt,
      },
    });
    const accessToken = await this.jwt.signAsync(
      { sub: staffMemberId, studioId, deviceSessionId, typ: 'access', role: Role.CUSTOM },
      { secret: this.config.accessTokenSecret, expiresIn: this.config.accessTokenExpiresIn },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: refreshSession.id, typ: 'refresh' },
      { secret: this.config.refreshTokenSecret, expiresIn: this.config.refreshTokenExpiresIn },
    );
    await this.prisma.refreshSession.update({
      where: { id: refreshSession.id },
      data: { tokenHash: await argon2.hash(refreshToken) },
    });
    return { accessToken, refreshToken, refreshExpiresAt };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
      const slug = `${base}${suffix}`;
      const existing = await this.prisma.studio.findUnique({ where: { slug } });
      if (!existing) {
        return slug;
      }
    }
    return `${base}-${randomToken().slice(0, 8)}`;
  }
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : `studio-${randomToken().slice(0, 8)}`;
}

function assertOptionalStaffComplete(
  label: string,
  name: string | undefined,
  pin: string | undefined,
): void {
  if ((name && !pin) || (!name && pin)) {
    throw new BadRequestException(`${label} name and PIN must be filled together`);
  }
}
