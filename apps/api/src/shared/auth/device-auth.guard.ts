import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import type { RequestWithAuth } from './auth.types';

type DevicePayload = {
  sub: string;
  studioId: string;
  typ: 'device';
};

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth & { cookies?: Record<string, string> }>();
    const token = request.cookies?.device_token;
    if (!token) {
      throw new UnauthorizedException('Device authentication required');
    }
    const payload = await this.jwt.verifyAsync<DevicePayload>(token, {
      secret: this.config.deviceTokenSecret,
    });
    if (payload.typ !== 'device') {
      throw new UnauthorizedException('Invalid device token');
    }
    const device = await this.prisma.deviceSession.findFirst({
      where: {
        id: payload.sub,
        studioId: payload.studioId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!device) {
      throw new UnauthorizedException('Device revoked or expired');
    }
    request.device = { studioId: payload.studioId, deviceSessionId: payload.sub };
    await this.prisma.deviceSession.update({
      where: { id: device.id },
      data: { lastUsedAt: new Date() },
    });
    return true;
  }
}
