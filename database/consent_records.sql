-- ===========================================================================
-- DPDP Act 2023 — Consent Records Table
-- Immutable audit trail for all consent actions (grant, revoke, deny).
-- Required for DPDP Stage 2 compliance (Nov 2026 deadline).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL,       -- e.g., 'data_processing', 'marketing', 'health_record_sharing'
    consent_given BOOLEAN NOT NULL,   -- TRUE = granted, FALSE = revoked/denied
    consent_text TEXT DEFAULT '',     -- Free-text description of what was consented to
    ip_address TEXT DEFAULT '',       -- Client IP at time of consent
    user_agent TEXT DEFAULT '',       -- Browser/device info at time of consent
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast consent lookups by user + type
CREATE INDEX IF NOT EXISTS idx_consent_records_user_type
    ON consent_records(user_id, consent_type, consented_at DESC);

-- Index for audit queries by date range
CREATE INDEX IF NOT EXISTS idx_consent_records_consented_at
    ON consent_records(consented_at DESC);

-- Prevent updates to consent records (immutable audit trail)
-- Records are append-only; consent changes create new rows
COMMENT ON TABLE consent_records IS 'Immutable DPDP consent audit trail. Never UPDATE or DELETE rows.';

-- ─── RLS Policy ────────────────────────────────────────────────────────────
-- Backend accesses this table via the service-role key (bypasses RLS entirely).
-- These policies only apply to direct client access (anon/authenticated roles):
-- users can only read and insert their own consent records.
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own consent records" ON consent_records;
DROP POLICY IF EXISTS "Users can insert own consent records" ON consent_records;

CREATE POLICY "Users can read own consent records"
    ON consent_records
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consent records"
    ON consent_records
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);