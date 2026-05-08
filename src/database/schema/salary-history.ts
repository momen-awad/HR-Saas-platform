// src/database/schema/salary-history.ts

import {
  pgTable,
  uuid,
  varchar,
  date,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { primaryId, tenantId } from './base.columns';

/**
 * Salary history — append-only ledger of salary changes.
 *
 * Design decisions:
 *
 * 1. Immutable after insert:
 *    Records are NEVER updated or deleted. Each salary change creates
 *    a new row. This gives a full audit trail and lets payroll reconstruct
 *    what an employee earned at any historical point in time.
 *    There is intentionally no `updatedAt` column.
 *
 * 2. Encrypted salary:
 *    baseSalaryEncrypted holds AES-256-GCM ciphertext, same format as
 *    the employees table. Decrypted at read time by EncryptionService.
 *
 * 3. No FK to employees in Drizzle schema:
 *    Same circular-dependency avoidance as the employees table.
 *    Enforced at application layer.
 *
 * 4. This table HAS RLS (tenant_id scoped).
 */
export const salaryHistory = pgTable(
  'salary_history',
  {
    ...primaryId,
    ...tenantId,

    // References employees.id — enforced at application layer.
    employeeId: uuid('employee_id').notNull(),

    // The new salary value (encrypted)
    baseSalaryEncrypted: varchar('base_salary_encrypted', {
      length: 500,
    }).notNull(),

    salaryCurrency: varchar('salary_currency', { length: 3 })
      .notNull()
      .default('USD'),

    // When this salary takes effect
    effectiveDate: date('effective_date', { mode: 'string' }).notNull(),

    // Why was the salary changed?
    changeReason: varchar('change_reason', { length: 100 }).notNull(),
    // e.g., 'initial', 'annual_review', 'promotion', 'correction', 'termination_adjustment'

    notes: text('notes'),

    // Who made the change
    changedBy: uuid('changed_by').notNull(),

    // When this record was created
    createdAt: date('created_at', { mode: 'string' }).notNull().default('now()'),
    // Note: Using date type here is intentional — we only need day-level
    // granularity for the record creation timestamp. The actual effectiveDate
    // is the business-meaningful date.
  },
  (table) => ({
    // Primary lookup: employee salary history over time
    employeeHistoryIdx: index('idx_salary_history_employee').on(
      table.tenantId,
      table.employeeId,
      table.effectiveDate,
    ),

    // Tenant-level queries (e.g., all salary changes in a period)
    tenantDateIdx: index('idx_salary_history_tenant_date').on(
      table.tenantId,
      table.effectiveDate,
    ),
  }),
);

export type SalaryHistory = typeof salaryHistory.$inferSelect;
export type NewSalaryHistory = typeof salaryHistory.$inferInsert;
