-- ============================================================================
-- Migration: task7_schema_migrations_tracking.sql
-- Description: Introduces a schema_migrations ledger so future migrations
--              are recorded (filename + applied_at + notes) instead of
--              relying on tribal knowledge of which of the database/*.sql
--              files have run against a given environment.
--
-- NOTE: This migration does NOT backfill history for the 39 pre-existing
-- SQL files in database/. Their real apply order/timestamps per environment
-- are not reliably knowable from the repo alone, and fabricating them would
-- make the ledger actively misleading. Going forward, every new migration
-- should INSERT its own row (see usage note below) as part of applying it.
-- Date: 2026-08-03
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: MIGRATION STATEMENT
-- ----------------------------------------------------------------------------
BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by  TEXT,
    notes       TEXT
);

COMMIT;

-- ----------------------------------------------------------------------------
-- SECTION 2: POST-MIGRATION VALIDATION CHECK
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'schema_migrations'
    ) THEN
        RAISE EXCEPTION 'POST-MIGRATION FAILURE: schema_migrations table was not created.';
    END IF;
END $$;

-- Record this migration itself, going forward.
INSERT INTO schema_migrations (filename, applied_by, notes)
VALUES ('task7_schema_migrations_tracking.sql', current_user, 'Introduces the migration ledger')
ON CONFLICT (filename) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- SECTION 3: USAGE — every migration applied after this one should end with:
--
-- INSERT INTO schema_migrations (filename, applied_by, notes)
-- VALUES ('<filename>.sql', current_user, '<one-line summary>')
-- ON CONFLICT (filename) DO NOTHING;
--
-- Before applying a migration, check it hasn't already run:
-- SELECT 1 FROM schema_migrations WHERE filename = '<filename>.sql';
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- SECTION 4: ROLLBACK INSTRUCTIONS
-- BEGIN;
-- DROP TABLE IF EXISTS schema_migrations;
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
-- ----------------------------------------------------------------------------
