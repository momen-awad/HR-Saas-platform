// src/database/schema/users.ts

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './base.columns';

/**
 * Users table — authentication identities.
 *
 * A User represents a LOGIN CREDENTIAL, not a business entity.
 * The same user can be an Employee at multiple tenants.
 *
 * This table does NOT have tenant_id — users are global.
 * This table does NOT have RLS — user lookup happens before
 * tenant context is established (during login).
 *
 * The relationship is:
 *   User (1) ──── (N) Employee (tenant-scoped)
 *
 * A user logs in with email + password, then selects which
 * tenant they want to access. The employee record for that
 * tenant is resolved and its ID is embedded in the JWT.
 */
export const users = pgTable(
  'users',
  {
    ...primaryId,

    // Credentials
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),

    // Account status
    isActive: boolean('is_active').notNull().default(true),

    // MFA (future — Module 2.2 lays groundwork, full implementation later)
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    mfaSecretEncrypted: varchar('mfa_secret_encrypted', { length: 500 }),

    // Brute force protection
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),

    // Metadata
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),

    ...timestamps,
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
    activeIdx: index('idx_users_active').on(table.isActive),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;