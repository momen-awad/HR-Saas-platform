// src/modules/employee/interfaces/employee.interfaces.ts

/**
 * Minimal employee summary used by other modules via EmployeeFacade.
 * Deliberately lean — no salary, no sensitive fields.
 */
export interface EmployeeSummary {
  id: string;
  userId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  departmentId: string | null;
  status: string;
  timezone: string | null;
  salaryCurrency: string;
}

/**
 * Payroll-specific employee data fetched in bulk during payroll calculation.
 * Includes the decrypted salary value.
 */
export interface PayrollEmployeeData {
  employeeId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  departmentId: string | null;
  employmentType: string;
  baseSalary: string;        // Decrypted decimal string
  salaryCurrency: string;
  hireDate: string;
  timezone: string | null;
  status: string;
}

/**
 * Result of resolving an employee from a userId + tenantId pair.
 * Used during the login flow in AuthService.
 */
export interface EmployeeAuthContext {
  employeeId: string;
  timezone: string | null;
  status: string;
}
