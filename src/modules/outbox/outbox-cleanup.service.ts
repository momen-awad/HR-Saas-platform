// src/modules/outbox/outbox-cleanup.service.ts

import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { and, eq, lte } from 'drizzle-orm';
import { INJECTION_TOKENS }  from '../../common/constants/injection-tokens';
import type { DrizzleDatabase }   from '../../database/database.providers';
import { eventOutbox }       from '../../database/schema/event-outbox';
import { IdempotencyService } from './idempotency.service';

/**
 * OutboxCleanupService — بيمسح الـ events القديمة من:
 * 1. جدول event_outbox (الـ processed والـ dead_letter القديمة)
 * 2. جدول outbox_processed_events (الـ idempotency records القديمة)
 *
 * الـ retention policy:
 * - Processed events:   7 يوم  (للـ debugging)
 * - Dead-letter events: 30 يوم (للـ manual review)
 * - Idempotency records: 30 يوم
 *
 * بيشتغل كل ساعة عبر setInterval.
 *
 * ملاحظة: الـ class ده بيعمل implements OnModuleInit + OnModuleDestroy
 * صراحة عشان الـ type safety (الـ original كان بينفذهم من غير الـ implements)
 */
@Injectable()
export class OutboxCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxCleanupService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  // ─── Retention Config ────────────────────────────────────────────────────
  private readonly PROCESSED_RETENTION_DAYS    = 7;
  private readonly DEAD_LETTER_RETENTION_DAYS  = 30;
  private readonly IDEMPOTENCY_RETENTION_DAYS  = 30;
  private readonly CLEANUP_INTERVAL_MS         = 60 * 60 * 1_000; // ساعة
  // ─────────────────────────────────────────────────────────────────────────

  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
    private readonly idempotency: IdempotencyService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  onModuleInit(): void {
    this.intervalHandle = setInterval(
      () => this.cleanup(),
      this.CLEANUP_INTERVAL_MS,
    );
    this.logger.log('Outbox cleanup service started (interval: 1 hour)');
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * ينفذ الـ cleanup الكامل للجداول الثلاثة.
   * ممكن يتستدعى يدوياً للـ testing.
   */
  async cleanup(): Promise<void> {
    this.logger.log('Starting outbox cleanup...');

    await Promise.allSettled([
      this.cleanupProcessedEvents(),
      this.cleanupDeadLetterEvents(),
      this.cleanupIdempotencyRecords(),
    ]);

    this.logger.log('Outbox cleanup complete');
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private async cleanupProcessedEvents(): Promise<void> {
    const cutoff = new Date(
      Date.now() - this.PROCESSED_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
    );

    try {
      const deleted = await this.db
        .delete(eventOutbox)
        .where(
          and(
            eq(eventOutbox.status, 'processed'),
            lte(eventOutbox.processedAt, cutoff),
          ),
        )
        .returning({ id: eventOutbox.id });

      if (deleted.length > 0) {
        this.logger.log(
          `Outbox cleanup: removed ${deleted.length} processed event(s) older than ${this.PROCESSED_RETENTION_DAYS} days`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup processed events: ${(error as Error).message}`,
      );
    }
  }

  private async cleanupDeadLetterEvents(): Promise<void> {
    const cutoff = new Date(
      Date.now() - this.DEAD_LETTER_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
    );

    try {
      const deleted = await this.db
        .delete(eventOutbox)
        .where(
          and(
            eq(eventOutbox.status, 'dead_letter'),
            lte(eventOutbox.createdAt, cutoff),
          ),
        )
        .returning({ id: eventOutbox.id });

      if (deleted.length > 0) {
        this.logger.warn(
          `Outbox cleanup: removed ${deleted.length} dead-letter event(s) older than ${this.DEAD_LETTER_RETENTION_DAYS} days. ` +
          `Consider reviewing these events before they expire.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup dead-letter events: ${(error as Error).message}`,
      );
    }
  }

  private async cleanupIdempotencyRecords(): Promise<void> {
    try {
      const count = await this.idempotency.cleanupOldRecords(
        this.IDEMPOTENCY_RETENTION_DAYS,
      );

      if (count > 0) {
        this.logger.log(
          `Idempotency cleanup: removed ${count} record(s) older than ${this.IDEMPOTENCY_RETENTION_DAYS} days`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup idempotency records: ${(error as Error).message}`,
      );
    }
  }
}
