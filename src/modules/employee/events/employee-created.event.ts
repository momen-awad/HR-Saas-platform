// src/modules/employee/events/employee-created.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

/**
 * Emitted when a new employee profile is created.
 *
 * Subscribers (future modules):
 * - Leave module: Initialize leave balances
 * - Notification module: Send welcome email
 * - Audit module: Log employee creation
 * - RBAC module: Assign default employee role
 */
export class EmployeeCreatedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly employeeId: string,
    public readonly userId: string,
    public readonly employeeNumber: string,
    public readonly departmentId: string | null,
  ) {
    super(DomainEvents.EMPLOYEE_CREATED, tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {
      employeeId: this.employeeId,
      userId: this.userId,
      employeeNumber: this.employeeNumber,
      departmentId: this.departmentId,
    };
  }
}
