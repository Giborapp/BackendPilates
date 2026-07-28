import type { Role } from '@prisma/client';

export type AuthenticatedUser = {
  studioId: string;
  staffMemberId: string;
  deviceSessionId: string;
  role: Role;
  permissions: string[];
};

export type DeviceContext = {
  studioId: string;
  deviceSessionId: string;
};

export type RequestWithAuth = Request & {
  user?: AuthenticatedUser;
  device?: DeviceContext;
};
