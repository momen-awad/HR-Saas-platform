// src/modules/outbox/idempotency.service.ts

import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, lte } from 'drizzle-orm';
import { INJECTION_TOKENS } from '../../common/constants/injection-tokens';
import type { DrizzleDatabase }   from '../../database/database.providers';
import {
  outboxProcessedEvents,
  NewOutboxProcessedEvent,
} from '../../database/schema/event-outbox';

/**
 * IdempotencyService — يضمن إن كل handler بيشتغل على إيفنت معين مرة واحدة بس.
 *
 * الـ pattern المتبع:
 *   1. قبل معالجة الإيفنت، الـ handler بيسأل: "اشتغلت قبل كده على الإيفنت ده؟"
 *   2. لو آه → يرجع بدون ما يعمل حاجة (idempotent skip)
 *   3. لو لأ → يشتغل، وبعد الانتهاء يسجّل إنه اشتغل
 *
 * الـ unique constraint في الـ database هو الضمان الحقيقي —
 * مش الـ application-level check — عشان لو حصل race condition
 * بين podين، الـ database هترفض الـ insert الثاني.
 *
 * استخدام:
 *
 *   @Injectable()
 *   export class LeaveApprovedHandler implements OnModuleInit {
 *     constructor(
 *       private readonly emitter:      EventEmitter2,
 *       private readonly idempotency:  IdempotencyService,
 *       private readonly leaveService: LeaveService,
 *     ) {}
 *
 *     onModuleInit() {
 *       this.emitter.on('leave.approved', this.handle.bind(this));
 *     }
 *
 *     async handle(payload: any) {
 *       const HANDLER_NAME = 'LeaveApprovedHandler';
 *
 *       if (await this.idempotency.isAlreadyProcessed(payload.eventId, HANDLER_NAME)) {
 *         return; // تم المعالجة من قبل — تجاهل بأمان
 *       }
 *
 *       await this.leaveService.debitLeaveBalance(
 *         payload.data.employeeId,
 *         payload.data.leaveRequestId,
 *         payload.data.totalDays,
 *       );
 *
 *       await this.idempotency.markAsProcessed({
 *         eventId:     payload.eventId,
 *         handlerName: HANDLER_NAME,
 *         eventType:   payload.eventType,
 *         tenantId:    payload.tenantId,
 *       });
 *     }
 *   }
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * بيتحقق إذا كان الـ handler ده سبق معالجة الإيفنت ده.
   *
   * @param eventId     - الـ UUID الخاص بالإيفنت (من payload.eventId)
   * @param handlerName - اسم الـ handler (مثال: 'LeaveApprovedHandler')
   * @returns true لو الإيفنت اتعالج قبل كده، false لو لأ
   */
  async isAlreadyProcessed(
    eventId: string,
    handlerName: string,
  ): Promise<boolean> {
    try {
      const existing = await this.db
        .select({ id: outboxProcessedEvents.id })
        .from(outboxProcessedEvents)
        .where(
          and(
            eq(outboxProcessedEvents.eventId, eventId),
            eq(outboxProcessedEvents.handlerName, handlerName),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        this.logger.debug(
          `[Idempotency] Skipping duplicate: handler=${handlerName} eventId=${eventId}`,
        );
        return true;
      }

      return false;
    } catch (error) {
      // لو فيه error في الـ check، نفضّل المعالجة على الـ skip
      // الـ unique constraint هيحمينا من الـ duplicate في أسوأ الأحوال
      this.logger.error(
        `Idempotency check failed for [${handlerName}] event [${eventId}]: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /**
   * بيسجّل إن الـ handler ده خلّص معالجة الإيفنت ده.
   *
   * بيستخدم onConflictDoNothing عشان:
   * - لو حصل race condition بين podين → الـ database يحل المشكلة بهدوء
   * - الـ business operation اتعملت بالفعل → مش محتاجين نرمي error
   *
   * @param data - بيانات المعالجة
   */
  async markAsProcessed(data: {
    eventId:     string;
    handlerName: string;
    eventType?:  string;
    tenantId?:   string | null;
  }): Promise<void> {
    try {
      const record: NewOutboxProcessedEvent = {
        eventId:     data.eventId,
        handlerName: data.handlerName,
        eventType:   data.eventType ?? null,
        tenantId:    data.tenantId  ?? null,
      };

      await this.db
        .insert(outboxProcessedEvents)
        .values(record)
        .onConflictDoNothing();
    } catch (error) {
      // مش هنرمي error هنا — الـ business logic خلصت بنجاح
      // الأهم إن الـ operation نفسها اتعملت
      this.logger.warn(
        `Failed to mark event as processed [${data.handlerName}] [${data.eventId}]: ${(error as Error).message}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLEANUP (بيتستدعى من OutboxCleanupService)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * بيمسح الـ idempotency records القديمة عشان الجدول ما يكبرش.
   *
   * @param olderThanDays - احتفظ بالـ records للـ X يوم الأخيرين فقط (default: 30)
   * @returns عدد الـ records اللي اتمسحت
   */
  async cleanupOldRecords(olderThanDays = 30): Promise<number> {
    const cutoff = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
    );

    const deleted = await this.db
      .delete(outboxProcessedEvents)
      .where(lte(outboxProcessedEvents.processedAt, cutoff))
      .returning({ id: outboxProcessedEvents.id });

    return deleted.length;
  }
}
