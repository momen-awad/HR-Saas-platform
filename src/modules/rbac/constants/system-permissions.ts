// src/modules/rbac/constants/system-permissions.ts

/**
 * Complete registry of all system permissions.
 *
 * IMPORTANT: Permission codes are STABLE and MUST NEVER change
 * once deployed. Clients, JWTs, and audit logs reference these codes.
 * Adding new permissions is safe; renaming or removing is a breaking change.
 *
 * Convention: module:action
 * Actions: create, read_own, read_team, read_all, update, delete, process, approve, manage
 */

export interface PermissionDefinition {
  code: string;
  description: string;
  module: string;
  category: string;
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // ── Attendance ──
  {
    code: 'attendance:checkin',
    description: 'Check in via GPS or manual entry',
    module: 'attendance',
    category: 'Attendance',
  },
  {
    code: 'attendance:checkout',
    description: 'Check out via GPS or manual entry',
    module: 'attendance',
    category: 'Attendance',
  },
  {
    code: 'attendance:view_own',
    description: 'View own attendance records',
    module: 'attendance',
    category: 'Attendance',
  },
  {
    code: 'attendance:view_team',
    description: 'View team member attendance records',
    module: 'attendance',
    category: 'Attendance',
  },
  {
    code: 'attendance:view_all',
    description: 'View all employee attendance records',
    module: 'attendance',
    category: 'Attendance',
  },
  {
    code: 'attendance:edit',
    description: 'Manually correct attendance records',
    module: 'attendance',
    category: 'Attendance',
  },
  {
    code: 'attendance:approve',
    description: 'Approve corrected attendance entries',
    module: 'attendance',
    category: 'Attendance',
  },
  {
    code: 'attendance:manage_geofences',
    description: 'Create, update, and delete geofence zones',
    module: 'attendance',
    category: 'Attendance',
  },

  // ── Leave ──
  {
    code: 'leave:request',
    description: 'Submit leave requests',
    module: 'leave',
    category: 'Leave',
  },
  {
    code: 'leave:cancel_own',
    description: 'Cancel own pending leave requests',
    module: 'leave',
    category: 'Leave',
  },
  {
    code: 'leave:view_own',
    description: 'View own leave requests and balance',
    module: 'leave',
    category: 'Leave',
  },
  {
    code: 'leave:view_team',
    description: 'View team leave requests and calendar',
    module: 'leave',
    category: 'Leave',
  },
  {
    code: 'leave:view_all',
    description: 'View all leave requests and balances',
    module: 'leave',
    category: 'Leave',
  },
  {
    code: 'leave:approve',
    description: 'Approve or reject leave requests',
    module: 'leave',
    category: 'Leave',
  },
  {
    code: 'leave:adjust_balance',
    description: 'Manually adjust leave balances',
    module: 'leave',
    category: 'Leave',
  },
  {
    code: 'leave:manage_types',
    description: 'Create and configure leave types',
    module: 'leave',
    category: 'Leave',
  },

  // ── Payroll ──
  {
    code: 'payroll:view_own',
    description: 'View own payslips and payroll history',
    module: 'payroll',
    category: 'Payroll',
  },
  {
    code: 'payroll:view_all',
    description: 'View all employee payroll data',
    module: 'payroll',
    category: 'Payroll',
  },
  {
    code: 'payroll:process',
    description: 'Initiate and calculate payroll runs',
    module: 'payroll',
    category: 'Payroll',
  },
  {
    code: 'payroll:approve',
    description: 'Approve calculated payroll runs',
    module: 'payroll',
    category: 'Payroll',
  },
  {
    code: 'payroll:finalize',
    description: 'Finalize and lock payroll runs',
    module: 'payroll',
    category: 'Payroll',
  },
  {
    code: 'payroll:adjust',
    description: 'Create payroll adjustment entries',
    module: 'payroll',
    category: 'Payroll',
  },
  {
    code: 'payroll:settle',
    description: 'Process settlement payroll for terminations',
    module: 'payroll',
    category: 'Payroll',
  },

  // ── Employee ──
  {
    code: 'employee:view_own',
    description: 'View own employee profile',
    module: 'employee',
    category: 'Employee',
  },
  {
    code: 'employee:view_team',
    description: 'View team member profiles',
    module: 'employee',
    category: 'Employee',
  },
  {
    code: 'employee:view_all',
    description: 'View all employee profiles',
    module: 'employee',
    category: 'Employee',
  },
  {
    code: 'employee:create',
    description: 'Create new employees',
    module: 'employee',
    category: 'Employee',
  },
  {
    code: 'employee:update',
    description: 'Update employee profiles',
    module: 'employee',
    category: 'Employee',
  },
  {
    code: 'employee:terminate',
    description: 'Terminate employees',
    module: 'employee',
    category: 'Employee',
  },
  {
    code: 'employee:manage_salary',
    description: 'View and update salary structures',
    module: 'employee',
    category: 'Employee',
  },

  // ── Roles & Permissions ──
  {
    code: 'rbac:view_roles',
    description: 'View roles and their permissions',
    module: 'rbac',
    category: 'Administration',
  },
  {
    code: 'rbac:manage_roles',
    description: 'Create, update, and delete custom roles',
    module: 'rbac',
    category: 'Administration',
  },
  {
    code: 'rbac:assign_roles',
    description: 'Assign and revoke roles for employees',
    module: 'rbac',
    category: 'Administration',
  },

  // ── Configuration ──
  {
    code: 'config:view',
    description: 'View tenant configuration and policies',
    module: 'config',
    category: 'Configuration',
  },
  {
    code: 'config:manage',
    description: 'Update tenant policies, shifts, and holidays',
    module: 'config',
    category: 'Configuration',
  },

  // ── Department ──
  {
    code: 'department:view',
    description: 'View departments',
    module: 'department',
    category: 'Organization',
  },
  {
    code: 'department:manage',
    description: 'Create, update, and delete departments',
    module: 'department',
    category: 'Organization',
  },

  // ── Notification ──
  {
    code: 'notification:view_own',
    description: 'View own notifications',
    module: 'notification',
    category: 'Notification',
  },
  {
    code: 'notification:manage_preferences',
    description: 'Manage own notification preferences',
    module: 'notification',
    category: 'Notification',
  },

  // ── Audit ──
  {
    code: 'audit:view',
    description: 'View audit logs',
    module: 'audit',
    category: 'Compliance',
  },
  {
    code: 'audit:export',
    description: 'Export audit logs',
    module: 'audit',
    category: 'Compliance',
  },

  // ── Tenant Administration ──
  {
    code: 'tenant:view_settings',
    description: 'View tenant settings',
    module: 'tenant',
    category: 'Administration',
  },
  {
    code: 'tenant:manage_settings',
    description: 'Update tenant settings',
    module: 'tenant',
    category: 'Administration',
  },

  // ── Reports ──
  {
    code: 'reports:attendance',
    description: 'Generate attendance reports',
    module: 'reports',
    category: 'Reports',
  },
  {
    code: 'reports:payroll',
    description: 'Generate payroll reports',
    module: 'reports',
    category: 'Reports',
  },
  {
    code: 'reports:leave',
    description: 'Generate leave reports',
    module: 'reports',
    category: 'Reports',
  },
];

/**
 * Helper to get permission codes by module.
 */
export function getPermissionsByModule(module: string): string[] {
  return SYSTEM_PERMISSIONS
    .filter((p) => p.module === module)
    .map((p) => p.code);
}

/**
 * Get all permission codes.
 */
export function getAllPermissionCodes(): string[] {
  return SYSTEM_PERMISSIONS.map((p) => p.code);
}