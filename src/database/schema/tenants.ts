import { pgTable, varchar, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './base.columns';

export const tenants = pgTable('tenants', {
  ...primaryId,
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  planType: varchar('plan_type', { length: 50 }).notNull().default('free'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  settings: jsonb('settings').notNull().default({}),
  defaultTimezone: varchar('default_timezone', { length: 100 }).notNull().default('UTC'),
  defaultLocale: varchar('default_locale', { length: 10 }).notNull().default('en'),
  fiscalYearStartMonth: integer('fiscal_year_start_month').notNull().default(1),
  maxEmployees: integer('max_employees'),
  ...timestamps,
}, (table) => ({
  statusIdx: index('idx_tenants_status').on(table.status),
  slugIdx: index('idx_tenants_slug').on(table.slug),
}));

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
