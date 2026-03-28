// src/modules/rbac/events/role-created.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

export class RoleCreatedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly roleId: string,
    public readonly roleName: string,
    public readonly roleSlug: string,
    public readonly isSystem: boolean,
  ) {
    super('rbac.role_created', tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {
      roleId: this.roleId,
      roleName: this.roleName,
      roleSlug: this.roleSlug,
      isSystem: this.isSystem,
    };
  }
}