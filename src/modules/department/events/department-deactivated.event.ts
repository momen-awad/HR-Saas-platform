// src/modules/department/events/department-deactivated.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

/**
 * Emitted when a department is deactivated.
 *
 * Subscribers (future):
 * - Audit module: Log deactivation
 */
export class DepartmentDeactivatedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly departmentId: string,
    public readonly departmentName: string,
  ) {
    super(DomainEvents.DEPARTMENT_DEACTIVATED, tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {
      departmentId: this.departmentId,
      departmentName: this.departmentName,
    };
  }
}
