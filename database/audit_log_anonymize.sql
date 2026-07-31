-- ===========================================================================
-- Audit Log Anonymization Column
-- Required by the fixed cleanup_old_audit_logs task that anonymizes
-- rather than deletes old audit records for NMC compliance.
-- ===========================================================================

ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ DEFAULT NULL;

-- Index for finding non-anonymized old records
CREATE INDEX IF NOT EXISTS idx_audit_log_anonymized
    ON audit_log(anonymized_at, created_at)
    WHERE anonymized_at IS NULL;

COMMENT ON COLUMN audit_log.anonymized_at IS
    'Timestamp when PII was redacted from this record. NULL = not yet anonymized.';