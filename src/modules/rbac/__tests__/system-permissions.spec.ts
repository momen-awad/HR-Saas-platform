// src/modules/rbac/__tests__/system-permissions.spec.ts

import {
  SYSTEM_PERMISSIONS,
  getAllPermissionCodes,
  getPermissionsByModule,
} from '../constants/system-permissions';

describe('System Permissions', () => {
  it('should have no duplicate permission codes', () => {
    const codes = SYSTEM_PERMISSIONS.map((p) => p.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('should follow module:action naming convention', () => {
    for (const perm of SYSTEM_PERMISSIONS) {
      expect(perm.code).toMatch(/^[a-z_]+:[a-z_]+$/);
    }
  });

  it('should have module field matching code prefix', () => {
    for (const perm of SYSTEM_PERMISSIONS) {
      const codeModule = perm.code.split(':')[0];
      expect(perm.module).toBe(codeModule);
    }
  });

  it('should return permissions by module', () => {
    const attendancePerms = getPermissionsByModule('attendance');
    expect(attendancePerms.length).toBeGreaterThan(0);
    expect(attendancePerms.every((p) => p.startsWith('attendance:'))).toBe(
      true,
    );
  });

  it('should return all permission codes', () => {
    const all = getAllPermissionCodes();
    expect(all.length).toBe(SYSTEM_PERMISSIONS.length);
  });
});