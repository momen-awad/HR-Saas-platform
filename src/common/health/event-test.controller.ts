import { Controller, Post, Logger } from '@nestjs/common';
import { TenantId } from '../decorators/tenant-id.decorator';
import { EventBusService } from '../events/event-bus.service';
import { EmployeeCreatedEvent } from '../events/domain-events';
import { createSuccessResponse } from '../types/api-response.types';

@Controller({
  path: 'debug/events',
  version: '1',
})
export class EventTestController {
  private readonly logger = new Logger(EventTestController.name);

  constructor(private readonly eventBus: EventBusService) {}

  @Post('test-emit')
  async testEmit(@TenantId() tenantId: string) {
    const event = new EmployeeCreatedEvent(
      tenantId,
      'system',
      'emp-test-123',
      'EMP001',
      null,
    );

    await this.eventBus.emitAsync(event);

    this.logger.log(`Test event emitted: ${event.eventId}`);

    return createSuccessResponse({
      message: 'Event emitted via outbox',
      eventId: event.eventId,
      eventType: event.eventType,
      note: 'Check logs for dispatcher processing within ~2 seconds',
    });
  }

  @Post('test-direct')
  async testDirect(@TenantId() tenantId: string) {
    const event = new EmployeeCreatedEvent(
      tenantId,
      'system',
      'emp-test-456',
      'EMP002',
      null,
    );

    await this.eventBus.emitDirect(event);

    return createSuccessResponse({
      message: 'Event emitted directly (non-persistent)',
      eventId: event.eventId,
      eventType: event.eventType,
    });
  }
}
