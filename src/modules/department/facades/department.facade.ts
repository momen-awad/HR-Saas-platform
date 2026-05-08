// src/modules/department/facades/department.facade.ts

import { Injectable, Logger } from '@nestjs/common';
import { DepartmentRepository } from '../repositories/department.repository';
import { DepartmentSummary } from '../interfaces/department.interfaces';

/**
 * DepartmentFacade — the public API exposed to other modules.
 *
 * Other modules (Employee, Payroll, Leave) must NEVER import the
 * DepartmentRepository or DepartmentService directly.
 * They use this facade only.
 *
 * This keeps the module boundary clean and makes refactoring safe.
 */
@Injectable()
export class DepartmentFacade {
  private readonly logger = new Logger(DepartmentFacade.name);

  constructor(private readonly departmentRepo: DepartmentRepository) {}

  /**
   * Get a minimal department summary by ID.
   * Returns null if the department does not exist or belongs to a different tenant.
   */
  async getDepartmentSummary(
    departmentId: string,
    tenantId: string,
  ): Promise<DepartmentSummary | null> {
    const dept = await this.departmentRepo.findById(departmentId, tenantId);
    if (!dept) return null;

    return {
      id: dept.id,
      name: dept.name,
      managerEmployeeId: dept.managerEmployeeId ?? null,
      isActive: dept.isActive,
    };
  }

  /**
   * Check if a department exists, is active, and belongs to the given tenant.
   * Used by the Employee module during employee creation.
   */
  async isDepartmentValid(
    departmentId: string,
    tenantId: string,
  ): Promise<boolean> {
    const dept = await this.departmentRepo.findById(departmentId, tenantId);
    return !!dept && dept.isActive;
  }

  /**
   * Remove the manager assignment from all departments where this employee
   * is the manager. Called when an employee is terminated or deactivated.
   */
  async clearEmployeeAsManager(
    employeeId: string,
    tenantId: string,
  ): Promise<void> {
    await this.departmentRepo.clearManager(employeeId, tenantId);
    this.logger.debug(
      `Cleared manager role for employee [${employeeId}] across all departments in tenant ${tenantId}`,
    );
  }

  /**
   * Get all department IDs in the subtree rooted at the given department.
   * Used for cascading queries (e.g., "find all employees in this dept and its sub-depts").
   */
  async getDepartmentSubtreeIds(
    departmentId: string,
    tenantId: string,
  ): Promise<string[]> {
    return this.departmentRepo.findSubtreeIds(departmentId, tenantId);
  }
}
