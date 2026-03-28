// src/database/schema/role-permissions.ts

import {
  pgTable,
  uuid,
  primaryKey,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { roles } from './roles';
import { permissions } from './permissions';

/**
 * Role-Permission junction table.
 *
 * Maps which permissions belong to which role.
 * A role can have many permissions, a permission can belong to many roles.
 *
 * Does NOT have its own tenant_id — tenant isolation is enforced
 * by joining through the roles table (which is tenant-scoped).
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),

    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),

    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
    roleIdx: index('idx_role_permissions_role').on(table.roleId),
    permissionIdx: index('idx_role_permissions_permission').on(
      table.permissionId,
    ),
  }),
);

export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;