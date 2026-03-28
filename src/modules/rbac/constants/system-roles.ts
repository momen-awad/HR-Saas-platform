// src/modules/rbac/constants/system-roles.ts

/**
 * System role definitions with their default permission mappings.
 *
 * These are seeded for every tenant during onboarding.
 * System roles cannot be deleted by tenants.
 * Tenants CAN add custom permissions to system roles.
 * Tenants CANNOT remove the default permissions listed here.
 */

export interface SystemRoleDefinition {
  slug: string;
  name: string;
  description: string;
  permissions: string[];
}

export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    slug: 'tenant_admin',
    name: 'Tenant Administrator',
    description:
      'Full access to all tenant features. Can manage users, roles, configuration, and all business operations.',
    permissions: [
      // Tenant admin gets ALL permissions
      'attendance:checkin',
      'attendance:checkout',
      'attendance:view_own',
      'attendance:view_team',
      'attendance:view_all',
      'attendance:edit',
      'attendance:approve',
      'attendance:manage_geofences',

      'leave:request',
      'leave:cancel_own',
      'leave:view_own',
      'leave:view_team',
      'leave:view_all',
      'leave:approve',
      'leave:adjust_balance',
      'leave:manage_types',

      'payroll:view_own',
      'payroll:view_all',
      'payroll:process',
      'payroll:approve',
      'payroll:finalize',
      'payroll:adjust',
      'payroll:settle',

      'employee:view_own',
      'employee:view_team',
      'employee:view_all',
      'employee:create',
      'employee:update',
      'employee:terminate',
      'employee:manage_salary',

      'rbac:view_roles',
      'rbac:manage_roles',
      'rbac:assign_roles',

      'config:view',
      'config:manage',

      'department:view',
      'department:manage',

      'notification:view_own',
      'notification:manage_preferences',

      'audit:view',
      'audit:export',

      'tenant:view_settings',
      'tenant:manage_settings',

      'reports:attendance',
      'reports:payroll',
      'reports:leave',
    ],
  },

  {
    slug: 'hr_manager',
    name: 'HR Manager',
    description:
      'Manages employees, attendance, leave, and has read access to payroll. Cannot finalize payroll.',
    permissions: [
      'attendance:checkin',
      'attendance:checkout',
      'attendance:view_own',
      'attendance:view_team',
      'attendance:view_all',
      'attendance:edit',
      'attendance:approve',
      'attendance:manage_geofences',

      'leave:request',
      'leave:cancel_own',
      'leave:view_own',
      'leave:view_team',
      'leave:view_all',
      'leave:approve',
      'leave:adjust_balance',
      'leave:manage_types',

      'payroll:view_own',
      'payroll:view_all',

      'employee:view_own',
      'employee:view_team',
      'employee:view_all',
      'employee:create',
      'employee:update',
      'employee:terminate',
      'employee:manage_salary',

      'rbac:view_roles',

      'config:view',
      'config:manage',

      'department:view',
      'department:manage',

      'notification:view_own',
      'notification:manage_preferences',

      'audit:view',

      'reports:attendance',
      'reports:leave',
    ],
  },

  {
    slug: 'payroll_officer',
    name: 'Payroll Officer',
    description:
      'Full payroll processing capabilities. Can view employee salary data and process payroll runs.',
    permissions: [
      'attendance:checkin',
      'attendance:checkout',
      'attendance:view_own',
      'attendance:view_all',

      'leave:request',
      'leave:cancel_own',
      'leave:view_own',
      'leave:view_all',

      'payroll:view_own',
      'payroll:view_all',
      'payroll:process',
      'payroll:approve',
      'payroll:finalize',
      'payroll:adjust',
      'payroll:settle',

      'employee:view_own',
      'employee:view_all',
      'employee:manage_salary',

      'notification:view_own',
      'notification:manage_preferences',

      'reports:payroll',
      'reports:attendance',
    ],
  },

  {
    slug: 'department_lead',
    name: 'Department Lead',
    description:
      'Can view and approve team attendance and leave. Cannot access payroll or manage employees.',
    permissions: [
      'attendance:checkin',
      'attendance:checkout',
      'attendance:view_own',
      'attendance:view_team',

      'leave:request',
      'leave:cancel_own',
      'leave:view_own',
      'leave:view_team',
      'leave:approve',

      'payroll:view_own',

      'employee:view_own',
      'employee:view_team',

      'department:view',

      'notification:view_own',
      'notification:manage_preferences',
    ],
  },

  {
    slug: 'employee',
    name: 'Employee',
    description:
      'Basic self-service access. Can check in/out, request leave, and view own records.',
    permissions: [
      'attendance:checkin',
      'attendance:checkout',
      'attendance:view_own',

      'leave:request',
      'leave:cancel_own',
      'leave:view_own',

      'payroll:view_own',

      'employee:view_own',

      'notification:view_own',
      'notification:manage_preferences',
    ],
  },
];

/**
 * Get a system role definition by slug.
 */
export function getSystemRoleBySlug(slug: string): SystemRoleDefinition | undefined {
  return SYSTEM_ROLES.find((r) => r.slug === slug);
}