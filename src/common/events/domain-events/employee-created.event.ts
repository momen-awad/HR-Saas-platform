// src/common/events/domain-events/employee-created.event.ts

import { BaseEvent } from '../base.event';
import { DomainEvents } from '../event-registry';

/**
 * Emitted when a new employee is created within a tenant.
 *
 * Subscribers:
 * - Leave module: Initialize leave balances for the new employee
 * - Notification module: Send welcome email
 * - Audit module: Log employee creation
 */
export class EmployeeCreatedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly employeeId: string,
    public readonly employeeNumber: string,
    public readonly departmentId: string | null,
  ) {
    super(DomainEvents.EMPLOYEE_CREATED, tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {
      employeeId: this.employeeId,
      employeeNumber: this.employeeNumber,
      departmentId: this.departmentId,
    };
  }
}


