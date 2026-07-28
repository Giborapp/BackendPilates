import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { DeviceContext, RequestWithAuth } from './auth.types';

export const CurrentDevice = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DeviceContext => {
    const request = ctx.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.device) {
      throw new UnauthorizedException('Device authentication required');
    }
    return request.device;
  },
);
