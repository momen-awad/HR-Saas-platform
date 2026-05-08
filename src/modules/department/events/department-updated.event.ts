// src/modules/department/events/department-updated.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

/**
 * Emitted when a department's metadata is updated.
 *
 * Subscribers (future):
 * - Audit module: Log department update
 */
export class DepartmentUpdatedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly departmentId: string,
    public readonly changes: Record<string, any>,
  ) {
    super(DomainEvents.DEPARTMENT_UPDATED, tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {
      departmentId: this.departmentId,
      changes: this.changes,
    };
  }
}
