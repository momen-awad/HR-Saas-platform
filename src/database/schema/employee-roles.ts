// src/database/schema/employee-roles.ts

import {
  pgTable,
  uuid,
  primaryKey,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { tenantId } from './base.columns';
import { roles } from './roles';

/**
 * Employee-Role assignment table.
 *
 * Maps employees to roles within a tenant.
 * An employee can have multiple roles; their effective permissions
 * are the UNION of all role permissions.
 *
 * Has tenant_id for RLS enforcement.
 */
export const employeeRoles = pgTable(
  'employee_roles',
  {
    ...tenantId,

    employeeId: uuid('employee_id').notNull(),

    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),

    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    assignedBy: uuid('assigned_by'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.employeeId, table.roleId] }),
    employeeIdx: index('idx_employee_roles_employee').on(
      table.tenantId,
      table.employeeId,
    ),
    roleIdx: index('idx_employee_roles_role').on(
      table.tenantId,
      table.roleId,
    ),
  }),
);

export type EmployeeRole = typeof employeeRoles.$inferSelect;
export type NewEmployeeRole = typeof employeeRoles.$inferInsert;