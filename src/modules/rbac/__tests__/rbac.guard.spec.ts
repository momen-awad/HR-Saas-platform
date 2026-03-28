// src/modules/rbac/__tests__/rbac.guard.spec.ts

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard } from '../guards/rbac.guard';
import { InsufficientPermissionsException } from '../../../common/exceptions/business-exceptions';

describe('RbacGuard', () => {
  let guard: RbacGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RbacGuard(reflector);
  });

  function createMockContext(
    userPermissions: string[] | null,
    requiredPermissions: string[] | null,
    mode: 'ALL' | 'ANY' = 'ALL',
    isPublic: boolean = false,
  ): ExecutionContext {
    const mockRequest = {
      user: userPermissions !== null
        ? { sub: 'user-1', permissions: userPermissions }
        : null,
    };

    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation(
      (key: string) => {
        if (key === 'isPublic') return isPublic;
        if (key === 'required_permissions') return requiredPermissions;
        if (key === 'permission_mode') return mode;
        return undefined;
      },
    );

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as any;
  }

  it('should allow public routes', () => {
    const ctx = createMockContext(null, null, 'ALL', true);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow routes with no required permissions', () => {
    const ctx = createMockContext(['some:perm'], null);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow when user has all required permissions', () => {
    const ctx = createMockContext(
      ['payroll:process', 'payroll:approve', 'payroll:view_all'],
      ['payroll:process', 'payroll:approve'],
      'ALL',
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny when user missing a required permission', () => {
    const ctx = createMockContext(
      ['payroll:process'],
      ['payroll:process', 'payroll:approve'],
      'ALL',
    );
    expect(() => guard.canActivate(ctx)).toThrow(
      InsufficientPermissionsException,
    );
  });

  it('should allow with ANY mode when user has one of the permissions', () => {
    const ctx = createMockContext(
      ['attendance:view_team'],
      ['attendance:view_team', 'attendance:view_all'],
      'ANY',
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny with ANY mode when user has none', () => {
    const ctx = createMockContext(
      ['attendance:checkin'],
      ['attendance:view_team', 'attendance:view_all'],
      'ANY',
    );
    expect(() => guard.canActivate(ctx)).toThrow(
      InsufficientPermissionsException,
    );
  });

  it('should deny when no user on request', () => {
    const ctx = createMockContext(null, ['payroll:process']);
    expect(() => guard.canActivate(ctx)).toThrow(
      InsufficientPermissionsException,
    );
  });

  it('should allow empty permission array', () => {
    const ctx = createMockContext(['some:perm'], []);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});