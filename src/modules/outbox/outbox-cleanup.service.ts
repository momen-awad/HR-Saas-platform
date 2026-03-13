// src/modules/outbox/outbox-cleanup.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { and, eq, lte } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../database/database.providers';
import { eventOutbox } from '../../database/schema/event-outbox';

/**
 * OutboxCleanupService removes old processed events from the outbox table.
 *
 * Retention policy:
 * - Processed events: kept for 7 days (for debugging), then deleted
 * - Dead-letter events: kept for 30 days (for manual review), then deleted
 *
 * Runs once per hour via scheduled task (Module 1.5 adds cron scheduling).
 * For now, it exposes a method that can be called manually or via a simple interval.
 */
@Injectable()
export class OutboxCleanupService {
  private readonly logger = new Logger(OutboxCleanupService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  private readonly PROCESSED_RETENTION_DAYS = 7;
  private readonly DEAD_LETTER_RETENTION_DAYS = 30;
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

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
    }
  }

  /**
   * Delete old processed and dead-letter events.
   */
  async cleanup(): Promise<void> {
    try {
      // Delete old processed events
      const processedCutoff = new Date(
        Date.now() - this.PROCESSED_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );

      const processedDeleted = await this.db
        .delete(eventOutbox)
        .where(
          and(
            eq(eventOutbox.status, 'processed'),
            lte(eventOutbox.processedAt, processedCutoff),
          ),
        )
        .returning({ id: eventOutbox.id });

      // Delete old dead-letter events
      const deadLetterCutoff = new Date(
        Date.now() -
          this.DEAD_LETTER_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );

      const deadLetterDeleted = await this.db
        .delete(eventOutbox)
        .where(
          and(
            eq(eventOutbox.status, 'dead_letter'),
            lte(eventOutbox.createdAt, deadLetterCutoff),
          ),
        )
        .returning({ id: eventOutbox.id });

      if (processedDeleted.length > 0 || deadLetterDeleted.length > 0) {
        this.logger.log(
          `Outbox cleanup: removed ${processedDeleted.length} processed, ` +
          `${deadLetterDeleted.length} dead-letter events`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Outbox cleanup failed: ${error.message}`,
        error.stack,
      );
    }
  }
}
