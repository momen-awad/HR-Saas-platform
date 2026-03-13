import { Controller, Get } from '@nestjs/common';
import { TenantScopedDatabase, TenantScopedDb } from '../database/tenant-scoped.database';
import { TenantContext } from '../common/context/tenant.context';

@Controller({
  path: 'debug',
  version: '1',
})
export class TenantDebugController {

  constructor(
    private readonly tenantDb: TenantScopedDatabase,
  ) {}

  /**
   * Check current tenant inside PostgreSQL session
   */
  @Get('tenant')
  async debugTenant() {

    const tenantId = TenantContext.currentTenantId;

    return this.tenantDb.transaction(async (db: TenantScopedDb) => {

      const result = await db.execute(
        `SELECT current_setting('app.current_tenant') as tenant`
      );

      return {
        tenantFromHeader: tenantId,
        tenantFromDatabase: result.rows[0].tenant,
      };

    });

  }

  /**
   * Test RLS isolation by listing visible tenants
   */
  @Get('tenants')
  async listTenants() {

    return this.tenantDb.transaction(async (db: TenantScopedDb) => {

      const result = await db.execute(
        `SELECT id, name, slug FROM tenants`
      );

      return {
        visibleTenants: result.rows,
        count: result.rows.length,
      };

    });

  }

}
