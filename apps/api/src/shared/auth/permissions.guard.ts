import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ANY_PERMISSIONS_KEY, PERMISSIONS_KEY, type Permission } from './permissions';
import type { RequestWithAuth } from './auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const anyRequired = this.reflector.getAllAndOverride<Permission[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if ((!required || required.length === 0) && (!anyRequired || anyRequired.length === 0)) {
      return true;
    }
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Permission denied');
    }
    if (user.role === 'ADMIN') {
      return true;
    }
    const granted = new Set(user.permissions);
    if (
      anyRequired &&
      anyRequired.length > 0 &&
      anyRequired.some((permission) => granted.has(permission))
    ) {
      return true;
    }
    if (!required || required.length === 0) {
      throw new ForbiddenException('Permission denied');
    }
    const allowed = required.every((permission) => granted.has(permission));
    if (!allowed) {
      throw new ForbiddenException('Permission denied');
    }
    return true;
  }
}
