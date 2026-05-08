// src/common/exceptions/business-exceptions.ts

import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base-business.exception';
import { ErrorCodes } from './error-codes';

/**
 * Domain-specific exception classes.
 * Each class corresponds to a specific business rule violation.
 *
 * Usage in services:
 *   throw new ResourceNotFoundException('Employee', employeeId);
 *   throw new DeviceAlreadyRegisteredException(deviceId);
 */

// ── General ──

export class ResourceNotFoundException extends BusinessException {
  constructor(resource: string, identifier: string) {
    super(
      ErrorCodes.RESOURCE_NOT_FOUND,
      `${resource} not found with identifier: ${identifier}`,
      HttpStatus.NOT_FOUND,
      { resource, identifier },
    );
  }
}

export class ResourceAlreadyExistsException extends BusinessException {
  constructor(resource: string, field: string, value: string) {
    super(
      ErrorCodes.RESOURCE_ALREADY_EXISTS,
      `${resource} already exists with ${field}: ${value}`,
      HttpStatus.CONFLICT,
      { resource, field, value },
    );
  }
}

export class OperationNotPermittedException extends BusinessException {
  constructor(operation: string, reason: string) {
    super(
      ErrorCodes.OPERATION_NOT_PERMITTED,
      `Operation '${operation}' is not permitted: ${reason}`,
      HttpStatus.FORBIDDEN,
      { operation, reason },
    );
  }
}

// ── Tenant ──

export class TenantPlanLimitException extends BusinessException {
  constructor(limit: string, current: number, max: number) {
    super(
      ErrorCodes.TENANT_PLAN_LIMIT_REACHED,
      `Plan limit reached for ${limit}. Current: ${current}, Maximum: ${max}`,
      HttpStatus.FORBIDDEN,
      { limit, current, max },
    );
  }
}

// ── Auth ──

export class InvalidCredentialsException extends BusinessException {
  constructor() {
    super(
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
      'Invalid email or password',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AccountLockedException extends BusinessException {
  constructor(lockedUntil: Date) {
    super(
      ErrorCodes.AUTH_ACCOUNT_LOCKED,
      'Account is temporarily locked due to too many failed login attempts',
      HttpStatus.FORBIDDEN,
      { lockedUntil: lockedUntil.toISOString() },
    );
  }
}

export class InsufficientPermissionsException extends BusinessException {
  constructor(requiredPermissions: string[]) {
    super(
      ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS,
      'You do not have the required permissions for this operation',
      HttpStatus.FORBIDDEN,
      { requiredPermissions },
    );
  }
}

// ── Employee ──

export class EmployeeNotActiveException extends BusinessException {
  constructor(employeeId: string, currentStatus: string) {
    super(
      ErrorCodes.EMPLOYEE_NOT_ACTIVE,
      `Employee is not active. Current status: ${currentStatus}`,
      HttpStatus.BAD_REQUEST,
      { employeeId, currentStatus },
    );
  }
}

export class EmployeeAlreadyTerminatedException extends BusinessException {
  constructor(employeeId: string) {
    super(
      ErrorCodes.EMPLOYEE_ALREADY_TERMINATED,
      'Employee is already terminated.',
      HttpStatus.CONFLICT,
      { employeeId },
    );
  }
}

export class EmployeeInvalidStatusTransitionException extends BusinessException {
  constructor(
    employeeId: string,
    currentStatus: string,
    targetStatus: string,
  ) {
    super(
      ErrorCodes.EMPLOYEE_INVALID_STATUS_TRANSITION,
      `Cannot transition employee status from '${currentStatus}' to '${targetStatus}'.`,
      HttpStatus.BAD_REQUEST,
      { employeeId, currentStatus, targetStatus },
    );
  }
}

export class EmployeeNumberTakenException extends BusinessException {
  constructor(employeeNumber: string) {
    super(
      ErrorCodes.EMPLOYEE_NUMBER_TAKEN,
      `Employee number '${employeeNumber}' is already in use within this tenant.`,
      HttpStatus.CONFLICT,
      { employeeNumber },
    );
  }
}

export class EmployeeUserAlreadyEmployedException extends BusinessException {
  constructor(userId: string) {
    super(
      ErrorCodes.EMPLOYEE_USER_ALREADY_EMPLOYED,
      'This user already has an employee profile in this tenant.',
      HttpStatus.CONFLICT,
      { userId },
    );
  }
}

// ── Device ──

export class DeviceAlreadyRegisteredException extends BusinessException {
  constructor(deviceId: string) {
    super(
      ErrorCodes.DEVICE_ALREADY_REGISTERED,
      `Device '${deviceId}' is already registered for this employee.`,
      HttpStatus.CONFLICT,
      { deviceId },
    );
  }
}

export class DeviceLimitReachedException extends BusinessException {
  constructor(current: number, max: number) {
    super(
      ErrorCodes.DEVICE_LIMIT_REACHED,
      `Device limit reached. You have ${current} registered device(s); the maximum is ${max}.`,
      HttpStatus.FORBIDDEN,
      { current, max },
    );
  }
}

export class DeviceBelongsToOtherEmployeeException extends BusinessException {
  constructor(deviceId: string) {
    super(
      ErrorCodes.DEVICE_BELONGS_TO_OTHER_EMPLOYEE,
      `Device '${deviceId}' is already registered to another employee in this tenant.`,
      HttpStatus.CONFLICT,
      { deviceId },
    );
  }
}

// ── Department ──

export class DepartmentCircularReferenceException extends BusinessException {
  constructor(departmentId: string, parentId: string) {
    super(
      ErrorCodes.DEPARTMENT_CIRCULAR_REFERENCE,
      'Cannot set parent department: this would create a circular reference in the hierarchy.',
      HttpStatus.CONFLICT,
      { departmentId, parentId },
    );
  }
}

export class DepartmentHasActiveChildrenException extends BusinessException {
  constructor(departmentId: string, childCount: number) {
    super(
      ErrorCodes.DEPARTMENT_HAS_ACTIVE_CHILDREN,
      `Cannot deactivate department: it has ${childCount} active sub-department(s). Deactivate them first.`,
      HttpStatus.CONFLICT,
      { departmentId, childCount },
    );
  }
}

export class DepartmentHasActiveEmployeesException extends BusinessException {
  constructor(departmentId: string, employeeCount: number) {
    super(
      ErrorCodes.DEPARTMENT_HAS_ACTIVE_EMPLOYEES,
      `Cannot deactivate department: it has ${employeeCount} active employee(s). Reassign them first.`,
      HttpStatus.CONFLICT,
      { departmentId, employeeCount },
    );
  }
}

// ── Attendance ──

export class AlreadyCheckedInException extends BusinessException {
  constructor(employeeId: string, checkInTime: string) {
    super(
      ErrorCodes.ATTENDANCE_ALREADY_CHECKED_IN,
      'You are already checked in. Please check out first.',
      HttpStatus.CONFLICT,
      { employeeId, existingCheckIn: checkInTime },
    );
  }
}

export class NotCheckedInException extends BusinessException {
  constructor(employeeId: string) {
    super(
      ErrorCodes.ATTENDANCE_NOT_CHECKED_IN,
      'You are not currently checked in.',
      HttpStatus.BAD_REQUEST,
      { employeeId },
    );
  }
}

export class OutsideGeofenceException extends BusinessException {
  constructor(distance: number, maxDistance: number) {
    super(
      ErrorCodes.ATTENDANCE_OUTSIDE_GEOFENCE,
      'You are outside the allowed check-in zone.',
      HttpStatus.BAD_REQUEST,
      { distanceMeters: distance, allowedMeters: maxDistance },
    );
  }
}

// ── Leave ──

export class InsufficientLeaveBalanceException extends BusinessException {
  constructor(
    requestedDays: number,
    availableBalance: number,
    leaveType: string,
  ) {
    super(
      ErrorCodes.LEAVE_INSUFFICIENT_BALANCE,
      `Insufficient ${leaveType} leave balance. Requested: ${requestedDays} days, Available: ${availableBalance} days`,
      HttpStatus.BAD_REQUEST,
      { requestedDays, availableBalance, leaveType },
    );
  }
}

export class LeaveOverlapException extends BusinessException {
  constructor(existingLeaveId: string, overlapDates: string[]) {
    super(
      ErrorCodes.LEAVE_OVERLAP_EXISTS,
      'Leave request overlaps with an existing approved leave.',
      HttpStatus.CONFLICT,
      { existingLeaveId, overlapDates },
    );
  }
}

// ── Payroll ──

export class PayrollAlreadyFinalizedException extends BusinessException {
  constructor(runId: string) {
    super(
      ErrorCodes.PAYROLL_RUN_ALREADY_FINALIZED,
      'This payroll run has been finalized and cannot be modified. Use adjustments instead.',
      HttpStatus.BAD_REQUEST,
      { payrollRunId: runId },
    );
  }
}

export class PayrollInvalidStatusTransitionException extends BusinessException {
  constructor(runId: string, currentStatus: string, targetStatus: string) {
    super(
      ErrorCodes.PAYROLL_RUN_INVALID_STATUS,
      `Cannot transition payroll run from '${currentStatus}' to '${targetStatus}'`,
      HttpStatus.BAD_REQUEST,
      { payrollRunId: runId, currentStatus, targetStatus },
    );
  }
}

export class PayrollSnapshotImmutableException extends BusinessException {
  constructor(snapshotId: string) {
    super(
      ErrorCodes.PAYROLL_SNAPSHOT_IMMUTABLE,
      'Payroll snapshots are immutable. Create an adjustment entry instead.',
      HttpStatus.BAD_REQUEST,
      { snapshotId },
    );
  }
}
