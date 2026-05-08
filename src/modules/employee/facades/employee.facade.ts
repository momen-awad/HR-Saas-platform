// src/modules/employee/facades/employee.facade.ts

import { Injectable, Logger } from '@nestjs/common';
import { EmployeeRepository } from '../repositories/employee.repository';
import { DeviceRepository } from '../repositories/device.repository';
import { EncryptionService } from '../../../common/utils/encryption.util';
import {
  EmployeeSummary,
  PayrollEmployeeData,
  EmployeeAuthContext,
} from '../interfaces/employee.interfaces';
import { PAYROLL_ELIGIBLE_STATUSES } from '../constants/employee-status.constants';

/**
 * EmployeeFacade — the ONLY interface other modules should use for
 * employee and device data.
 *
 * Never import EmployeeRepository, DeviceRepository, EmployeeService,
 * or DeviceService from outside the employee module.
 *
 * Consumers:
 *   - AuthService          → resolveEmployeeContext (login flow)
 *   - DepartmentController → countActiveInDepartment (before deactivation)
 *   - PayrollService       → getPayrollEligibleEmployees
 *   - AttendanceService    → getEmployeeSummary, validateDevice, touchDeviceLastUsed
 *   - LeaveService         → getEmployeeSummary, isEmployeeActive
 */
@Injectable()
export class EmployeeFacade {
  private readonly logger = new Logger(EmployeeFacade.name);

  constructor(
    private readonly employeeRepo: EmployeeRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly encryption: EncryptionService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // EMPLOYEE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolve the employee context for a user logging into a specific tenant.
   * Used in AuthService to build the JWT payload.
   */
  async resolveEmployeeContext(
    userId: string,
    tenantId: string,
  ): Promise<EmployeeAuthContext | null> {
    const employee = await this.employeeRepo.findByUserId(userId, tenantId);
    if (!employee) return null;

    return {
      employeeId: employee.id,
      timezone: employee.timezone ?? null,
      status: employee.status,
    };
  }

  /**
   * Get a minimal employee summary for cross-module use.
   * No salary, no sensitive fields.
   */
  async getEmployeeSummary(
    employeeId: string,
    tenantId: string,
  ): Promise<EmployeeSummary | null> {
    const employee = await this.employeeRepo.findById(employeeId, tenantId);
    if (!employee) return null;

    return {
      id: employee.id,
      userId: employee.userId,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      fullName: `${employee.firstName} ${employee.lastName}`,
      departmentId: employee.departmentId ?? null,
      status: employee.status,
      timezone: employee.timezone ?? null,
      salaryCurrency: employee.salaryCurrency,
    };
  }

  /**
   * Check that an employee exists, is not terminated, and is not suspended.
   * Used for validation in other modules (leave requests, attendance, etc.).
   */
  async isEmployeeActive(
    employeeId: string,
    tenantId: string,
  ): Promise<boolean> {
    const employee = await this.employeeRepo.findById(employeeId, tenantId);
    if (!employee) return false;
    return (
      employee.status !== 'terminated' && employee.status !== 'suspended'
    );
  }

  /**
   * Count non-terminated employees in a department.
   * Used by DepartmentController before deactivating a department.
   */
  async countActiveInDepartment(
    departmentId: string,
    tenantId: string,
  ): Promise<number> {
    return this.employeeRepo.countActiveByDepartment(departmentId, tenantId);
  }

  /**
   * Fetch all payroll-eligible employees for a tenant with their decrypted salary.
   * Used by the Payroll module during payroll run calculation.
   */
  async getPayrollEligibleEmployees(
    tenantId: string,
  ): Promise<PayrollEmployeeData[]> {
    const empList = await this.employeeRepo.findPayrollEligible(
      tenantId,
      PAYROLL_ELIGIBLE_STATUSES,
    );

    return empList.map((emp) => ({
      employeeId: emp.id,
      employeeNumber: emp.employeeNumber,
      firstName: emp.firstName,
      lastName: emp.lastName,
      departmentId: emp.departmentId ?? null,
      employmentType: emp.employmentType,
      baseSalary: this.encryption.decrypt(emp.baseSalaryEncrypted) ?? '0.00',
      salaryCurrency: emp.salaryCurrency,
      hireDate: emp.hireDate,
      timezone: emp.timezone ?? null,
      status: emp.status,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DEVICE (used by Attendance module)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validate that a device fingerprint is registered and active for
   * the given employee in this tenant.
   *
   * Called during GPS check-in to prevent buddy-punching — an employee
   * may only check in from a device they have personally registered.
   */
  async validateDevice(
    deviceId: string,
    employeeId: string,
    tenantId: string,
  ): Promise<boolean> {
    const device = await this.deviceRepo.findByDeviceIdAndEmployee(
      deviceId,
      employeeId,
      tenantId,
    );
    return !!device && device.isActive;
  }

  /**
   * Record that a device was used during a check-in.
   * Updates the lastUsedAt timestamp for activity tracking.
   *
   * Called by AttendanceService after a successful check-in.
   * Fire-and-forget — failure here must not abort the check-in.
   */
  async touchDeviceLastUsed(
    deviceId: string,
    tenantId: string,
  ): Promise<void> {
    try {
      await this.deviceRepo.touchLastUsed(deviceId, tenantId);
    } catch (error) {
      this.logger.warn(
        `Failed to update device lastUsedAt for [${deviceId}]: ${(error as Error).message}`,
      );
    }
  }
}
