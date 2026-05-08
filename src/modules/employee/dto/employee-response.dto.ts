// src/modules/employee/dto/employee-response.dto.ts

import { Employee } from '../../../database/schema/employees';
import { SalaryHistory } from '../../../database/schema/salary-history';

/**
 * Standard employee API response.
 *
 * SECURITY NOTE: Salary is intentionally excluded from this DTO.
 * Salary data is returned ONLY through the dedicated
 * GET /employees/:id/salary endpoint which requires the
 * 'employee:manage_salary' permission.
 *
 * Bank account and tax ID are never returned in any response —
 * they are write-only fields.
 */
export class EmployeeResponseDto {
  id: string;
  tenantId: string;
  userId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  departmentId: string | null;
  position: string | null;
  employmentType: string;
  salaryCurrency: string;
  hireDate: string;
  terminationDate: string | null;
  timezone: string | null;
  locale: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;

  static fromEntity(employee: Employee): EmployeeResponseDto {
    const dto = new EmployeeResponseDto();
    dto.id = employee.id;
    dto.tenantId = employee.tenantId;
    dto.userId = employee.userId;
    dto.employeeNumber = employee.employeeNumber;
    dto.firstName = employee.firstName;
    dto.lastName = employee.lastName;
    dto.fullName = `${employee.firstName} ${employee.lastName}`;
    dto.departmentId = employee.departmentId ?? null;
    dto.position = employee.position ?? null;
    dto.employmentType = employee.employmentType;
    dto.salaryCurrency = employee.salaryCurrency;
    dto.hireDate = employee.hireDate;
    dto.terminationDate = employee.terminationDate ?? null;
    dto.timezone = employee.timezone ?? null;
    dto.locale = employee.locale ?? null;
    dto.status = employee.status;
    dto.createdAt = employee.createdAt.toISOString();
    dto.updatedAt = employee.updatedAt.toISOString();
    return dto;
  }
}

/**
 * Salary response — returned only to users with 'employee:manage_salary'.
 * The decrypted salary value is included here.
 */
export class SalaryResponseDto {
  employeeId: string;
  baseSalary: string;   // Decrypted decimal string e.g. "5000.00"
  salaryCurrency: string;
  effectiveDate: string;

  static fromDecrypted(
    employeeId: string,
    baseSalary: string,
    salaryCurrency: string,
    effectiveDate: string,
  ): SalaryResponseDto {
    const dto = new SalaryResponseDto();
    dto.employeeId = employeeId;
    dto.baseSalary = baseSalary;
    dto.salaryCurrency = salaryCurrency;
    dto.effectiveDate = effectiveDate;
    return dto;
  }
}

/**
 * Salary history entry response.
 * Used in GET /employees/:id/salary/history.
 */
export class SalaryHistoryResponseDto {
  id: string;
  employeeId: string;
  baseSalary: string;    // Decrypted
  salaryCurrency: string;
  effectiveDate: string;
  changeReason: string;
  notes: string | null;
  changedBy: string;
  createdAt: string;

  static fromEntity(
    record: SalaryHistory,
    decryptedSalary: string,
  ): SalaryHistoryResponseDto {
    const dto = new SalaryHistoryResponseDto();
    dto.id = record.id;
    dto.employeeId = record.employeeId;
    dto.baseSalary = decryptedSalary;
    dto.salaryCurrency = record.salaryCurrency;
    dto.effectiveDate = record.effectiveDate;
    dto.changeReason = record.changeReason;
    dto.notes = record.notes ?? null;
    dto.changedBy = record.changedBy;
    dto.createdAt = record.createdAt;
    return dto;
  }
}
