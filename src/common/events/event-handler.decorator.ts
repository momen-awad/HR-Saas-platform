import { SetMetadata } from '@nestjs/common';

export const EVENT_HANDLER_METADATA = 'EVENT_HANDLER_METADATA';

export function OnDomainEvent(eventType: string): MethodDecorator {
  return SetMetadata(EVENT_HANDLER_METADATA, { eventType });
}
