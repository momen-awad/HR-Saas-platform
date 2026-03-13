// src/common/events/handlers/sample-log.handler.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from 'eventemitter2';
import { DomainEvents } from '../event-registry';

/**
 * Sample event handler that logs all events.
 * This demonstrates the handler pattern.
 *
 * In production, this would be replaced by the Audit module handler.
 * Kept here as a reference template and for development debugging.
 *
 * Remove or disable in production.
 */
@Injectable()
export class SampleLogHandler implements OnModuleInit {
  private readonly logger = new Logger(SampleLogHandler.name);

  constructor(private readonly emitter: EventEmitter2) {}

  onModuleInit() {
    // Register for ALL events using wildcard
    this.emitter.on('**', this.handleAnyEvent.bind(this));

    this.logger.log('Sample log handler registered for all events (wildcard)');
  }

  private async handleAnyEvent(payload: any): Promise<void> {
    // this.event contains the event name when using wildcard
    const eventType = (this as any).event || 'unknown';
    this.logger.debug(
      `[EVENT] ${eventType}: ${JSON.stringify(payload).substring(0, 200)}`,
    );
  }
}

