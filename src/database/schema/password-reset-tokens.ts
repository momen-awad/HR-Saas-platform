// src/database/schema/password-reset-tokens.ts

import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  index,
  uuid,
} from 'drizzle-orm/pg-core';
import { primaryId } from './base.columns';
import { users } from './users';

/**
 * Password reset tokens — time-limited, single-use.
 *
 * Flow:
 * 1. User requests password reset (forgot-password)
 * 2. System generates a random token, hashes it, stores the hash here
 * 3. Raw token is sent to the user's email (via notification system)
 * 4. User submits the raw token + new password (reset-password)
 * 5. System hashes the submitted token, looks up the hash
 * 6. If found, not expired, not used → update password, mark token as used
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    ...primaryId,

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    tokenHash: varchar('token_hash', { length: 64 }).notNull(), // SHA-256

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    isUsed: boolean('is_used').notNull().default(false),
    usedAt: timestamp('used_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tokenHashIdx: index('idx_password_reset_hash').on(table.tokenHash),
    userIdIdx: index('idx_password_reset_user').on(table.userId),
  }),
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;