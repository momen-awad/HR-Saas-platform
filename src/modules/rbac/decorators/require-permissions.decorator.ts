// src/modules/rbac/decorators/require-permissions.decorator.ts

import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';
export const PERMISSION_MODE_KEY = 'permission_mode';

export type PermissionMode = 'ALL' | 'ANY';

/**
 * Decorator to specify required permissions for a route.
 *
 * Usage:
 *   @RequirePermissions('payroll:process')
 *   async initiatePayrollRun() { ... }
 *
 *   // Require ALL listed permissions
 *   @RequirePermissions('employee:create', 'employee:manage_salary')
 *   async createEmployeeWithSalary() { ... }
 *
 *   // Require ANY of the listed permissions
 *   @RequireAnyPermission('attendance:view_team', 'attendance:view_all')
 *   async getTeamAttendance() { ... }
 */
export const RequirePermissions = (...permissions: string[]) => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(PERMISSIONS_KEY, permissions)(target, key!, descriptor!);
    SetMetadata(PERMISSION_MODE_KEY, 'ALL' as PermissionMode)(
      target,
      key!,
      descriptor!,
    );
  };
};

/**
 * Require ANY of the listed permissions (OR logic).
 */
export const RequireAnyPermission = (...permissions: string[]) => {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(PERMISSIONS_KEY, permissions)(target, key!, descriptor!);
    SetMetadata(PERMISSION_MODE_KEY, 'ANY' as PermissionMode)(
      target,
      key!,
      descriptor!,
    );
  };
};