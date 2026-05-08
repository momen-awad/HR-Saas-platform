// src/modules/department/events/department-created.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

/**
 * Emitted when a new department is created within a tenant.
 *
 * Subscribers (future):
 * - Audit module: Log department creation
 */
export class DepartmentCreatedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly departmentId: string,
    public readonly departmentName: string,
    public readonly parentId: string | null,
  ) {
    super(DomainEvents.DEPARTMENT_CREATED, tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {
      departmentId: this.departmentId,
      departmentName: this.departmentName,
      parentId: this.parentId,
    };
  }
}
