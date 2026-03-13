import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { sql, eq, and, or, lte, inArray } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../database/database.providers';
import { eventOutbox, EventOutboxRecord } from '../../database/schema/event-outbox';
import { EventBusService } from '../../common/events/event-bus.service';
import { TenantContext } from '../../common/context/tenant.context';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.providers';

@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private isRunning = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  private readonly POLL_INTERVAL_MS = 2000;
  private readonly BATCH_SIZE = 50;
  private readonly STUCK_TIMEOUT_MS = 5 * 60 * 1000;
  private readonly BASE_RETRY_DELAY_MS = 5000;

  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
    @Inject(PG_POOL)
    private readonly pool: Pool,
    @Inject(forwardRef(() => EventBusService))
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit() {
    this.startPolling();
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  private startPolling(): void {
    this.logger.log(`Outbox dispatcher started (poll interval: ${this.POLL_INTERVAL_MS}ms, batch size: ${this.BATCH_SIZE})`);
    this.intervalHandle = setInterval(() => this.processOutbox(), this.POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.log('Outbox dispatcher stopped');
  }

  private async processOutbox(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await this.reclaimStuckEvents();
      const events = await this.fetchPendingEvents();

      if (events.length === 0) return;

      this.logger.debug(`Processing ${events.length} outbox event(s)`);

      for (const event of events) {
        await this.processEvent(event);
      }
    } catch (error) {
      this.logger.error(`Outbox dispatcher error: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  private async fetchPendingEvents(): Promise<EventOutboxRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE event_outbox
         SET status = 'processing', processing_started_at = NOW()
         WHERE id IN (
           SELECT id FROM event_outbox
           WHERE (status = 'pending')
              OR (status = 'failed' AND next_retry_at <= NOW())
           ORDER BY created_at ASC
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *`,
        [this.BATCH_SIZE],
      );

      await client.query('COMMIT');
      return result.rows.map(row => this.mapRawToRecord(row));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private mapRawToRecord(row: any): EventOutboxRecord {
    return {
      id: row.id,
      eventType: row.event_type,
      eventId: row.event_id,
      payload: row.payload,
      tenantId: row.tenant_id,
      triggeredBy: row.triggered_by,
      status: row.status,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      nextRetryAt: row.next_retry_at,
      processedAt: row.processed_at,
      errorMessage: row.error_message,
      processingStartedAt: row.processing_started_at,
      createdAt: row.created_at,
    };
  }

  private async processEvent(record: EventOutboxRecord): Promise<void> {
    const payload = record.payload as Record<string, any>;
    const tenantId = record.tenantId;

    try {
      if (tenantId) {
        await new Promise<void>((resolve, reject) => {
          TenantContext.run({ tenantId }, async () => {
            try {
              await this.eventBus.publishFromOutbox(record.eventType, payload);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        });
      } else {
        await this.eventBus.publishFromOutbox(record.eventType, payload);
      }

      await this.db
        .update(eventOutbox)
        .set({
          status: 'processed',
          processedAt: new Date(),
          processingStartedAt: null,
        })
        .where(eq(eventOutbox.id, record.id));

      this.logger.debug(`Outbox event processed: ${record.eventType} [${record.eventId}]`);
    } catch (error) {
      await this.handleEventFailure(record, error);
    }
  }

  private async handleEventFailure(record: EventOutboxRecord, error: Error): Promise<void> {
    const newRetryCount = record.retryCount + 1;

    if (newRetryCount >= record.maxRetries) {
      await this.db
        .update(eventOutbox)
        .set({
          status: 'dead_letter',
          retryCount: newRetryCount,
          errorMessage: error.message,
          processingStartedAt: null,
        })
        .where(eq(eventOutbox.id, record.id));

      this.logger.error(`Event dead-lettered after ${newRetryCount} retries: ${record.eventType} [${record.eventId}] — ${error.message}`);
    } else {
      const delayMs = this.BASE_RETRY_DELAY_MS * Math.pow(2, newRetryCount);
      const nextRetryAt = new Date(Date.now() + delayMs);

      await this.db
        .update(eventOutbox)
        .set({
          status: 'failed',
          retryCount: newRetryCount,
          errorMessage: error.message,
          nextRetryAt,
          processingStartedAt: null,
        })
        .where(eq(eventOutbox.id, record.id));

      this.logger.warn(`Event failed (retry ${newRetryCount}/${record.maxRetries}): ${record.eventType} [${record.eventId}] — next retry at ${nextRetryAt.toISOString()}`);
    }
  }

  private async reclaimStuckEvents(): Promise<void> {
    const stuckThreshold = new Date(Date.now() - this.STUCK_TIMEOUT_MS);

    const result = await this.db
      .update(eventOutbox)
      .set({
        status: 'pending',
        processingStartedAt: null,
      })
      .where(
        and(
          eq(eventOutbox.status, 'processing'),
          lte(eventOutbox.processingStartedAt, stuckThreshold),
        ),
      )
      .returning({ id: eventOutbox.id });

    if (result.length > 0) {
      this.logger.warn(`Reclaimed ${result.length} stuck outbox event(s)`);
    }
  }
}
