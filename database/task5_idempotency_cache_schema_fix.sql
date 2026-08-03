-- ============================================================================
-- CallMedex Task 5 — Idempotency Cache Composite Primary Key Fix
--
-- Corrects schema mismatch in mediassist_inbound_requests:
-- Updates primary key from single-column (idempotency_key) to composite (idempotency_key, endpoint).
-- Preserves existing data, ensures backwards compatibility, and is fully idempotent.
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PRE-MIGRATION VALIDATION
-- ═══════════════════════════════════════════════════════════════════════════

-- Ensure table exists before modifying
CREATE TABLE IF NOT EXISTS mediassist_inbound_requests (
    idempotency_key TEXT NOT NULL,
    endpoint        TEXT NOT NULL,
    status_code     INT NOT NULL,
    response_body   JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ALTER CONSTRAINT TO COMPOSITE (idempotency_key, endpoint)
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop legacy single-column primary key constraint if present
ALTER TABLE mediassist_inbound_requests DROP CONSTRAINT IF EXISTS mediassist_inbound_requests_pkey;

-- Add updated composite primary key matching code behavior
ALTER TABLE mediassist_inbound_requests ADD CONSTRAINT mediassist_inbound_requests_pkey PRIMARY KEY (idempotency_key, endpoint);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. POST-MIGRATION VALIDATION
-- ═══════════════════════════════════════════════════════════════════════════

-- Create index to optimize endpoint lookups if not already created by primary key
CREATE INDEX IF NOT EXISTS idx_mediassist_inbound_requests_key_endpoint 
    ON mediassist_inbound_requests(idempotency_key, endpoint);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK SCRIPT (for reference):
-- BEGIN;
-- ALTER TABLE mediassist_inbound_requests DROP CONSTRAINT IF EXISTS mediassist_inbound_requests_pkey;
-- ALTER TABLE mediassist_inbound_requests ADD CONSTRAINT mediassist_inbound_requests_pkey PRIMARY KEY (idempotency_key);
-- COMMIT;
-- ═══════════════════════════════════════════════════════════════════════════
