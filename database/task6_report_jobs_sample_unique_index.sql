-- ============================================================================
-- Migration: task6_report_jobs_sample_unique_index.sql
-- Description: Partial Unique Index on report_jobs(sample_id) for active jobs
-- Date: 2026-08-03
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION 1: PRE-MIGRATION VALIDATION CHECK
-- Verifies that no duplicate active ReportJobs exist per sample_id prior to migration.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count
    FROM (
        SELECT sample_id
        FROM report_jobs
        WHERE sample_id IS NOT NULL AND status != 'failed'
        GROUP BY sample_id
        HAVING COUNT(*) > 1
    ) dups;

    IF dup_count > 0 THEN
        RAISE EXCEPTION 'PRE-MIGRATION FAILURE: Found % sample_id(s) with duplicate active report_jobs. Manual resolution required before applying unique index.', dup_count;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- SECTION 2: MIGRATION STATEMENT
-- Creates partial unique index ensuring at most one active ReportJob per sample_id.
-- ----------------------------------------------------------------------------
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_jobs_sample_id_active_unique
    ON report_jobs(sample_id)
    WHERE sample_id IS NOT NULL AND status != 'failed';

COMMIT;

-- ----------------------------------------------------------------------------
-- SECTION 3: POST-MIGRATION VALIDATION CHECK
-- Confirms that the unique index exists and reloads schema cache.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_report_jobs_sample_id_active_unique'
    ) THEN
        RAISE EXCEPTION 'POST-MIGRATION FAILURE: Unique index idx_report_jobs_sample_id_active_unique was not found.';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- SECTION 4: ROLLBACK INSTRUCTIONS
-- To safely roll back this migration, execute the following SQL:
--
-- BEGIN;
-- DROP INDEX IF EXISTS idx_report_jobs_sample_id_active_unique;
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
-- ----------------------------------------------------------------------------
