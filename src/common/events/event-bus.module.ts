// src/common/events/event-bus.module.ts

import { Module, Global, forwardRef } from '@nestjs/common';
import { EventEmitter2 }   from 'eventemitter2';
import { EventBusService } from './event-bus.service';
import { OutboxModule }    from '../../modules/outbox/outbox.module';
import { SampleLogHandler } from './handlers/sample-log.handler';

/**
 * EventBusModule — يوفر:
 * - EventEmitter2:    الـ in-process event emitter
 * - EventBusService:  الـ facade اللي الـ business code بيتكلم معاه
 *
 * مـ @Global() عشان كل الموديولات تقدر تستخدمه من غير ما تعمل import صريح.
 *
 * الـ forwardRef ضروري لكسر الـ circular dependency مع OutboxModule:
 * EventBusModule → OutboxModule (import)
 * OutboxModule   → EventBusModule (import عبر forwardRef)
 * EventBusService → OutboxService (injection)
 * OutboxDispatcherService → EventBusService (injection عبر forwardRef)
 */
@Global()
@Module({
  imports: [
    // forwardRef لكسر الـ circular dependency مع OutboxModule
    forwardRef(() => OutboxModule),
  ],
  providers: [
    // ─── EventEmitter2 Setup ────────────────────────────────────────────────
    {
      provide: EventEmitter2,
      useFactory: () =>
        new EventEmitter2({
          // wildcard: 'leave.*' بيمتش 'leave.approved'
          wildcard: true,
          delimiter: '.',

          // الحد الأقصى للـ listeners على إيفنت واحد (لمنع memory leaks)
          maxListeners: 20,

          // لو الـ maxListeners اتجاوز → log warning
          verboseMemoryLeak: true,

          // مش هنتجاهل الـ errors — هنـ handle them في EventBusService
          ignoreErrors: false,
        }),
    },
    // ─── Services ───────────────────────────────────────────────────────────
    EventBusService,

    // ─── Development Handlers ───────────────────────────────────────────────
    // SampleLogHandler بيـlog كل الـ events — للـ dev فقط
    ...(process.env.NODE_ENV !== 'production' ? [SampleLogHandler] : []),
  ],
  exports: [
    EventBusService,
    EventEmitter2, // exported عشان الـ handlers في الموديولات التانية تقدر تـ subscribe
  ],
})
export class EventBusModule {}
