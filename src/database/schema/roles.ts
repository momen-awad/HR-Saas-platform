// src/database/schema/roles.ts

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { primaryId, tenantId, timestamps } from './base.columns';
import { tenants } from './tenants';

/**
 * Roles table — tenant-scoped role definitions.
 *
 * Each tenant has its own set of roles. System roles are seeded
 * during tenant onboarding and cannot be deleted by the tenant.
 * Custom roles are fully managed by the tenant admin.
 *
 * This table HAS RLS (tenant_id scoped).
 */
export const roles = pgTable(
  'roles',
  {
    ...primaryId,
    ...tenantId,

    // Role name (unique per tenant)
    name: varchar('name', { length: 100 }).notNull(),

    // Human-readable description
    description: text('description'),

    // System roles cannot be deleted or renamed
    isSystem: boolean('is_system').notNull().default(false),

    // Slug for programmatic reference (e.g., 'tenant_admin', 'hr_manager')
    slug: varchar('slug', { length: 100 }).notNull(),

    // Active flag
    isActive: boolean('is_active').notNull().default(true),

    ...timestamps,
  },
  (table) => ({
    tenantSlugUnique: uniqueIndex('idx_roles_tenant_slug_unique').on(
      table.tenantId,
      table.slug,
    ),
    tenantNameUnique: uniqueIndex('idx_roles_tenant_name_unique').on(
      table.tenantId,
      table.name,
    ),
    tenantIdx: index('idx_roles_tenant').on(table.tenantId),
  }),
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;