// src/modules/auth/events/login-failed.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

export class LoginFailedEvent extends BaseEvent {
  constructor(
    public readonly email: string,
    public readonly userId: string | null,
    public readonly ipAddress: string,
    public readonly reason: string,
  ) {
    // No tenant context for failed logins (may not know the tenant)
    super(DomainEvents.USER_LOGIN_FAILED, '', 'system');
  }

  toPayload(): Record<string, any> {
    return {
      email: this.email,
      userId: this.userId,
      ipAddress: this.ipAddress,
      reason: this.reason,
    };
  }
}