// src/common/exceptions/__tests__/business-exceptions.spec.ts

import { HttpStatus } from '@nestjs/common';
import {
  ResourceNotFoundException,
  InsufficientLeaveBalanceException,
  PayrollAlreadyFinalizedException,
  AlreadyCheckedInException,
  InvalidCredentialsException,
  TenantPlanLimitException,
} from '../business-exceptions';
import { ErrorCodes } from '../error-codes';

describe('Business Exceptions', () => {
  it('ResourceNotFoundException should have 404 status', () => {
    const ex = new ResourceNotFoundException('Employee', 'emp-123');
    expect(ex.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(ex.errorCode).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
    expect(ex.details).toEqual({ resource: 'Employee', identifier: 'emp-123' });
  });

  it('InsufficientLeaveBalanceException should have details', () => {
    const ex = new InsufficientLeaveBalanceException(5, 3, 'annual');
    expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(ex.errorCode).toBe(ErrorCodes.LEAVE_INSUFFICIENT_BALANCE);
    expect(ex.details).toEqual({
      requestedDays: 5,
      availableBalance: 3,
      leaveType: 'annual',
    });
  });

  it('PayrollAlreadyFinalizedException should be 400', () => {
    const ex = new PayrollAlreadyFinalizedException('run-456');
    expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(ex.errorCode).toBe(ErrorCodes.PAYROLL_RUN_ALREADY_FINALIZED);
  });

  it('AlreadyCheckedInException should be 409 Conflict', () => {
    const ex = new AlreadyCheckedInException('emp-1', '2025-01-15T08:00:00Z');
    expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(ex.errorCode).toBe(ErrorCodes.ATTENDANCE_ALREADY_CHECKED_IN);
  });

  it('InvalidCredentialsException should be 401', () => {
    const ex = new InvalidCredentialsException();
    expect(ex.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(ex.errorCode).toBe(ErrorCodes.AUTH_INVALID_CREDENTIALS);
    // Should NOT leak any details about which field was wrong
    expect(ex.details).toBeUndefined();
  });

  it('TenantPlanLimitException should include current and max', () => {
    const ex = new TenantPlanLimitException('employees', 100, 100);
    expect(ex.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(ex.details).toEqual({ limit: 'employees', current: 100, max: 100 });
  });

  it('exceptions should serialize correctly in response', () => {
    const ex = new InsufficientLeaveBalanceException(5, 3, 'annual');
    const response = ex.getResponse() as any;
    expect(response.code).toBe(ErrorCodes.LEAVE_INSUFFICIENT_BALANCE);
    expect(response.message).toContain('Insufficient');
    expect(response.details).toBeDefined();
  });
});
