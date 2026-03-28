// src/modules/rbac/events/role-assigned.event.ts

import { BaseEvent } from '../../../common/events/base.event';

export class RoleAssignedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    triggeredBy: string,
    public readonly employeeId: string,
    public readonly roleIds: string[],
    public readonly roleNames: string[],
  ) {
    super('rbac.role_assigned', tenantId, triggeredBy);
  }

  toPayload(): Record<string, any> {
    return {
      employeeId: this.employeeId,
      roleIds: this.roleIds,
      roleNames: this.roleNames,
    };
  }
}