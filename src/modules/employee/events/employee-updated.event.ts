// src/modules/employee/events/employee-updated.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

/**
 * Emitted when an employee's profile fields are updated
 * (name, department, position, timezone, etc.).
 * Does NOT cover status changes or salary changes — those have dedicated events.
 */
export class EmployeeUpdatedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly employeeId: string,
    public readonly changes: Record<string, { from: unknown; to: unknown }>,
  ) {
    super(DomainEvents.EMPLOYEE_UPDATED, tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {
      employeeId: this.employeeId,
      changes: this.changes,
    };
  }
}
