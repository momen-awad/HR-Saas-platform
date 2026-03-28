// src/common/events/handlers/sample-log.handler.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from 'eventemitter2';

/**
 * SampleLogHandler — بيـlog كل الـ domain events اللي بتعدي من الـ bus.
 *
 * للـ development بس — مش بيشتغل في production.
 * ده بيساعد في:
 * - متابعة الـ events اللي بتتبعت
 * - التأكد إن الـ dispatcher بيشتغل صح
 * - الـ debugging في أي مرحلة من مراحل التطوير
 *
 * الإصلاح من الـ original:
 * - استبدلنا `this.emitter.on('**', ...)` بـ `this.emitter.onAny(...)`
 * - الـ onAny بيدي اسم الإيفنت كـ parameter صريح في الـ callback
 * - الـ wildcard كان بيعتمد على `(this as any).event` اللي ممكن يكون undefined
 *   لو الـ context اتغيّر (مثلاً مع .bind() أو arrow functions)
 */
@Injectable()
export class SampleLogHandler implements OnModuleInit {
  private readonly logger = new Logger(SampleLogHandler.name);

  constructor(private readonly emitter: EventEmitter2) {}

  onModuleInit(): void {
    // onAny بيدي اسم الإيفنت كـ parameter أول — أكثر أمانًا من الـ wildcard
    this.emitter.onAny((eventType: string | string[], payload: unknown) => {
      const type    = Array.isArray(eventType) ? eventType.join('.') : eventType;
      const preview = JSON.stringify(payload)?.substring(0, 200) ?? '{}';

      this.logger.debug(`[EVENT] ${type}: ${preview}`);
    });

    this.logger.log('Sample log handler registered for all events (onAny)');
  }
}
