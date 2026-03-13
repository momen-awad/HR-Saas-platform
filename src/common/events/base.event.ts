// src/common/events/base.event.ts

import { randomUUID } from 'crypto';
import { IDomainEvent } from './interfaces/event-bus.interface';

/**
 * Base class for all domain events in the system.
 *
 * Every event carries:
 * - eventId: unique identifier for deduplication
 * - eventType: dot-notation type string (e.g., 'attendance.checkin_recorded')
 * - tenantId: which tenant this event belongs to
 * - occurredAt: when the event happened (UTC)
 * - triggeredBy: who caused the event (userId or 'system')
 *
 * Subclasses add domain-specific data and implement toPayload().
 *
 * Usage:
 *   export class LeaveApprovedEvent extends BaseEvent {
 *     constructor(
 *       tenantId: string,
 *       triggeredBy: string,
 *       public readonly leaveRequestId: string,
 *       public readonly employeeId: string,
 *       public readonly approvedBy: string,
 *     ) {
 *       super('leave.approved', tenantId, triggeredBy);
 *     }
 *
 *     toPayload() {
 *       return {
 *         leaveRequestId: this.leaveRequestId,
 *         employeeId: this.employeeId,
 *         approvedBy: this.approvedBy,
 *       };
 *     }
 *   }
 */
export abstract class BaseEvent implements IDomainEvent {
  public readonly eventId: string;
  public readonly occurredAt: Date;

  protected constructor(
    public readonly eventType: string,
    public readonly tenantId: string,
    public readonly triggeredBy: string,
  ) {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
  }

  /**
   * Serialize the event-specific data for storage in the outbox.
   * Must return a plain JSON-serializable object.
   * Do NOT include sensitive data (salaries, bank accounts) — use IDs instead.
   */
  abstract toPayload(): Record<string, any>;

  /**
   * Full serialization including envelope metadata.
   * This is what gets stored in the outbox table.
   */
  toFullPayload(): Record<string, any> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      tenantId: this.tenantId,
      triggeredBy: this.triggeredBy,
      occurredAt: this.occurredAt.toISOString(),
      data: this.toPayload(),
    };
  }
}
