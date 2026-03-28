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
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────────
// EVENT OUTBOX TABLE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Transactional outbox — الـ persistent store للـ domain events.
 *
 * الـ pattern:
 * 1. الـ business service بتكتب الإيفنت في نفس الـ transaction مع الـ business data.
 * 2. الـ OutboxDispatcher بيعمل poll على الجدول ده.
 * 3. الـ dispatcher بيبعت الإيفنت للـ in-process handlers.
 * 4. الـ dispatcher بيعلّم الإيفنت كـ processed.
 *
 * الجدول ده مفيش عليه RLS لأن:
 * - الـ dispatcher بيتعامل مع كل الـ tenants
 * - الـ tenant_id موجود للـ context routing بس، مش للـ isolation
 * - بس الـ application code (مش الـ users) هو اللي بيقرأ الجدول ده
 */
export const eventOutbox = pgTable(
  'event_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // تعريف الإيفنت
    eventType: varchar('event_type', { length: 200 }).notNull(),
    eventId:   uuid('event_id').notNull(), // مفتاح الـ deduplication من الإيفنت نفسه

    // الـ payload
    payload: jsonb('payload').notNull(),

    // الـ tenant scope (للـ context setting عند المعالجة)
    tenantId: uuid('tenant_id'),

    // مين عمل الإيفنت ده
    triggeredBy: varchar('triggered_by', { length: 255 }),

    // حالة المعالجة:
    //   pending → processing → processed
    //   pending → processing → failed → (retry) → processing → ...
    //   failed  → dead_letter  (بعد استنفاد الـ retries)
    status: varchar('status', { length: 50 }).notNull().default('pending'),

    // إدارة الـ retries
    retryCount:  integer('retry_count').notNull().default(0),
    maxRetries:  integer('max_retries').notNull().default(5),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),

    // metadata المعالجة
    processedAt:         timestamp('processed_at',          { withTimezone: true }),
    processingStartedAt: timestamp('processing_started_at', { withTimezone: true }),
    errorMessage:        text('error_message'),

    // timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // الـ primary query: إيجاد الـ pending events للمعالجة
    pendingIdx: index('idx_outbox_pending').on(table.status, table.createdAt),

    // الـ cleanup query: إيجاد الـ processed القديمة
    processedIdx: index('idx_outbox_processed_cleanup').on(table.status, table.processedAt),

    // الـ deduplication check
    eventIdIdx: index('idx_outbox_event_id').on(table.eventId),

    // الـ tenant-scoped queries (للـ debugging)
    tenantIdx: index('idx_outbox_tenant').on(table.tenantId, table.createdAt),
  }),
);

export type EventOutboxRecord    = typeof eventOutbox.$inferSelect;
export type NewEventOutboxRecord = typeof eventOutbox.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// OUTBOX PROCESSED EVENTS TABLE  ← جديد: للـ idempotency
// ─────────────────────────────────────────────────────────────────────────────
/**
 * جدول الـ idempotency — بيمنع معالجة نفس الإيفنت أكتر من مرة لكل handler.
 *
 * ليه جدول منفصل وملا بنعتمد على onConflictDoNothing في كل handler؟
 * - مش كل العمليات بيكون فيها جدول واضح نعمل عليه conflict check
 * - الـ notification، الـ audit، وغيرها محتاجة idempotency صريحة
 * - بيدي رؤية مركزية على كل handler اشتغل على أي إيفنت
 *
 * الـ unique constraint على (event_id, handler_name) يضمن إن:
 * - نفس الإيفنت ممكن يتعالج من أكتر من handler (طبيعي)
 * - نفس الـ handler مش هيعالج نفس الإيفنت أكتر من مرة (idempotency)
 *
 * الجدول ده مفيش عليه RLS بنفس سبب event_outbox.
 */
export const outboxProcessedEvents = pgTable(
  'outbox_processed_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // الـ idempotency key: مين عالج إيه
    eventId:     uuid('event_id').notNull(),
    handlerName: varchar('handler_name', { length: 200 }).notNull(),

    // للـ debugging والـ monitoring
    eventType:   varchar('event_type', { length: 200 }),
    tenantId:    uuid('tenant_id'),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // الـ unique constraint الأساسي للـ idempotency
    uniqueEventHandler: uniqueIndex('idx_processed_event_handler_unique').on(
      table.eventId,
      table.handlerName,
    ),

    // للـ debugging: إيجاد كل الـ handlers اللي اشتغلت على إيفنت معين
    eventIdx: index('idx_processed_event_id').on(table.eventId),

    // للـ cleanup: إيجاد الـ records القديمة
    processedAtIdx: index('idx_processed_at').on(table.processedAt),

    // للـ per-tenant cleanup والـ debugging في المستقبل
    // لو عندك tenants كتير وحبيت تعمل cleanup أو query لـ tenant معين
    tenantProcessedIdx: index('idx_processed_tenant_processed_at').on(
      table.tenantId,
      table.processedAt,
    ),
  }),
);

export type OutboxProcessedEvent    = typeof outboxProcessedEvents.$inferSelect;
export type NewOutboxProcessedEvent = typeof outboxProcessedEvents.$inferInsert;
