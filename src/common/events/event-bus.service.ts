// src/common/events/event-bus.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from 'eventemitter2';
import { BaseEvent } from './base.event';
import { IDomainEvent, IEventBus } from './interfaces/event-bus.interface';
import { OutboxService } from '../../modules/outbox/outbox.service';
import { PoolClient } from 'pg';

/**
 * EventBusService is the central hub for domain event communication.
 *
 * It provides two emission strategies:
 *
 * 1. emit() — RECOMMENDED: Writes to outbox for reliable processing.
 *    The outbox dispatcher later publishes to in-process handlers.
 *    Guarantees at-least-once delivery even across crashes.
 *
 * 2. emitDirect() — Immediate in-process emission.
 *    No persistence — use only for non-critical events.
 *
 * Handlers register using the @OnEvent() decorator from eventemitter2,
 * or via our custom @OnDomainEvent() decorator.
 */
@Injectable()
export class EventBusService implements IEventBus {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * Emit an event via the transactional outbox.
   *
   * If a transactionClient (PoolClient) is provided, the event is written
   * in the same transaction as the business operation.
   * Otherwise, it's written independently (less safe).
   *
   * @param event - The domain event
   * @param transactionClient - Optional PoolClient for transactional write
   */
  async emitAsync(
    event: BaseEvent,
    transactionClient?: PoolClient,
  ): Promise<void> {
    try {
      if (transactionClient) {
        await this.outboxService.writeEventWithClient(
          transactionClient,
          event,
        );
      } else {
        await this.outboxService.writeEvent(event);
      }

      this.logger.debug(
        `Event queued to outbox: ${event.eventType} [${event.eventId}]`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue event to outbox: ${event.eventType} [${event.eventId}]`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Emit multiple events via the outbox in a single operation.
   */
  async emitAsyncBatch(
    events: BaseEvent[],
    transactionClient?: PoolClient,
  ): Promise<void> {
    if (events.length === 0) return;

    try {
      if (transactionClient) {
        await this.outboxService.writeEventsWithClient(
          transactionClient,
          events,
        );
      } else {
        await this.outboxService.writeEvents(events);
      }

      this.logger.debug(
        `${events.length} events queued to outbox: ${events.map((e) => e.eventType).join(', ')}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue batch events to outbox`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Emit an event directly to in-process handlers.
   * No persistence — event is lost if app crashes.
   * Use for non-critical operations like cache invalidation.
   */
  async emitDirect(event: IDomainEvent): Promise<void> {
    try {
      await this.emitter.emitAsync(event.eventType, event.toPayload());
      this.logger.debug(
        `Event emitted directly: ${event.eventType} [${event.eventId}]`,
      );
    } catch (error) {
      this.logger.error(
        `Error in direct event handler for: ${event.eventType}`,
        error.stack,
      );
      // Don't throw — direct events are fire-and-forget
    }
  }

  /**
   * Publish an event from the outbox dispatcher to in-process handlers.
   * Called by OutboxDispatcherService, NOT by application code.
   */
  async publishFromOutbox(
    eventType: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const listenerCount = this.emitter.listenerCount(eventType);

    if (listenerCount === 0) {
      this.logger.warn(
        `No handlers registered for event: ${eventType}`,
      );
      return;
    }

    await this.emitter.emitAsync(eventType, payload);
    this.logger.debug(
      `Event published from outbox: ${eventType} → ${listenerCount} handler(s)`,
    );
  }
}

