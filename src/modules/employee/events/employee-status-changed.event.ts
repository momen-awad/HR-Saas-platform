// src/modules/employee/events/employee-status-changed.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

/**
 * Emitted when an employee's status changes.
 *
 * Subscribers (future modules):
 * - Department module: Clear manager assignment on suspension/termination
 * - Leave module: Cancel pending leave requests on termination
 * - Payroll module: Trigger settlement on termination
 * - Notification module: Notify relevant parties
 * - Auth module: Revoke tokens on suspension/termination
 */
export class EmployeeStatusChangedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly employeeId: string,
    public readonly previousStatus: string,
    public readonly newStatus: string,
    public readonly reason: string | null,
    public readonly terminationDate: string | null,
  ) {
    super(DomainEvents.EMPLOYEE_STATUS_CHANGED, tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {
      employeeId: this.employeeId,
      previousStatus: this.previousStatus,
      newStatus: this.newStatus,
      reason: this.reason,
      terminationDate: this.terminationDate,
    };
  }
}
