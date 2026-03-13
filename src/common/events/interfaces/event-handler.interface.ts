// src/common/events/interfaces/event-handler.interface.ts

import { IDomainEvent } from './event-bus.interface';

/**
 * Contract for event handlers.
 *
 * Every handler must:
 * 1. Be idempotent (may receive the same event twice)
 * 2. Handle errors gracefully (don't crash the dispatcher)
 * 3. Be fast (< 5 seconds) or delegate to a background job
 */
export interface IEventHandler<T extends IDomainEvent = IDomainEvent> {
  handle(event: T): Promise<void>;
}

