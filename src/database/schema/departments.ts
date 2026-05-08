// src/database/schema/departments.ts

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { primaryId, tenantId, timestamps } from './base.columns';

/**
 * Departments table — tenant-scoped organizational units.
 *
 * Supports hierarchical structure via self-referential parent_id.
 * The hierarchy depth is intentionally not enforced at DB level —
 * cycles are prevented at the application layer.
 *
 * This table HAS RLS (tenant_id scoped).
 *
 * Manager assignment references employees.id but we avoid a direct
 * FK here to break the circular dependency:
 *   departments → employees → departments
 * The FK is enforced at the application layer instead.
 */
export const departments = pgTable(
  'departments',
  {
    ...primaryId,
    ...tenantId,

    // Department name — unique per tenant
    name: varchar('name', { length: 255 }).notNull(),

    // Hierarchical structure — NULL means top-level department
    parentId: uuid('parent_id'),
    // Note: No FK to self here intentionally — Drizzle self-refs require
    // the table variable, which creates a circular reference at module load.
    // Referential integrity is enforced at the application layer.

    // Manager — references employees.id but no FK (circular dep avoidance)
    // Enforced at application layer.
    managerEmployeeId: uuid('manager_employee_id'),

    // Soft-delete via isActive flag (keeps historical references intact)
    isActive: boolean('is_active').notNull().default(true),

    ...timestamps,
  },
  (table) => ({
    // Unique department name per tenant
    tenantNameUnique: uniqueIndex('idx_departments_tenant_name_unique').on(
      table.tenantId,
      table.name,
    ),

    // Fast lookup by tenant
    tenantIdx: index('idx_departments_tenant').on(table.tenantId),

    // Hierarchy traversal
    parentIdx: index('idx_departments_parent').on(
      table.tenantId,
      table.parentId,
    ),

    // Manager lookup (find departments managed by an employee)
    managerIdx: index('idx_departments_manager').on(
      table.tenantId,
      table.managerEmployeeId,
    ),
  }),
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
