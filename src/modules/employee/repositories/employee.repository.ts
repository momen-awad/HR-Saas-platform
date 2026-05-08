// src/modules/employee/repositories/employee.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { and, eq, ne, or, ilike, inArray, count, SQL } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../../database/database.providers';
import {
  employees,
  Employee,
  NewEmployee,
} from '../../../database/schema/employees';
import { PaginationHelper } from '../../../common/utils/pagination.util';
import { EmployeeQueryDto } from '../dto/employee-query.dto';

@Injectable()
export class EmployeeRepository {
  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  async create(data: NewEmployee): Promise<Employee> {
    const [created] = await this.db
      .insert(employees)
      .values(data)
      .returning();
    return created;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────

  async findById(id: string, tenantId: string): Promise<Employee | null> {
    const [emp] = await this.db
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)))
      .limit(1);
    return emp ?? null;
  }

  /**
   * Resolve an employee by their userId within a specific tenant.
   * Used during the login flow to establish the employee context.
   */
  async findByUserId(
    userId: string,
    tenantId: string,
  ): Promise<Employee | null> {
    const [emp] = await this.db
      .select()
      .from(employees)
      .where(
        and(eq(employees.userId, userId), eq(employees.tenantId, tenantId)),
      )
      .limit(1);
    return emp ?? null;
  }

  /**
   * Find an employee by their employee number within a tenant.
   *
   * @param excludeId - Exclude this ID from the check (used during updates).
   */
  async findByEmployeeNumber(
    employeeNumber: string,
    tenantId: string,
    excludeId?: string,
  ): Promise<Employee | null> {
    const conditions: SQL[] = [
      eq(employees.tenantId, tenantId),
      ilike(employees.employeeNumber, employeeNumber),
    ];

    if (excludeId) {
      conditions.push(ne(employees.id, excludeId));
    }

    const [emp] = await this.db
      .select()
      .from(employees)
      .where(and(...conditions))
      .limit(1);
    return emp ?? null;
  }

  async findMany(
    tenantId: string,
    query: EmployeeQueryDto,
  ): Promise<{ data: Employee[]; total: number }> {
    const { perPage, offset } = PaginationHelper.parse(query);

    const conditions: SQL[] = [eq(employees.tenantId, tenantId)];

    if (query.status) {
      conditions.push(eq(employees.status, query.status));
    }

    if (query.departmentId) {
      conditions.push(eq(employees.departmentId, query.departmentId));
    }

    if (query.employmentType) {
      conditions.push(eq(employees.employmentType, query.employmentType));
    }

    if (query.search) {
      const sanitized = query.search
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      conditions.push(
        or(
          ilike(employees.firstName, `%${sanitized}%`),
          ilike(employees.lastName, `%${sanitized}%`),
          ilike(employees.employeeNumber, `%${sanitized}%`),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [countResult, data] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(employees)
        .where(whereClause),
      this.db
        .select()
        .from(employees)
        .where(whereClause)
        .orderBy(employees.lastName, employees.firstName)
        .limit(perPage)
        .offset(offset),
    ]);

    return {
      data,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  /**
   * Count non-terminated employees in a department.
   * Used before deactivating a department.
   */
  async countActiveByDepartment(
    departmentId: string,
    tenantId: string,
  ): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, tenantId),
          eq(employees.departmentId, departmentId),
          ne(employees.status, 'terminated'),
        ),
      );
    return Number(result?.count ?? 0);
  }

  /**
   * Fetch employees whose status qualifies them for payroll processing.
   */
  async findPayrollEligible(
    tenantId: string,
    eligibleStatuses: string[],
  ): Promise<Employee[]> {
    return this.db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, tenantId),
          inArray(employees.status, eligibleStatuses),
        ),
      )
      .orderBy(employees.employeeNumber);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  async update(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewEmployee, 'id' | 'tenantId'>>,
  ): Promise<Employee | null> {
    const [updated] = await this.db
      .update(employees)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId)))
      .returning();
    return updated ?? null;
  }

  /**
   * Bulk-reassign employees from one department to another.
   * Pass null as targetDepartmentId to unassign entirely.
   */
  async reassignDepartment(
    fromDepartmentId: string,
    targetDepartmentId: string | null,
    tenantId: string,
  ): Promise<number> {
    const result = await this.db
      .update(employees)
      .set({ departmentId: targetDepartmentId, updatedAt: new Date() })
      .where(
        and(
          eq(employees.tenantId, tenantId),
          eq(employees.departmentId, fromDepartmentId),
        ),
      )
      .returning({ id: employees.id });
    return result.length;
  }
}
