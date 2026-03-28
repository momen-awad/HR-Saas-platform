// src/modules/tenant/events/tenant-suspended.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

export class TenantSuspendedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly reason?: string,
  ) {
    super(DomainEvents.TENANT_SUSPENDED, tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return { reason: this.reason };
  }
}