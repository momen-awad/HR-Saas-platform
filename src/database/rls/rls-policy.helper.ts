// src/database/rls/rls-policy.helper.ts

/**
 * Helper functions to generate RLS policy SQL for new tables.
 *
 * Example usage in a migration:
 *
 *   const sql = generateRlsPolicy('employees');
 *
 * Then execute this SQL in your migration script.
 */

export function generateRlsPolicy(tableName: string): string {
  return `
-- Enable RLS on ${tableName}
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation_${tableName} ON ${tableName}
    FOR ALL
    TO app_user
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
  `.trim();
}

/**
 * For partitioned tables (same policy applies).
 */
export function generateRlsPolicyPartitioned(
  tableName: string,
): string {
  return generateRlsPolicy(tableName);
}

/**
 * Generate verification SQL to inspect all policies.
 */
export function generateRlsVerificationQuery(): string {
  return `
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
  `.trim();
}
