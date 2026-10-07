-- ═══════════════════════════════════════════════════════════════════════════
-- task15 — keep every version of a lab report's AI analysis
-- ═══════════════════════════════════════════════════════════════════════════
--
-- task2 added UNIQUE (report_job_id): one analysis row per report. task3 and
-- task10 then introduced report_version / report_status and a unique index on
-- (report_job_id, report_version), i.e. one row PER VERSION — but never dropped
-- the task2 constraint. The report-delivered callback worked around it by
-- overwriting the row, so a corrected report destroyed the original the
-- patient and doctor had already been sent.
--
-- The callback now inserts a new row per version (mediassist_inbound.py).
-- Uniqueness per (report_job_id, report_version) still closes the duplicate
-- delivery race the task2 constraint was added for.
--
-- Idempotent; safe to re-run.

ALTER TABLE ai_report_analyses
    DROP CONSTRAINT IF EXISTS ai_report_analyses_report_job_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_report_analyses_job_version
    ON ai_report_analyses (report_job_id, report_version);
