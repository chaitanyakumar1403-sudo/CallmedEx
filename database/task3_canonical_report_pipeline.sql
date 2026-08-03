-- ============================================================================
-- CallMedex Task 3 — Canonical Report Pipeline Consolidation Migration
--
-- Spec: .superpowers/sdd/2026-08-03-canonical-report-pipeline/
-- Authoritative Architecture: brain/fb316142-4a34-4fa0-abf9-efb502917594/implementation_plan.md
--
-- Consolidates report tracking into ONE canonical report pipeline (`report_jobs`).
-- Staged migration: `report_fetch_jobs` is deprecated, not dropped immediately.
--
-- Idempotent — safe to re-run.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CANONICAL REPORT JOBS ENHANCEMENTS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS connector_type TEXT NOT NULL DEFAULT 'patient_upload';
ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Connector type constraint
ALTER TABLE report_jobs DROP CONSTRAINT IF EXISTS chk_report_jobs_connector_type;
ALTER TABLE report_jobs ADD CONSTRAINT chk_report_jobs_connector_type
    CHECK (connector_type IN ('mocdoc', 'crelio', 'cloudlims', 'future_connector', 'patient_upload', 'manual'));

-- Mandatory processing_center_id for laboratory connectors
ALTER TABLE report_jobs DROP CONSTRAINT IF EXISTS chk_report_jobs_pc_mandatory;
ALTER TABLE report_jobs ADD CONSTRAINT chk_report_jobs_pc_mandatory
    CHECK ((connector_type = 'patient_upload') OR (processing_center_id IS NOT NULL));

-- Indexing for rapid lookup
CREATE INDEX IF NOT EXISTS idx_report_jobs_barcode
    ON report_jobs(barcode) WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_report_jobs_sample
    ON report_jobs(sample_id) WHERE sample_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_report_jobs_pc_status
    ON report_jobs(processing_center_id, status);

CREATE INDEX IF NOT EXISTS idx_report_jobs_patient_idem
    ON report_jobs(patient_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_report_jobs_patient_hash
    ON report_jobs(patient_id, content_hash) WHERE content_hash IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. REPORT VERSIONING ENHANCEMENTS (AI REPORT ANALYSES)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE ai_report_analyses ADD COLUMN IF NOT EXISTS report_version INT NOT NULL DEFAULT 1;
ALTER TABLE ai_report_analyses ADD COLUMN IF NOT EXISTS report_status TEXT NOT NULL DEFAULT 'final';

ALTER TABLE ai_report_analyses DROP CONSTRAINT IF EXISTS chk_ai_report_analyses_status;
ALTER TABLE ai_report_analyses ADD CONSTRAINT chk_ai_report_analyses_status
    CHECK (report_status IN ('preliminary', 'final', 'corrected'));

CREATE INDEX IF NOT EXISTS idx_ai_report_analyses_version
    ON ai_report_analyses(report_job_id, report_version);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. STAGED DEPRECATION OF LEGACY TABLES
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_fetch_jobs') THEN
        COMMENT ON TABLE report_fetch_jobs IS 'DEPRECATED: Legacy report fetch jobs table. Replaced by canonical report_jobs.';
    END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
