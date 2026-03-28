// src/modules/outbox/outbox-dispatcher.service.ts

import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  forwardRef,
} from '@nestjs/common';
import { eq, and, lte, inArray } from 'drizzle-orm';
import { Pool }                  from 'pg';
import { INJECTION_TOKENS }      from '../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../database/database.providers';
import { PG_POOL } from '../../database/database.providers'
import {
  eventOutbox,
  EventOutboxRecord,
} from '../../database/schema/event-outbox';
import { EventBusService }  from '../../common/events/event-bus.service';
import { TenantContext }    from '../../common/context/tenant.context';

/**
 * OutboxDispatcherService — يعمل poll على جدول event_outbox ويبعت الـ events
 * للـ in-process handlers.
 *
 * ضمانات المعالجة:
 * - At-least-once delivery (ممكن يتعالج أكتر من مرة → الـ handlers لازم تكون idempotent)
 * - Concurrent-safe: بيستخدم SELECT FOR UPDATE SKIP LOCKED بـ raw SQL
 *   (Drizzle مش بيدعم SKIP LOCKED مباشرة)
 * - Crash-safe: بيستخدم processing_started_at timeout للـ stuck events
 * - Tenant-safe: كل إيفنت بيتعالج جوه TenantContext الصح بتاعه
 *
 * ملاحظة على الـ concurrent safety:
 * - الـ isRunning flag بيمنع التداخل داخل نفس الـ pod
 * - الـ FOR UPDATE SKIP LOCKED بيمنع التداخل بين الـ pods المختلفة
 * - الاتنين مع بعض بيديوا حماية كاملة
 */
@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name);

  /**
   * isRunning: بيمنع إن نفس الـ pod يبدأ batch جديدة
   * قبل ما الـ batch الحالية تخلص.
   * (مش بديل لـ SKIP LOCKED — ده للـ single-pod protection بس)
   */
  private isRunning     = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  // ─── Configuration ───────────────────────────────────────────────────────
  private readonly POLL_INTERVAL_MS  = 5_000; // كل 5 ثواني (أبطأ من الـ original 2s — أكثر كفاءة)
  private readonly BATCH_SIZE        = 50;
  private readonly STUCK_TIMEOUT_MS  = 5 * 60 * 1_000; // 5 دقايق
  private readonly BASE_RETRY_DELAY_MS = 5_000;
  // ─────────────────────────────────────────────────────────────────────────

  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,

    @Inject(PG_POOL)
    private readonly pool: Pool,

    // forwardRef عشان كسر الـ circular dependency:
    // EventBusModule ← OutboxModule ← EventBusService ← OutboxDispatcher
    @Inject(forwardRef(() => EventBusService))
    private readonly eventBus: EventBusService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  onModuleInit(): void {
    this.startPolling();
  }

  onModuleDestroy(): void {
    this.stopPolling();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POLLING LOOP
  // ─────────────────────────────────────────────────────────────────────────

  private startPolling(): void {
    this.logger.log(
      `Outbox dispatcher started (poll interval: ${this.POLL_INTERVAL_MS}ms, batch: ${this.BATCH_SIZE})`,
    );
    this.intervalHandle = setInterval(
      () => this.processOutbox(),
      this.POLL_INTERVAL_MS,
    );
  }

  private stopPolling(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.log('Outbox dispatcher stopped');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN PROCESSING
  // ─────────────────────────────────────────────────────────────────────────

  private async processOutbox(): Promise<void> {
    // منع التداخل داخل نفس الـ pod
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // الخطوة 1: استعادة الـ stuck events (اللي فضلت في processing لفترة طويلة)
      await this.reclaimStuckEvents();

      // الخطوة 2: جلب الـ pending events باستخدام FOR UPDATE SKIP LOCKED
      // (atomic: بيجيب ويغيّر الـ status في نفس الـ transaction)
      const events = await this.fetchAndLockPendingEvents();

      if (events.length === 0) return;

      this.logger.debug(`Processing ${events.length} outbox event(s)`);

      // الخطوة 3: معالجة كل إيفنت على حدة
      for (const event of events) {
        await this.processEvent(event);
      }
    } catch (error) {
      this.logger.error(
        `Outbox dispatcher error: ${(error as Error).message}`,
        (error as Error).stack,
      );
    } finally {
      this.isRunning = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH WITH LOCK (الإصلاح الرئيسي — FOR UPDATE SKIP LOCKED)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * بيجيب الـ pending events ويغيّر status-هم لـ 'processing' في نفس الـ transaction.
   *
   * بيستخدم raw SQL لأن Drizzle ORM مش بيدعم FOR UPDATE SKIP LOCKED مباشرة.
   *
   * الـ SKIP LOCKED بيضمن إن:
   * - لو عندك 3 pods كلهم بيعملوا poll في نفس الوقت
   * - كل pod هياخد batch مختلفة
   * - مفيش event هيتعالج أكتر من مرة بسبب concurrency
   *
   * الـ atomic UPDATE بيضمن إن:
   * - الـ SELECT والـ UPDATE يحصلوا في نفس الـ transaction
   * - مفيش race condition بين الخطوتين
   */
  private async fetchAndLockPendingEvents(): Promise<EventOutboxRecord[]> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query<Record<string, unknown>>(
        `UPDATE event_outbox
         SET
           status                = 'processing',
           processing_started_at = NOW()
         WHERE id IN (
           SELECT id
           FROM   event_outbox
           WHERE  status = 'pending'
              OR  (status = 'failed' AND next_retry_at <= NOW())
           ORDER  BY created_at ASC
           LIMIT  $1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *`,
        [this.BATCH_SIZE],
      );

      await client.query('COMMIT');

      // تحويل snake_case (PostgreSQL) إلى camelCase (Drizzle types)
      return result.rows.map((row) => this.mapRawRowToRecord(row));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * تحويل الـ raw SQL result (snake_case) إلى الـ EventOutboxRecord type (camelCase).
   *
   * مهم: لو غيّرت الـ schema، اتأكد إنك بتحدث الـ mapping ده.
   */
  private mapRawRowToRecord(row: Record<string, unknown>): EventOutboxRecord {
    return {
      id:                   row['id']                    as string,
      eventType:            row['event_type']            as string,
      eventId:              row['event_id']              as string,
      payload:              row['payload']               as Record<string, unknown>,
      tenantId:             (row['tenant_id']            as string)  ?? null,
      triggeredBy:          (row['triggered_by']         as string)  ?? null,
      status:               row['status']                as string,
      retryCount:           row['retry_count']           as number,
      maxRetries:           row['max_retries']           as number,
      nextRetryAt:          (row['next_retry_at']        as Date)    ?? null,
      processedAt:          (row['processed_at']         as Date)    ?? null,
      processingStartedAt:  (row['processing_started_at'] as Date)   ?? null,
      errorMessage:         (row['error_message']        as string)  ?? null,
      createdAt:            row['created_at']            as Date,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROCESS SINGLE EVENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * بيعالج إيفنت واحد.
   *
   * الإصلاح المهم هنا: TenantContext.run بيتعمل صح الأول
   * عشان كل handler يشتغل في الـ tenant context الصح بتاعه،
   * وده مهم لـ Row-Level Security (RLS).
   */
  private async processEvent(record: EventOutboxRecord): Promise<void> {
    const payload  = record.payload as Record<string, unknown>;
    const tenantId = record.tenantId;

    try {
      if (tenantId) {
        // ── تعيين الـ tenant context قبل استدعاء الـ handlers ──────────────
        // ده ضروري لأن:
        // 1. الـ RLS middleware بيعتمد على TenantContext
        // 2. لو الـ handler عمل database query من غير context صح → RLS هيرفض
        // 3. الـ TenantContext.run بيخلي الـ context محدود في الـ async scope ده بس
        await this.runWithTenantContext(tenantId, async () => {
          await this.eventBus.publishFromOutbox(record.eventType, payload);
        });
      } else {
        // system-level event — مفيش tenant context
        await this.eventBus.publishFromOutbox(record.eventType, payload);
      }

      // تعليم الإيفنت كـ processed
      await this.db
        .update(eventOutbox)
        .set({
          status:               'processed',
          processedAt:          new Date(),
          processingStartedAt:  null,
          errorMessage:         null,
        })
        .where(eq(eventOutbox.id, record.id));

      this.logger.debug(
        `Outbox event processed: ${record.eventType} [${record.eventId}]`,
      );
    } catch (error) {
      await this.handleEventFailure(record, error as Error);
    }
  }

  /**
   * بيشغّل async function جوه TenantContext بشكل صح.
   *
   * بيستخدم Promise wrapper عشان يضمن إن الـ async function
   * بتشتغل فعلاً جوه الـ TenantContext وبترجع الـ result صح.
   */
  private runWithTenantContext(
    tenantId: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      TenantContext.run({ tenantId }, () => {
        fn().then(resolve).catch(reject);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FAILURE HANDLING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * بيتعامل مع الـ failed event: يزود الـ retry count أو يحوّله لـ dead_letter.
   */
  private async handleEventFailure(
    record: EventOutboxRecord,
    error: Error,
  ): Promise<void> {
    const newRetryCount = record.retryCount + 1;

    if (newRetryCount >= record.maxRetries) {
      // ── Dead letter: استنفذنا كل المحاولات ──────────────────────────────
      await this.db
        .update(eventOutbox)
        .set({
          status:               'dead_letter',
          retryCount:           newRetryCount,
          errorMessage:         error.message,
          processingStartedAt:  null,
        })
        .where(eq(eventOutbox.id, record.id));

      this.logger.error(
        `[DEAD LETTER] Event ${record.eventType} [${record.eventId}] ` +
        `dead-lettered after ${newRetryCount} retries. Error: ${error.message}`,
      );

      // TODO (Module 8): إرسال alert للـ ops team عن الـ dead-letter event
    } else {
      // ── Retry مع exponential backoff ────────────────────────────────────
      // الـ formula: BASE * 2^retryCount
      // مثال: 5s, 10s, 20s, 40s, 80s
      const delayMs    = this.BASE_RETRY_DELAY_MS * Math.pow(2, newRetryCount);
      const nextRetryAt = new Date(Date.now() + delayMs);

      await this.db
        .update(eventOutbox)
        .set({
          status:               'failed',
          retryCount:           newRetryCount,
          errorMessage:         error.message,
          nextRetryAt,
          processingStartedAt:  null,
        })
        .where(eq(eventOutbox.id, record.id));

      this.logger.warn(
        `Event failed (retry ${newRetryCount}/${record.maxRetries}): ` +
        `${record.eventType} [${record.eventId}] — ` +
        `next retry at ${nextRetryAt.toISOString()}. Error: ${error.message}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STUCK EVENT RECLAMATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * بيسترجع الـ events اللي فضلت في حالة 'processing' لفترة طويلة.
   *
   * السيناريو: الـ app اتوقف أو crash وهو بيعالج events →
   * الـ events فاضلة في 'processing' للأبد.
   *
   * الحل: لو event في 'processing' لأكتر من STUCK_TIMEOUT_MS →
   * نرجعه لـ 'pending' عشان يتعالج تاني.
   */
  private async reclaimStuckEvents(): Promise<void> {
    const stuckThreshold = new Date(Date.now() - this.STUCK_TIMEOUT_MS);

    const reclaimed = await this.db
      .update(eventOutbox)
      .set({
        status:               'pending',
        processingStartedAt:  null,
      })
      .where(
        and(
          eq(eventOutbox.status, 'processing'),
          lte(eventOutbox.processingStartedAt, stuckThreshold),
        ),
      )
      .returning({ id: eventOutbox.id, eventType: eventOutbox.eventType });

    if (reclaimed.length > 0) {
      this.logger.warn(
        `Reclaimed ${reclaimed.length} stuck outbox event(s): ` +
        reclaimed.map((e) => e.eventType).join(', '),
      );
    }
  }
}
