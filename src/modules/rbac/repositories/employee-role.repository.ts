// src/modules/rbac/repositories/employee-role.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../../database/database.providers';
import {
  employeeRoles,
  EmployeeRole,
  NewEmployeeRole,
} from '../../../database/schema/employee-roles';
import { roles } from '../../../database/schema/roles';
import { rolePermissions } from '../../../database/schema/role-permissions';
import { permissions } from '../../../database/schema/permissions';
import { RoleSummary } from '../interfaces/rbac.interfaces';

@Injectable()
export class EmployeeRoleRepository {
  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  async findRolesForEmployee(
    employeeId: string,
    tenantId: string,
  ): Promise<RoleSummary[]> {
    const results = await this.db
      .select({
        id: roles.id,
        name: roles.name,
        slug: roles.slug,
        isSystem: roles.isSystem,
      })
      .from(employeeRoles)
      .innerJoin(roles, eq(employeeRoles.roleId, roles.id))
      .where(
        and(
          eq(employeeRoles.employeeId, employeeId),
          eq(employeeRoles.tenantId, tenantId),
          eq(roles.isActive, true),
        ),
      );
    return results;
  }

  async findPermissionCodesForEmployee(
    employeeId: string,
    tenantId: string,
  ): Promise<string[]> {
    const results = await this.db
      .selectDistinct({ code: permissions.code })
      .from(employeeRoles)
      .innerJoin(roles, eq(employeeRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(
        permissions,
        eq(rolePermissions.permissionId, permissions.id),
      )
      .where(
        and(
          eq(employeeRoles.employeeId, employeeId),
          eq(employeeRoles.tenantId, tenantId),
          eq(roles.isActive, true),
        ),
      );

    return results.map((r) => r.code);
  }

  async assignRoles(
    employeeId: string,
    tenantId: string,
    roleIds: string[],
    assignedBy: string,
  ): Promise<void> {
    if (roleIds.length === 0) return;

    const records: NewEmployeeRole[] = roleIds.map((roleId) => ({
      tenantId,
      employeeId,
      roleId,
      assignedBy,
    }));

    // Use ON CONFLICT DO NOTHING to handle duplicate assignments
    for (const record of records) {
      try {
        await this.db.insert(employeeRoles).values(record);
      } catch (error: any) {
        // Ignore unique constraint violations (already assigned)
        if (error.code !== '23505') throw error;
      }
    }
  }

  async revokeRoles(
    employeeId: string,
    tenantId: string,
    roleIds: string[],
  ): Promise<void> {
    if (roleIds.length === 0) return;

    await this.db
      .delete(employeeRoles)
      .where(
        and(
          eq(employeeRoles.employeeId, employeeId),
          eq(employeeRoles.tenantId, tenantId),
          inArray(employeeRoles.roleId, roleIds),
        ),
      );
  }

  async revokeAllRoles(
    employeeId: string,
    tenantId: string,
  ): Promise<void> {
    await this.db
      .delete(employeeRoles)
      .where(
        and(
          eq(employeeRoles.employeeId, employeeId),
          eq(employeeRoles.tenantId, tenantId),
        ),
      );
  }

  async hasRole(
    employeeId: string,
    tenantId: string,
    roleSlug: string,
  ): Promise<boolean> {
    const result = await this.db
      .select({ id: roles.id })
      .from(employeeRoles)
      .innerJoin(roles, eq(employeeRoles.roleId, roles.id))
      .where(
        and(
          eq(employeeRoles.employeeId, employeeId),
          eq(employeeRoles.tenantId, tenantId),
          eq(roles.slug, roleSlug),
        ),
      )
      .limit(1);
    return result.length > 0;
  }
}
