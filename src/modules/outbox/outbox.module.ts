// src/modules/outbox/outbox.module.ts

import { Module, Global, forwardRef } from '@nestjs/common';
import { OutboxService }           from './outbox.service';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxCleanupService }    from './outbox-cleanup.service';
import { IdempotencyService }      from './idempotency.service';
import { EventBusModule }          from '../../common/events/event-bus.module';

/**
 * OutboxModule — يوفر:
 * - OutboxService:        كتابة events للـ outbox
 * - OutboxDispatcherService: polling ومعالجة الـ events
 * - OutboxCleanupService:  تنظيف الـ events القديمة
 * - IdempotencyService:   ضمان معالجة كل إيفنت مرة واحدة لكل handler
 *
 * الـ forwardRef ضروري لكسر الـ circular dependency:
 * EventBusModule ↔ OutboxModule
 *
 * الـ IdempotencyService مـ exported عشان كل الـ business handlers
 * اللي في الموديولات التانية يقدروا يستخدموه.
 */
@Global()
@Module({
  imports: [
    // forwardRef لكسر الـ circular dependency مع EventBusModule
    forwardRef(() => EventBusModule),
  ],
  providers: [
    OutboxService,
    OutboxDispatcherService,
    OutboxCleanupService,
    IdempotencyService,
  ],
  exports: [
    OutboxService,
    IdempotencyService, // الـ handlers في الموديولات التانية محتاجينه
  ],
})
export class OutboxModule {}
