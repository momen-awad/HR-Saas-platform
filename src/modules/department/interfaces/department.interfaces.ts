// src/modules/department/interfaces/department.interfaces.ts

/**
 * Minimal department summary used by other modules
 * (Employee module, Payroll module etc.) via the DepartmentFacade.
 *
 * We deliberately keep this lean — other modules do not need
 * the full Department entity, only the fields they reference.
 */
export interface DepartmentSummary {
  id: string;
  name: string;
  managerEmployeeId: string | null;
  isActive: boolean;
}

/**
 * Full department with enriched manager information.
 * Returned by GET /departments/:id for the admin UI.
 */
export interface DepartmentWithManager {
  id: string;
  tenantId: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  managerEmployeeId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
