// src/modules/outbox/outbox.module.ts

import { Module, Global } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxCleanupService } from './outbox-cleanup.service';

@Global()
@Module({
  providers: [
    OutboxService,
    OutboxDispatcherService,
    OutboxCleanupService,
  ],
  exports: [OutboxService],
})
export class OutboxModule {}


