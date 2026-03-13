import { Controller, Get, Logger, InternalServerErrorException } from '@nestjs/common';
import { TenantContext } from './common/context/tenant.context'; // تأكد من المسارات عندك
import { Inject } from '@nestjs/common';
import { INJECTION_TOKENS } from './common/constants/injection-tokens';
import type { DrizzleDatabase } from './database/database.providers';
import { tenants } from './database/schema';

@Controller('test-tenant')
export class TestTenantController {
  private readonly logger = new Logger(TestTenantController.name);

  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * 1. اختبار الـ Context
   * بيعرفنا هل الميدل وير قدر يقرأ الـ Header ويخزنه في الـ AsyncLocalStorage صح ولا لأ
   */
  @Get('whoami')
  whoAmI() {
    const tenantId = TenantContext.currentTenantId;
    const status = TenantContext.getTenantStatus(); // استخدمنا الميثود اللي اشتغلت معاك

    this.logger.log(`[CHECK] Identity check for Tenant: ${tenantId}`);

    return {
      success: true,
      message: 'Context is isolated and working!',
      contextData: {
        tenantId,
        status,
      },
    };
  }

  /**
   * 2. اختبار الـ RLS (Data Isolation)
   * الاختبار ده هدفه التأكد إن الداتابيز بتمنع تسريب البيانات.
   * لو الـ RLS شغال، الـ Select * هترجع صف واحد فقط (بتاع الشركة اللي في الـ Header)
   */
  @Get('test-leak')
  async testLeak() {
    try {
      this.logger.warn(`[SECURITY] Tenant ${TenantContext.currentTenantId} is attempting to fetch all tenants...`);

      // محاولة جلب "كل" الشركات من الداتابيز
      // ملاحظة: الـ RLS هو اللي هيفلتر النتيجة دي في "قلب" الـ Postgres
      const allVisibleTenants = await this.db.select().from(tenants);

      return {
        success: true,
        description: 'RLS Leak Test Execution',
        results: {
          databaseTotalRowsInQuery: allVisibleTenants.length,
          visibleTenantIds: allVisibleTenants.map((t) => t.id),
        },
        verdict: allVisibleTenants.length === 1 
          ? 'SUCCESS: Isolation is solid. No data leak.' 
          : 'WARNING: Data leak detected! Check RLS Policies.',
      };
    } catch (error) {
      this.logger.error(`Leak test failed: ${error.message}`);
      throw new InternalServerErrorException('Error executing leak test');
    }
  }
}
