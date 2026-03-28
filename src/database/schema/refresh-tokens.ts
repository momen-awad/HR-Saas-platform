// src/database/schema/refresh-tokens.ts

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { primaryId } from './base.columns';
import { users } from './users';

/**
 * Refresh tokens table — stored for rotation and revocation.
 *
 * Design:
 * - The raw refresh token is NEVER stored. Only a SHA-256 hash is stored.
 * - The client receives the raw token. On refresh, they send it back.
 * - We hash it and look up the hash in this table.
 * - On successful refresh, the old token is revoked and a new one is issued.
 * - If a revoked token is reused, the entire family is revoked (compromise detected).
 *
 * Token families:
 * - A "family" is a chain of refresh tokens from a single login.
 * - familyId ties them together so we can revoke all tokens from a login session.
 *
 * This table does NOT have RLS — refresh tokens are system-level.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    ...primaryId,

    // Owner
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),

    // Token
    tokenHash: varchar('token_hash', { length: 64 }).notNull(), // SHA-256 hex
    familyId: uuid('family_id').notNull(), // Groups tokens from same login

    // Status
    isRevoked: boolean('is_revoked').notNull().default(false),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: varchar('revoked_reason', { length: 100 }),

    // Expiry
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    // Metadata
    userAgent: varchar('user_agent', { length: 500 }),
    ipAddress: varchar('ip_address', { length: 45 }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tokenHashIdx: index('idx_refresh_tokens_hash').on(table.tokenHash),
    userIdIdx: index('idx_refresh_tokens_user').on(table.userId, table.tenantId),
    familyIdx: index('idx_refresh_tokens_family').on(table.familyId),
    expiryIdx: index('idx_refresh_tokens_expiry').on(table.expiresAt),
  }),
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;