// src/modules/tenant/tenant.module.ts

import { Module }                    from '@nestjs/common';
import { TenantController }          from './controllers/tenant.controller';
import { TenantSettingsController }  from './controllers/tenant-settings.controller';
import { TenantService }             from './services/tenant.service';
import { TenantSettingsService }     from './services/tenant-settings.service';
import { TenantOnboardingService }   from './services/tenant-onboarding.service';
import { TenantRepository }          from './repositories/tenant.repository';
import { TenantFacade }              from './facades/tenant.facade';
import { OutboxModule }              from '../outbox/outbox.module';

/**
 * TenantModule — يوفر كل حاجة خاصة بالـ tenant management.
 *
 * الـ OutboxModule مـ imported عشان:
 * - TenantOnboardingService محتاج IdempotencyService
 * - IdempotencyService exported من OutboxModule
 *
 * الـ TenantFacade مـ exported عشان:
 * - الموديولات التانية (Attendance, Leave, Payroll) تقدر تجيب
 *   بيانات الـ tenant من غير ما تعمل import مباشر للـ TenantRepository
 */
@Module({
  imports: [
    OutboxModule, // ← للـ IdempotencyService في TenantOnboardingService
  ],
  controllers: [
    TenantController,
    TenantSettingsController,
  ],
  providers: [
    TenantService,
    TenantSettingsService,
    TenantOnboardingService,
    TenantRepository,
    TenantFacade,
  ],
  exports: [
    TenantFacade, // ← الـ public API للموديولات التانية
  ],
})
export class TenantModule {}
