// src/modules/outbox/outbox.service.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../common/constants/injection-tokens';
import type { DrizzleDatabase } from '../../database/database.providers';
import { eventOutbox, NewEventOutboxRecord } from '../../database/schema/event-outbox';
import { BaseEvent } from '../../common/events/base.event';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../../database/database.providers';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';

/**
 * OutboxService writes domain events to the event_outbox table.
 *
 * This is the WRITE side of the outbox pattern. It provides two methods:
 *
 * 1. writeEvent() — Write event using the global Drizzle instance.
 *    Use when NOT inside a transaction (less safe but simpler).
 *
 * 2. writeEventWithClient() — Write event using a specific PoolClient.
 *    Use when inside a transaction (RECOMMENDED — guarantees atomicity).
 *
 * The service does NOT emit events. That is the dispatcher's job.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
    @Inject(PG_POOL)
    private readonly pool: Pool,
  ) {}

  /**
   * Write an event to the outbox using the global database connection.
   * Use this when the calling code is NOT already in a transaction.
   *
   * WARNING: This does NOT guarantee atomicity with the business operation.
   * For critical events, use writeEventWithClient() inside a transaction.
   */
  async writeEvent(event: BaseEvent): Promise<void> {
    await this.db.insert(eventOutbox).values({
      eventType: event.eventType,
      eventId: event.eventId,
      payload: event.toFullPayload(),
      tenantId: event.tenantId || null,
      triggeredBy: event.triggeredBy,
      status: 'pending',
      maxRetries: 5,
    });
  }

  /**
   * Write an event to the outbox using a specific PoolClient.
   * This MUST be called within the same transaction as the business operation.
   *
   * Usage:
   *   const client = await pool.connect();
   *   try {
   *     await client.query('BEGIN');
   *     // ... business logic ...
   *     await outboxService.writeEventWithClient(client, event);
   *     await client.query('COMMIT');
   *   } catch (e) {
   *     await client.query('ROLLBACK');
   *   } finally {
   *     client.release();
   *   }
   */
  async writeEventWithClient(
    client: PoolClient,
    event: BaseEvent,
  ): Promise<void> {
    const clientDb = drizzle(client, { schema });

    await clientDb.insert(eventOutbox).values({
      eventType: event.eventType,
      eventId: event.eventId,
      payload: event.toFullPayload(),
      tenantId: event.tenantId || null,
      triggeredBy: event.triggeredBy,
      status: 'pending',
      maxRetries: 5,
    });
  }

  /**
   * Write multiple events in a single insert.
   * Used when a business operation produces multiple events.
   */
  async writeEvents(events: BaseEvent[]): Promise<void> {
    if (events.length === 0) return;

    const records: NewEventOutboxRecord[] = events.map((event) => ({
      eventType: event.eventType,
      eventId: event.eventId,
      payload: event.toFullPayload(),
      tenantId: event.tenantId || null,
      triggeredBy: event.triggeredBy,
      status: 'pending' as const,
      maxRetries: 5,
    }));

    await this.db.insert(eventOutbox).values(records);
  }

  /**
   * Write multiple events using a specific PoolClient (transactional).
   */
  async writeEventsWithClient(
    client: PoolClient,
    events: BaseEvent[],
  ): Promise<void> {
    if (events.length === 0) return;

    const clientDb = drizzle(client, { schema });

    const records: NewEventOutboxRecord[] = events.map((event) => ({
      eventType: event.eventType,
      eventId: event.eventId,
      payload: event.toFullPayload(),
      tenantId: event.tenantId || null,
      triggeredBy: event.triggeredBy,
      status: 'pending' as const,
      maxRetries: 5,
    }));

    await clientDb.insert(eventOutbox).values(records);
  }
}

