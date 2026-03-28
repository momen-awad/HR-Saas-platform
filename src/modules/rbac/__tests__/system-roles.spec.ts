// src/modules/rbac/__tests__/system-roles.spec.ts

import { SYSTEM_ROLES } from '../constants/system-roles';
import { getAllPermissionCodes } from '../constants/system-permissions';

describe('System Roles', () => {
  const allPerms = getAllPermissionCodes();

  it('should have unique slugs', () => {
    const slugs = SYSTEM_ROLES.map((r) => r.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('should only reference valid permission codes', () => {
    const allPermSet = new Set(allPerms);

    for (const role of SYSTEM_ROLES) {
      for (const perm of role.permissions) {
        expect(allPermSet.has(perm)).toBe(true);
      }
    }
  });

  it('tenant_admin should have ALL permissions', () => {
    const admin = SYSTEM_ROLES.find((r) => r.slug === 'tenant_admin')!;
    expect(admin.permissions.length).toBe(allPerms.length);
  });

  it('employee should have the fewest permissions', () => {
    const employee = SYSTEM_ROLES.find((r) => r.slug === 'employee')!;
    const minCount = Math.min(
      ...SYSTEM_ROLES.map((r) => r.permissions.length),
    );
    expect(employee.permissions.length).toBe(minCount);
  });

  it('employee should only have self-service permissions', () => {
    const employee = SYSTEM_ROLES.find((r) => r.slug === 'employee')!;
    // استثناء notification:manage_preferences لأنها صلاحية شخصية وليست إدارية
    const hasAdmin = employee.permissions.some(
      (p) =>
        (p.includes(':manage') && p !== 'notification:manage_preferences') ||
        p.includes(':create') ||
        p.includes(':terminate') ||
        p.includes(':approve') ||
        p.includes(':process') ||
        p.includes(':finalize'),
    );
    expect(hasAdmin).toBe(false);
  });

  it('department_lead should have team viewing but not all viewing', () => {
    const lead = SYSTEM_ROLES.find((r) => r.slug === 'department_lead')!;
    expect(lead.permissions).toContain('attendance:view_team');
    expect(lead.permissions).not.toContain('attendance:view_all');
    expect(lead.permissions).toContain('leave:view_team');
    expect(lead.permissions).not.toContain('leave:view_all');
  });

  it('payroll_officer should have payroll process+finalize but hr_manager should not', () => {
    const payroll = SYSTEM_ROLES.find((r) => r.slug === 'payroll_officer')!;
    const hr = SYSTEM_ROLES.find((r) => r.slug === 'hr_manager')!;

    expect(payroll.permissions).toContain('payroll:process');
    expect(payroll.permissions).toContain('payroll:finalize');
    expect(hr.permissions).not.toContain('payroll:process');
    expect(hr.permissions).not.toContain('payroll:finalize');
  });
});
