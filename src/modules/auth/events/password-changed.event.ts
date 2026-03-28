// src/modules/auth/events/password-changed.event.ts

import { BaseEvent } from '../../../common/events/base.event';
import { DomainEvents } from '../../../common/events/event-registry';

export class PasswordChangedEvent extends BaseEvent {
  constructor(
    tenantId: string,
    public readonly userId: string,
    public readonly changedBy: string,
    public readonly method: 'self_change' | 'reset' | 'admin_reset',
  ) {
    super(DomainEvents.USER_PASSWORD_CHANGED, tenantId, changedBy);
  }

  toPayload(): Record<string, any> {
    return {
      userId: this.userId,
      changedBy: this.changedBy,
      method: this.method,
    };
  }
}