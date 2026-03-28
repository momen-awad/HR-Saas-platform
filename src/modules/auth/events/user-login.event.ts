// src/modules/auth/events/user-login.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

export class UserLoginEvent extends BaseEvent {
  constructor(
    tenantId: string,
    public readonly userId: string,
    public readonly employeeId: string,
    public readonly ipAddress: string,
    public readonly userAgent: string,
  ) {
    super(DomainEvents.USER_LOGIN, tenantId, userId);
  }

  toPayload(): Record<string, any> {
    return {
      userId: this.userId,
      employeeId: this.employeeId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
    };
  }
}