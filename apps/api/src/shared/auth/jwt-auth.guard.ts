import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { mergePermissions } from './permissions';
import type { Request } from 'express';
import type { RequestWithAuth } from './auth.types';

type AccessPayload = {
  sub: string;
  studioId: string;
  deviceSessionId: string;
  typ: 'access';
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth & Request>();
    const header = String(request.headers['authorization'] ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const payload = await this.jwt.verifyAsync<AccessPayload>(token, {
      secret: this.config.accessTokenSecret,
    });
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid token');
    }

    const [staff, device] = await Promise.all([
      this.prisma.staffMember.findFirst({
        where: { id: payload.sub, studioId: payload.studioId, active: true, archivedAt: null },
      }),
      this.prisma.deviceSession.findFirst({
        where: {
          id: payload.deviceSessionId,
          studioId: payload.studioId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    if (!staff || !device) {
      throw new UnauthorizedException('Invalid session');
    }

    request.user = {
      studioId: staff.studioId,
      staffMemberId: staff.id,
      deviceSessionId: device.id,
      role: staff.role,
      permissions: mergePermissions(staff.role, staff.permissions),
    };
    return true;
  }
}
