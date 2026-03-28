// src/modules/tenant/events/tenant-activated.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

export class TenantActivatedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
  ) {
    super(DomainEvents.TENANT_ACTIVATED, tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {};
  }
}