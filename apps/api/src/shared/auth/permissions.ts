import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export const PERMISSIONS = [
  'dashboard.read',
  'classes.read_own',
  'classes.read_all',
  'classes.create',
  'classes.update',
  'classes.cancel',
  'attendance.read',
  'attendance.manage',
  'students.read',
  'students.create',
  'students.update_basic',
  'students.update_sensitive',
  'students.archive',
  'assessments.read',
  'assessments.create',
  'assessments.update_draft',
  'assessment_templates.manage',
  'trial_students.manage',
  'payments.read',
  'payments.manage',
  'reports.read',
  'staff.manage',
  'permissions.manage',
  'studio_settings.manage',
  'audit_logs.read',
  'devices.manage',
  'capacity.override',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export function defaultPermissionsForRole(role: string): Permission[] {
  if (role === 'ADMIN') {
    return [...PERMISSIONS];
  }
  if (role === 'PROFESSIONAL') {
    return [
      'dashboard.read',
      'classes.read_own',
      'attendance.read',
      'attendance.manage',
      'students.read',
      'assessments.read',
      'assessments.create',
      'assessments.update_draft',
      'trial_students.manage',
    ];
  }
  if (role === 'RECEPTION') {
    return [
      'dashboard.read',
      'classes.read_all',
      'attendance.read',
      'attendance.manage',
      'students.read',
      'students.create',
      'students.update_basic',
      'trial_students.manage',
    ];
  }
  if (role === 'FINANCE') {
    return ['dashboard.read', 'students.read', 'payments.read', 'payments.manage', 'reports.read'];
  }
  return [];
}

export function mergePermissions(role: string, customPermissions: string[]): Permission[] {
  const allowed = new Set<string>(PERMISSIONS);
  const merged = new Set<Permission>(defaultPermissionsForRole(role));
  for (const permission of customPermissions) {
    if (allowed.has(permission)) {
      merged.add(permission as Permission);
    }
  }
  return [...merged];
}
