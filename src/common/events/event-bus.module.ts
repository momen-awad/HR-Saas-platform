// src/common/events/event-bus.module.ts (UPDATED)

import { Module, Global } from '@nestjs/common';
import { EventEmitter2 } from 'eventemitter2';
import { EventBusService } from './event-bus.service';
import { OutboxModule } from '../../modules/outbox/outbox.module';
import { SampleLogHandler } from './handlers/sample-log.handler';

@Global()
@Module({
  imports: [OutboxModule],
  providers: [
    {
      provide: EventEmitter2,
      useFactory: () => {
        return new EventEmitter2({
          wildcard: true,
          delimiter: '.',
          maxListeners: 20,
          ignoreErrors: false,
          verboseMemoryLeak: true,
        });
      },
    },
    EventBusService,
    // Development-only: log all events
    ...(process.env.NODE_ENV !== 'production'
      ? [SampleLogHandler]
      : []),
  ],
  exports: [EventBusService, EventEmitter2],
})
export class EventBusModule {}


