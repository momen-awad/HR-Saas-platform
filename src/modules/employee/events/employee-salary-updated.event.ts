// src/modules/employee/events/employee-salary-updated.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

/**
 * Emitted when an employee's salary is changed.
 *
 * IMPORTANT: The actual salary amounts are NOT included in the payload.
 * Only the employeeId and changeReason are emitted — downstream handlers
 * must read salary from the encrypted column if they need the value.
 * This prevents sensitive financial data from appearing in the outbox table.
 *
 * Subscribers (future modules):
 * - Audit module: Log that a salary change occurred
 * - Notification module: Notify the employee (no amounts in notification)
 */
export class EmployeeSalaryUpdatedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly employeeId: string,
    public readonly changeReason: string,
    public readonly effectiveDate: string,
  ) {
    super(DomainEvents.EMPLOYEE_SALARY_UPDATED, tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {
      employeeId: this.employeeId,
      changeReason: this.changeReason,
      effectiveDate: this.effectiveDate,
      // Salary amounts deliberately excluded — sensitive data must not
      // be stored in the outbox payload in plaintext.
    };
  }
}
