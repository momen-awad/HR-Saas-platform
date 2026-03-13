import { sql, SQL } from 'drizzle-orm';
import { TenantContext } from '../context/tenant.context';

/**
 * Returns a SQL condition fragment:
 * tenant_id = current tenant
 */
export function tenantFilter(table: { tenantId: any }): SQL {
  const tenantId = TenantContext.currentTenantId;

  return sql`${table.tenantId} = ${tenantId}`;
}

/**
 * Returns the current tenant ID.
 * Used when inserting rows.
 */
export function currentTenantId(): string {
  return TenantContext.currentTenantId;
}

/**
 * Combine tenant filter with additional conditions.
 */
export function withTenantScope(
  table: { tenantId: any },
  ...additionalConditions: (SQL | undefined)[]
): SQL {
  const conditions = [
    tenantFilter(table),
    ...additionalConditions.filter(Boolean),
  ];

  if (conditions.length === 1) {
    return conditions[0]!;
  }

  return sql.join(conditions, sql` AND `);
}
