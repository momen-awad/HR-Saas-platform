// src/modules/department/repositories/department.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { and, eq, ne, isNull, ilike, count, SQL } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../../database/database.providers';
import {
  departments,
  Department,
  NewDepartment,
} from '../../../database/schema/departments';
import { PaginationHelper } from '../../../common/utils/pagination.util';
import { DepartmentQueryDto } from '../dto/department-query.dto';

@Injectable()
export class DepartmentRepository {
  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  async create(data: NewDepartment): Promise<Department> {
    const [created] = await this.db
      .insert(departments)
      .values(data)
      .returning();
    return created;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────

  async findById(id: string, tenantId: string): Promise<Department | null> {
    const [dept] = await this.db
      .select()
      .from(departments)
      .where(
        and(
          eq(departments.id, id),
          eq(departments.tenantId, tenantId),
        ),
      )
      .limit(1);
    return dept ?? null;
  }

  /**
   * Find a department by name within a tenant (case-insensitive).
   *
   * @param excludeId - When provided, the department with this ID is excluded
   *                    from the uniqueness check. Used during updates so that
   *                    keeping the same name does not trigger a conflict.
   */
  async findByName(
    name: string,
    tenantId: string,
    excludeId?: string,
  ): Promise<Department | null> {
    const conditions: SQL[] = [
      eq(departments.tenantId, tenantId),
      ilike(departments.name, name),
    ];

    if (excludeId) {
      conditions.push(ne(departments.id, excludeId));
    }

    const [dept] = await this.db
      .select()
      .from(departments)
      .where(and(...conditions))
      .limit(1);

    return dept ?? null;
  }

  async findMany(
    tenantId: string,
    query: DepartmentQueryDto,
  ): Promise<{ data: Department[]; total: number }> {
    const { perPage, offset } = PaginationHelper.parse(query);

    const conditions: SQL[] = [eq(departments.tenantId, tenantId)];

    if (typeof query.isActive === 'boolean') {
      conditions.push(eq(departments.isActive, query.isActive));
    }

    if (query.rootOnly === true) {
      conditions.push(isNull(departments.parentId));
    }

    if (query.search) {
      // Sanitize LIKE special characters to prevent pattern injection
      const sanitized = query.search
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      conditions.push(ilike(departments.name, `%${sanitized}%`));
    }

    const whereClause = and(...conditions);

    const [countResult, data] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(departments)
        .where(whereClause),
      this.db
        .select()
        .from(departments)
        .where(whereClause)
        .orderBy(departments.name)
        .limit(perPage)
        .offset(offset),
    ]);

    return {
      data,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  /**
   * Fetch all departments for a tenant in a single query.
   * Used for building the hierarchy tree in-memory to avoid N+1 queries.
   */
  async findAllForTenant(tenantId: string): Promise<Department[]> {
    return this.db
      .select()
      .from(departments)
      .where(eq(departments.tenantId, tenantId))
      .orderBy(departments.name);
  }

  /**
   * Fetch immediate children of a given department.
   */
  async findChildren(
    parentId: string,
    tenantId: string,
  ): Promise<Department[]> {
    return this.db
      .select()
      .from(departments)
      .where(
        and(
          eq(departments.tenantId, tenantId),
          eq(departments.parentId, parentId),
        ),
      )
      .orderBy(departments.name);
  }

  /**
   * Count active direct children of a department.
   * Used before deactivation to enforce the guard rule.
   */
  async countActiveChildren(
    parentId: string,
    tenantId: string,
  ): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(departments)
      .where(
        and(
          eq(departments.tenantId, tenantId),
          eq(departments.parentId, parentId),
          eq(departments.isActive, true),
        ),
      );
    return Number(result?.count ?? 0);
  }

  /**
   * Find all department IDs in the subtree rooted at `rootId` (inclusive).
   *
   * Loads all tenant departments in a single query then traverses the
   * hierarchy in-memory via BFS. This avoids recursive SQL while
   * remaining efficient for typical organisation sizes (< 10 k departments).
   *
   * Returns the rootId itself plus every descendant ID.
   */
  async findSubtreeIds(rootId: string, tenantId: string): Promise<string[]> {
    const all = await this.findAllForTenant(tenantId);

    // Build parent → [child, ...] map
    const childrenMap = new Map<string, string[]>();
    for (const dept of all) {
      if (dept.parentId) {
        const siblings = childrenMap.get(dept.parentId) ?? [];
        siblings.push(dept.id);
        childrenMap.set(dept.parentId, siblings);
      }
    }

    // BFS traversal starting from rootId
    const result: string[] = [];
    const queue: string[] = [rootId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      const children = childrenMap.get(current) ?? [];
      queue.push(...children);
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  async update(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewDepartment, 'id' | 'tenantId'>>,
  ): Promise<Department | null> {
    const [updated] = await this.db
      .update(departments)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(departments.id, id),
          eq(departments.tenantId, tenantId),
        ),
      )
      .returning();
    return updated ?? null;
  }

  /**
   * Remove manager assignment from every department in this tenant where the
   * given employee is listed as manager.
   *
   * Called by the Employee module (via DepartmentFacade) when an employee is
   * terminated or suspended so no department retains a stale manager reference.
   */
  async clearManager(
    managerEmployeeId: string,
    tenantId: string,
  ): Promise<void> {
    await this.db
      .update(departments)
      .set({ managerEmployeeId: null, updatedAt: new Date() })
      .where(
        and(
          eq(departments.tenantId, tenantId),
          eq(departments.managerEmployeeId, managerEmployeeId),
        ),
      );
  }
}
