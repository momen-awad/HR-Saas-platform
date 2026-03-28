// src/modules/tenant/services/tenant-onboarding.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 }      from 'eventemitter2';
import { DomainEvents }       from '../../../common/events/event-registry';
import { IdempotencyService } from '../../outbox/idempotency.service';

/**
 * TenantOnboardingService — بيتعامل مع تهيئة الـ tenant الجديد.
 *
 * لما بييجي TenantCreatedEvent، الـ service ده بيعمل:
 * 1. Seed الـ default roles والـ permissions  (Module 2.3 — deferred)
 * 2. إنشاء الـ admin user الأولي             (Module 2.2 — deferred)
 * 3. Seed الـ default policies               (Module 4.1 — deferred)
 * 4. Seed الـ default shift template         (Module 4.2 — deferred)
 *
 * ── لماذا الـ IdempotencyService مهم هنا؟ ──────────────────────────────────
 * الـ outbox pattern بطبيعته at-least-once delivery.
 * يعني لو الـ app crash بعد الـ onboarding وقبل ما الـ event يتعلّم كـ processed،
 * الـ dispatcher هيعيد الـ event → الـ onboarding هيشتغل مرتين.
 * الـ IdempotencyService بيمنع ده بالكامل.
 */
@Injectable()
export class TenantOnboardingService implements OnModuleInit {
  private readonly logger = new Logger(TenantOnboardingService.name);

  // اسم ثابت ومميز لهذا الـ handler — لازم يكون unique في النظام كله
  private readonly HANDLER_NAME = 'TenantOnboardingService';

  constructor(
    private readonly emitter:      EventEmitter2,
    private readonly idempotency:  IdempotencyService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRATION
  // ─────────────────────────────────────────────────────────────────────────

  onModuleInit(): void {
    this.emitter.on(
      DomainEvents.TENANT_CREATED,
      this.handleTenantCreated.bind(this),
    );

    this.logger.log('Tenant onboarding handler registered');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  private async handleTenantCreated(
    payload: Record<string, any>,
  ): Promise<void> {
    const eventId  = payload['eventId']  as string;
    const tenantId = payload['tenantId'] as string;
    const data     = (payload['data'] ?? payload) as Record<string, any>;

    // ── الخطوة 1: تحقق من الـ idempotency ───────────────────────────────────
    // لو الـ event اتعالج قبل كده (crash + retry) → تجاهل بأمان
    const alreadyProcessed = await this.idempotency.isAlreadyProcessed(
      eventId,
      this.HANDLER_NAME,
    );

    if (alreadyProcessed) {
      this.logger.debug(
        `[Onboarding] Skipping duplicate event for tenant [${tenantId}]`,
      );
      return;
    }

    // ── الخطوة 2: تنفيذ الـ onboarding ──────────────────────────────────────
    this.logger.log(
      `Starting onboarding for tenant: ${data['tenantName']} [${tenantId}]`,
    );

    try {
      // Step 1: Seed default roles and permissions
      // TODO: Implement in Module 2.3
      this.logger.debug(
        `[Onboarding] Step 1: Seed roles/permissions — DEFERRED to Module 2.3`,
      );

      // Step 2: Create admin user
      // TODO: Implement in Module 2.2
      this.logger.debug(
        `[Onboarding] Step 2: Create admin user (${data['adminEmail']}) — DEFERRED to Module 2.2`,
      );

      // Step 3: Seed default policies
      // TODO: Implement in Module 4.1
      this.logger.debug(
        `[Onboarding] Step 3: Seed default policies — DEFERRED to Module 4.1`,
      );

      // Step 4: Seed default shift template
      // TODO: Implement in Module 4.2
      this.logger.debug(
        `[Onboarding] Step 4: Seed default shift — DEFERRED to Module 4.2`,
      );

      this.logger.log(
        `Onboarding completed for tenant: ${data['tenantName']} [${tenantId}]`,
      );
    } catch (error) {
      this.logger.error(
        `Onboarding FAILED for tenant [${tenantId}]: ${(error as Error).message}`,
        (error as Error).stack,
      );

      // مش بنـ catch هنا عشان الـ OutboxDispatcher يشوف الـ error
      // ويقرر يعمل retry أو dead_letter
      throw error;
    }

    // ── الخطوة 3: تسجيل المعالجة (idempotency) ──────────────────────────────
    // مهم: خارج الـ try/catch عشان:
    // - لو حصل error في الـ steps → الـ catch عمل throw → لن نصل هنا ✅
    // - لو نجح كل حاجة → نسجّل → مش هيتعالج تاني ✅
    // - لو فشل markAsProcessed نفسه → IdempotencyService بيعمل warn بس
    //   (مش بيرمي error) → الـ outbox يعلّم الـ event كـ processed ✅
    await this.idempotency.markAsProcessed({
      eventId,
      handlerName: this.HANDLER_NAME,
      eventType:   payload['eventType'] as string,
      tenantId,
    });
  }
}
