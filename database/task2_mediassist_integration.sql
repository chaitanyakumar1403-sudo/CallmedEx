-- ============================================================================
-- CallMedex Task 2 — MediAssist AI Integration Foundation
--
-- Spec: .superpowers/sdd/2026-08-02-mediassist-inbound-integration/
--
-- CallMedex never does OCR, AI report interpretation, or WhatsApp delivery
-- itself — that is MediAssist AI's job, reached only via the signed REST
-- contract in docs/integrations/mediassist-ai/callmedex-integration.openapi.yaml.
--
--   report_jobs                tracks every async report-analysis job
--                               CallMedex hands to MediAssist AI via
--                               POST /report-jobs. `id` IS the report_job_id
--                               CallMedex generates and sends.
--   mediassist_inbound_requests idempotency cache for every inbound call
--                               MediAssist makes back into CallMedex, so a
--                               redelivered callback replays the original
--                               response instead of re-applying side effects.
--
-- Idempotent — safe to re-run. Every new table gets an explicit deny-all
-- policy (lint 0008): the FastAPI backend uses the service key and bypasses
-- RLS.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. REPORT JOBS
--    One row per report handed to MediAssist for OCR + AI interpretation +
--    WhatsApp delivery. booking_id/sample_id/processing_center_id are
--    nullable — not every report job originates from a booking/sample
--    (e.g. a patient-uploaded historical report has none of the three).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS report_jobs (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    booking_id            UUID REFERENCES bookings(id) ON DELETE SET NULL,
    sample_id             UUID REFERENCES samples(id) ON DELETE SET NULL,
    processing_center_id  UUID REFERENCES processing_centers(id) ON DELETE SET NULL,

    source_type TEXT NOT NULL
        CHECK (source_type IN ('lab_report', 'prescription', 'consultation_summary')),
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'delivered', 'failed', 'expired')),
    failure_reason TEXT,

    -- Supabase Storage object path, never a public URL — MediAssist is handed
    -- a signed URL derived from this at request time, not this path itself.
    source_document_path TEXT,

    correlation_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- idx_report_jobs_status is already taken by task1_processing_center_foundation.sql
-- (on report_fetch_jobs.status) — index names share one namespace per schema, so
-- reusing it here would silently no-op instead of indexing this table's column.
CREATE INDEX IF NOT EXISTS idx_report_jobs_patient      ON report_jobs(patient_id);
CREATE INDEX IF NOT EXISTS idx_report_jobs_status_col   ON report_jobs(status);
CREATE INDEX IF NOT EXISTS idx_report_jobs_correlation  ON report_jobs(correlation_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. MEDIASSIST INBOUND IDEMPOTENCY CACHE
--    Keyed on the X-Idempotency-Key header MediAssist sends on every inbound
--    call. A redelivered request with the same key returns the cached
--    response_body/status_code verbatim instead of re-running side effects.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS mediassist_inbound_requests (
    idempotency_key TEXT PRIMARY KEY,
    endpoint        TEXT NOT NULL,
    status_code     INT NOT NULL,
    response_body   JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. AI REPORT ANALYSES — link back to the job that produced it
--    Nullable because rows created before this migration have no job.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE ai_report_analyses ADD COLUMN IF NOT EXISTS report_job_id UUID NULL REFERENCES report_jobs(id);

CREATE INDEX IF NOT EXISTS idx_ai_report_analyses_report_job ON ai_report_analyses(report_job_id);

-- The idempotency cache (mediassist_inbound_requests) already covers
-- same-key redelivery, but two genuinely DIFFERENT idempotency keys
-- referencing the same job could still race past the application-level
-- check-then-insert in report_delivered_callback. UNIQUE at the DB level
-- closes that race. NULL values are unconstrained (multiple rows may have
-- report_job_id IS NULL — legacy rows predating this migration).
ALTER TABLE ai_report_analyses DROP CONSTRAINT IF EXISTS ai_report_analyses_report_job_id_unique;
ALTER TABLE ai_report_analyses ADD CONSTRAINT ai_report_analyses_report_job_id_unique UNIQUE (report_job_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 99. RLS — deny-all by default (lint 0008)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    t TEXT;
    new_tables TEXT[] := ARRAY[
        'report_jobs', 'mediassist_inbound_requests'
    ];
BEGIN
    FOREACH t IN ARRAY new_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Deny all access" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Deny all access" ON public.%I '
            'FOR ALL TO public USING (false) WITH CHECK (false)', t);
    END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
