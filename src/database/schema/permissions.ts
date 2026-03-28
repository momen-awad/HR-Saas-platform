// src/database/schema/permissions.ts

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './base.columns';

/**
 * Permissions table — global permission definitions.
 *
 * Permissions are NOT tenant-scoped. They represent the system's
 * complete capability vocabulary. Every tenant sees the same
 * permission set. Permissions are seeded at startup and never
 * created by tenants.
 *
 * This table does NOT have RLS.
 *
 * Naming convention: module:action
 *   e.g., 'attendance:checkin', 'payroll:process', 'employee:create'
 */
export const permissions = pgTable(
  'permissions',
  {
    ...primaryId,

    // Permission identifier (used in code and JWT)
    code: varchar('code', { length: 100 }).notNull(),

    // Human-readable description
    description: text('description'),

    // Which module this permission belongs to
    module: varchar('module', { length: 50 }).notNull(),

    // Grouping for UI display
    category: varchar('category', { length: 100 }),

    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex('idx_permissions_code_unique').on(table.code),
    moduleIdx: index('idx_permissions_module').on(table.module),
  }),
);

export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;