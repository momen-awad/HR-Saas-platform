// src/common/events/interfaces/event-bus.interface.ts

/**
 * Contract for the internal event bus.
 *
 * The event bus supports two emission strategies:
 * 1. emitAsync() — For events that MUST be persisted (outbox pattern)
 *    Used for: business events that trigger notifications, audit logs, payroll
 *
 * 2. emitDirect() — For events processed immediately in-process
 *    Used for: cache invalidation, real-time metrics, non-critical events
 *
 * Handlers register via @OnDomainEvent() decorator.
 */
export interface IEventBus {
  /**
   * Emit an event through the transactional outbox.
   * The event is persisted in the same database transaction as the business operation.
   * The outbox dispatcher later reads it and triggers handlers.
   *
   * @param event - The domain event to emit
   * @param transactionClient - Optional: the active transaction connection
   */
  emitAsync(event: IDomainEvent, transactionClient?: any): Promise<void>;

  /**
   * Emit an event directly to in-process handlers.
   * No persistence — if the app crashes, the event is lost.
   * Only use for non-critical, side-effect-free operations.
   */
  emitDirect(event: IDomainEvent): Promise<void>;
}

/**
 * Base interface for all domain events.
 */
export interface IDomainEvent {
  /** Unique event ID for deduplication */
  eventId: string;

  /** Event type identifier (e.g., 'leave.approved') */
  eventType: string;

  /** Tenant this event belongs to */
  tenantId: string;

  /** When the event occurred (UTC) */
  occurredAt: Date;

  /** ID of the user/system that caused the event */
  triggeredBy: string;

  /** Serializable event payload */
  toPayload(): Record<string, any>;
}
