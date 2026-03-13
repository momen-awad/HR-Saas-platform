-- ============================================================
-- 0001_enable_rls.sql
-- Multi-Tenant RLS Foundation
-- ============================================================

-- ------------------------------------------------------------
-- Step 1: Create application role
-- ------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_roles WHERE rolname = 'app_user'
    ) THEN
        CREATE ROLE app_user LOGIN;
    END IF;
END
$$;

-- ------------------------------------------------------------
-- Step 2: Secure schema access
-- ------------------------------------------------------------

REVOKE ALL ON SCHEMA public FROM PUBLIC;

GRANT CONNECT ON DATABASE hr_saas_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- ------------------------------------------------------------
-- Step 3: Table privileges
-- ------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO app_user;

GRANT USAGE
ON ALL SEQUENCES IN SCHEMA public
TO app_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES
IN SCHEMA public
GRANT USAGE ON SEQUENCES TO app_user;

-- ------------------------------------------------------------
-- Step 4: Default tenant context
-- ------------------------------------------------------------

ALTER DATABASE hr_saas_db
SET app.current_tenant =
'00000000-0000-0000-0000-000000000000';

-- ------------------------------------------------------------
-- Step 5: RLS template for tenant tables
-- ------------------------------------------------------------

-- Example:

-- ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE employees FORCE ROW LEVEL SECURITY;

-- CREATE POLICY tenant_isolation_employees
-- ON employees
-- FOR ALL
-- TO app_user
-- USING (
--   tenant_id =
--   current_setting('app.current_tenant', true)::uuid
-- )
-- WITH CHECK (
--   tenant_id =
--   current_setting('app.current_tenant', true)::uuid
-- );

-- ------------------------------------------------------------
-- Step 6: Verification
-- ------------------------------------------------------------

SELECT
  'RLS foundation configured successfully' AS status;
