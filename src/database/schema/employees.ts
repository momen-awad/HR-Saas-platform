// src/database/schema/employees.ts

import {
  pgTable,
  uuid,
  varchar,
  date,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { primaryId, tenantId, timestamps } from './base.columns';

/**
 * Employees table — the central business entity.
 *
 * Design decisions:
 *
 * 1. User / Employee separation:
 *    A `User` is a global authentication credential (email + password).
 *    An `Employee` is a tenant-scoped business entity. One user can be
 *    an employee at multiple tenants simultaneously.
 *
 * 2. No FK to users table in Drizzle schema:
 *    Drizzle requires the referenced table variable to be in scope.
 *    The users table lives in a separate schema file and importing it
 *    here creates a circular module dependency. The FK is enforced at
 *    the application layer (EmployeeService validates userId exists before
 *    inserting) and documented in the migration SQL.
 *
 * 3. No FK to departments table:
 *    Same reason as above. Validated at application layer via DepartmentFacade.
 *
 * 4. Salary stored encrypted:
 *    baseSalary is AES-256-GCM encrypted via EncryptionService before
 *    storage and decrypted on read. The column holds the base64 ciphertext.
 *    Salary currency is stored in plaintext alongside it.
 *
 * 5. This table HAS RLS (tenant_id scoped).
 */
export const employees = pgTable(
  'employees',
  {
    ...primaryId,
    ...tenantId,

    // ── Link to auth identity ──────────────────────────────────────────────
    // References users.id — enforced at application layer (see note above).
    userId: uuid('user_id').notNull(),

    // ── Identity ──────────────────────────────────────────────────────────
    employeeNumber: varchar('employee_number', { length: 50 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),

    // ── Organisational ────────────────────────────────────────────────────
    // References departments.id — enforced at application layer.
    departmentId: uuid('department_id'),

    position: varchar('position', { length: 255 }),

    employmentType: varchar('employment_type', { length: 50 })
      .notNull()
      .default('full_time'),
    // full_time | part_time | contract | intern

    // ── Salary (encrypted) ────────────────────────────────────────────────
    // Stores AES-256-GCM ciphertext as a base64 string.
    // Max ciphertext length for a DECIMAL string: ~500 chars.
    baseSalaryEncrypted: varchar('base_salary_encrypted', {
      length: 500,
    }).notNull(),

    salaryCurrency: varchar('salary_currency', { length: 3 })
      .notNull()
      .default('USD'),

    // ── Dates ─────────────────────────────────────────────────────────────
    hireDate: date('hire_date', { mode: 'string' }).notNull(),
    terminationDate: date('termination_date', { mode: 'string' }),

    // ── Timezone / Locale override ────────────────────────────────────────
    // Falls back to tenant defaults when null.
    timezone: varchar('timezone', { length: 100 }),
    locale: varchar('locale', { length: 10 }),

    // ── Status ────────────────────────────────────────────────────────────
    status: varchar('status', { length: 50 }).notNull().default('active'),
    // active | on_probation | on_leave | suspended | terminated

    // ── Sensitive fields (encrypted) ──────────────────────────────────────
    bankAccountEncrypted: varchar('bank_account_encrypted', { length: 500 }),
    taxIdEncrypted: varchar('tax_id_encrypted', { length: 500 }),

    ...timestamps,
  },
  (table) => ({
    // One user can only be an employee once per tenant
    tenantUserUnique: uniqueIndex('idx_employees_tenant_user_unique').on(
      table.tenantId,
      table.userId,
    ),

    // Employee number unique within a tenant
    tenantNumberUnique: uniqueIndex('idx_employees_tenant_number_unique').on(
      table.tenantId,
      table.employeeNumber,
    ),

    // Hot path: filter by status (payroll, attendance)
    tenantStatusIdx: index('idx_employees_tenant_status').on(
      table.tenantId,
      table.status,
    ),

    // Hot path: filter by department (org chart, leave approvals)
    tenantDeptIdx: index('idx_employees_tenant_department').on(
      table.tenantId,
      table.departmentId,
    ),

    // Auth lookup: resolve employee from userId + tenantId during login
    userTenantIdx: index('idx_employees_user_tenant').on(
      table.userId,
      table.tenantId,
    ),
  }),
);

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
