-- ============================================================================
-- CallMedex Task 4 — Sample Verification Workflow, Barcode Locking & Custody FSM
--
-- Enhances physical sample collection verification, barcode locking,
-- processing center intake desk acknowledgment, and custody FSM audit logging.
-- Idempotent — safe to re-run in Supabase SQL Editor.
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. SAMPLES TABLE ENHANCEMENTS (BARCODE LOCKING & INTAKE ACKNOWLEDGMENT)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE samples ADD COLUMN IF NOT EXISTS barcode_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE samples ADD COLUMN IF NOT EXISTS barcode_locked_at TIMESTAMPTZ;
ALTER TABLE samples ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
ALTER TABLE samples ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Update specimen status constraint to enforce all FSM states
ALTER TABLE samples DROP CONSTRAINT IF EXISTS chk_samples_status;
ALTER TABLE samples ADD CONSTRAINT chk_samples_status
    CHECK (status IN (
        'pending_collection',
        'collected',
        'in_transit',
        'handover_requested',
        'received',
        'verified',
        'rejected',
        'processing',
        'report_ready',
        'delivered',
        'completed',
        'cancelled'
    ));

-- Indexes for barcode lock and processing center status lookups
CREATE INDEX IF NOT EXISTS idx_samples_barcode_locked
    ON samples(barcode, barcode_locked) WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_samples_pc_status
    ON samples(processing_center_id, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. SAMPLE EVENTS TABLE ENHANCEMENTS (IMMUTABLE CUSTODY LOG)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE sample_events ADD COLUMN IF NOT EXISTS processing_center_id UUID REFERENCES processing_centers(id) ON DELETE SET NULL;
ALTER TABLE sample_events ADD COLUMN IF NOT EXISTS location_label TEXT;
ALTER TABLE sample_events ADD COLUMN IF NOT EXISTS actor_role TEXT;
ALTER TABLE sample_events ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE sample_events ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Fast index for custody timeline queries
CREATE INDEX IF NOT EXISTS idx_sample_events_custody_timeline
    ON sample_events(sample_id, created_at ASC);

COMMIT;

NOTIFY pgrst, 'reload schema';
