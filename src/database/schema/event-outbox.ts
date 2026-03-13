// src/database/schema/event-outbox.ts

import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  integer,
  text,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Event Outbox table — the persistent store for domain events.
 *
 * The transactional outbox pattern:
 * 1. Business service writes event to this table in the SAME transaction
 *    as the business data change.
 * 2. A background dispatcher polls this table for pending events.
 * 3. Dispatcher publishes events to in-process handlers.
 * 4. Dispatcher marks events as processed.
 *
 * This guarantees at-least-once delivery of events even if the
 * application crashes after the business transaction commits.
 *
 * This table does NOT have RLS because:
 * - The dispatcher processes events for ALL tenants
 * - tenant_id is stored for routing/context, not for isolation
 * - Only the system (not users) reads this table
 */
export const eventOutbox = pgTable(
  'event_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Event identification
    eventType: varchar('event_type', { length: 200 }).notNull(),
    eventId: uuid('event_id').notNull(), // Deduplication key from the event

    // Payload
    payload: jsonb('payload').notNull(),

    // Tenant scope (for context setting when processing)
    tenantId: uuid('tenant_id'),

    // Who triggered this event
    triggeredBy: varchar('triggered_by', { length: 255 }),

    // Processing status
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    // pending → processing → processed
    // pending → processing → failed → (retry) → processing → processed
    // pending → processing → failed → dead_letter

    // Retry management
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(5),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

    // Processing metadata
    processedAt: timestamp('processed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    processingStartedAt: timestamp('processing_started_at', {
      withTimezone: true,
    }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Primary query: find pending events to process
    pendingIdx: index('idx_outbox_pending').on(
      table.status,
      table.createdAt,
    ),

    // Cleanup query: find old processed events
    processedIdx: index('idx_outbox_processed_cleanup').on(
      table.status,
      table.processedAt,
    ),

    // Deduplication check
    eventIdIdx: index('idx_outbox_event_id').on(table.eventId),

    // Tenant-scoped queries (for debugging)
    tenantIdx: index('idx_outbox_tenant').on(
      table.tenantId,
      table.createdAt,
    ),
  }),
);

export type EventOutboxRecord = typeof eventOutbox.$inferSelect;
export type NewEventOutboxRecord = typeof eventOutbox.$inferInsert;
