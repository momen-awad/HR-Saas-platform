// src/modules/tenant/events/tenant-created.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

/**
 * Emitted when a new tenant is created.
 *
 * Subscribers:
 * - Onboarding service: Seed default roles, permissions, policies
 * - Audit module: Log tenant creation
 */
export class TenantCreatedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly tenantName: string,
    public readonly tenantSlug: string,
    public readonly planType: string,
    public readonly adminEmail: string,
    public readonly adminFirstName: string,
    public readonly adminLastName: string,
  ) {
    super(DomainEvents.TENANT_CREATED, tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {
      tenantName: this.tenantName,
      tenantSlug: this.tenantSlug,
      planType: this.planType,
      adminEmail: this.adminEmail,
      adminFirstName: this.adminFirstName,
      adminLastName: this.adminLastName,
    };
  }
}