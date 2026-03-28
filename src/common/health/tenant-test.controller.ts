import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { INJECTION_TOKENS } from '../constants/injection-tokens';
import type { DrizzleDatabase } from '../../database/database.providers';
import { tenants } from '../../database/schema/tenants';
import { TenantId } from '../decorators/tenant-id.decorator';
import { CurrentTenant } from '../decorators/tenant.decorator';
import type { RequestTenant } from '../decorators/tenant.decorator';
import { TenantContext } from '../context/tenant.context';
import { RequestContext } from '../context/request.context';
import { createSuccessResponse } from '../types/api-response.types';
import { Public } from '../../modules/auth/decorators/public.decorator';

@Public()
@Controller('debug/tenant')
export class TenantTestController {
  private readonly logger = new Logger(TenantTestController.name);

  constructor(
    @Inject(INJECTION_TOKENS.DRIZZLE)
    private readonly db: DrizzleDatabase,
  ) {}

  @Get('context')
  async getContext(@TenantId() tenantId: string, @CurrentTenant() tenant: RequestTenant) {
    const contextTenantId = TenantContext.currentTenantId;
    const requestId = RequestContext.requestId;

    this.logger.debug(
      `Tenant context test: decorator=${tenantId}, ` +
      `asyncLocal=${contextTenantId}, requestId=${requestId}`,
    );

    return createSuccessResponse({
      fromDecorator: tenantId,
      fromAsyncLocalStorage: contextTenantId,
      tenantInfo: tenant,
      requestId,
      match: tenantId === contextTenantId,
    });
  }

  @Get('tenants')
  async getAllTenants() {
    const result = await this.db.select().from(tenants);
    return createSuccessResponse(result);
  }
}
