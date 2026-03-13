// src/common/events/domain-events/leave-approved.event.ts

import { BaseEvent } from '../base.event';
import { DomainEvents } from '../event-registry';

/**
 * Emitted when a leave request is approved.
 *
 * Subscribers:
 * - Leave module: Debit leave balance (sync handler)
 * - Notification module: Notify the employee
 * - Audit module: Log the approval
 */
export class LeaveApprovedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly leaveRequestId: string,
    public readonly employeeId: string,
    public readonly leaveTypeId: string,
    public readonly totalDays: number,
    public readonly startDate: string,
    public readonly endDate: string,
  ) {
    super(DomainEvents.LEAVE_APPROVED, tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {
      leaveRequestId: this.leaveRequestId,
      employeeId: this.employeeId,
      leaveTypeId: this.leaveTypeId,
      totalDays: this.totalDays,
      startDate: this.startDate,
      endDate: this.endDate,
    };
  }
}
