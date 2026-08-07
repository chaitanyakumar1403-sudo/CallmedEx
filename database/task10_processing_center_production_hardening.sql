-- ============================================================================
-- CallMedex Task 10 — Processing Center & ReportJob Production Hardening Migration
--
-- Authoritative Architecture: CallMedex Processing Center Workflow Engine
-- Idempotent — safe to re-run.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. REPORT JOBS STATUS CONSTRAINT & RETRY HARDENING
-- ═══════════════════════════════════════════════════════════════════════════

-- Expanded status constraint supporting all 10 FSM states
ALTER TABLE report_jobs DROP CONSTRAINT IF EXISTS chk_report_jobs_status;
ALTER TABLE report_jobs ADD CONSTRAINT chk_report_jobs_status
    CHECK (status IN (
        'queued', 'submitted', 'accepted', 'processing',
        'delivered', 'corrected', 'failed', 'expired',
        'retry', 'dead_letter'
    ));

-- Exponential backoff and retry tracking columns
ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 3;
ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS dead_letter BOOLEAN NOT NULL DEFAULT FALSE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. REPORT VERSIONING & AUDIT TRAIL HARDENING
-- ═══════════════════════════════════════════════════════════════════════════

-- Ensure columns exist for versioning on ai_report_analyses
ALTER TABLE ai_report_analyses ADD COLUMN IF NOT EXISTS report_version INT NOT NULL DEFAULT 1;
ALTER TABLE ai_report_analyses ADD COLUMN IF NOT EXISTS report_status TEXT NOT NULL DEFAULT 'final';

ALTER TABLE ai_report_analyses DROP CONSTRAINT IF EXISTS chk_ai_report_analyses_status;
ALTER TABLE ai_report_analyses ADD CONSTRAINT chk_ai_report_analyses_status
    CHECK (report_status IN ('preliminary', 'final', 'corrected'));

-- Unique index to enforce exactly one row per version per report_job_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_report_analyses_job_version
    ON ai_report_analyses(report_job_id, report_version);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PERFORMANCE & DASHBOARD INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

-- Retry queue processing index
CREATE INDEX IF NOT EXISTS idx_report_jobs_retry_queue
    ON report_jobs(status, next_retry_at)
    WHERE status IN ('failed', 'retry') AND dead_letter = FALSE;

-- Processing Center dashboard query index
CREATE INDEX IF NOT EXISTS idx_report_jobs_pc_status_created
    ON report_jobs(processing_center_id, status, created_at);

COMMIT;

NOTIFY pgrst, 'reload schema';
