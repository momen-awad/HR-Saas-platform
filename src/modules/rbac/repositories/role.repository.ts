// src/modules/rbac/repositories/role.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../../database/database.providers';
import { roles, Role, NewRole } from '../../../database/schema/roles';
import {
  rolePermissions,
  NewRolePermission,
} from '../../../database/schema/role-permissions';
import { permissions } from '../../../database/schema/permissions';
import { TenantContext } from '../../../common/context/tenant.context';
import {
  RoleWithPermissions,
  PermissionSummary,
} from '../interfaces/rbac.interfaces';

@Injectable()
export class RoleRepository {
  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  async findAllByTenant(tenantId: string): Promise<Role[]> {
    return this.db
      .select()
      .from(roles)
      .where(eq(roles.tenantId, tenantId))
      .orderBy(roles.isSystem, roles.name);
  }

  async findById(id: string, tenantId: string): Promise<Role | undefined> {
    const results = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.id, id), eq(roles.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findBySlug(
    slug: string,
    tenantId: string,
  ): Promise<Role | undefined> {
    const results = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.slug, slug), eq(roles.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  async findWithPermissions(
    id: string,
    tenantId: string,
  ): Promise<RoleWithPermissions | null> {
    const role = await this.findById(id, tenantId);
    if (!role) return null;

    const perms = await this.db
      .select({
        id: permissions.id,
        code: permissions.code,
        description: permissions.description,
        module: permissions.module,
        category: permissions.category,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, id));

    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissions: perms,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async create(data: NewRole): Promise<Role> {
    const [created] = await this.db.insert(roles).values(data).returning();
    return created;
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<Omit<NewRole, 'id' | 'tenantId'>>,
  ): Promise<Role | undefined> {
    const [updated] = await this.db
      .update(roles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(roles.id, id), eq(roles.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .delete(roles)
      .where(and(eq(roles.id, id), eq(roles.tenantId, tenantId)))
      .returning({ id: roles.id });
    return result.length > 0;
  }

  async setPermissions(
    roleId: string,
    permissionIds: string[],
  ): Promise<void> {
    // Remove existing permissions
    await this.db
      .delete(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));

    // Insert new permissions
    if (permissionIds.length > 0) {
      const records: NewRolePermission[] = permissionIds.map((pid) => ({
        roleId,
        permissionId: pid,
      }));
      await this.db.insert(rolePermissions).values(records);
    }
  }

  async getPermissionCodesForRole(roleId: string): Promise<string[]> {
    const results = await this.db
      .select({ code: permissions.code })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    return results.map((r) => r.code);
  }
}
