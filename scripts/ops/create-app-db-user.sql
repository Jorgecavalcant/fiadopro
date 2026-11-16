-- Run as a PostgreSQL administrator, connected to the fiado_pro database.
-- This creates a least-privilege application role without setting a password.
-- Set its password separately as the operator using createuser or psql's \password.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'fiado_app'
  ) THEN
    CREATE ROLE fiado_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS;
  END IF;
END
$$;

-- Enforce the intended role attributes if fiado_app already existed.
ALTER ROLE fiado_app
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS;

GRANT CONNECT ON DATABASE fiado_pro TO fiado_app;
GRANT USAGE ON SCHEMA public TO fiado_app;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO fiado_app;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO fiado_app;

-- fiado_user remains the migration/maintenance role and creates application objects.
ALTER DEFAULT PRIVILEGES FOR ROLE fiado_user IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fiado_app;

ALTER DEFAULT PRIVILEGES FOR ROLE fiado_user IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO fiado_app;

COMMENT ON ROLE fiado_app IS
  'Application runtime role; set its password separately using createuser or psql \password.';
