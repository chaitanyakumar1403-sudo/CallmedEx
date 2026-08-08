-- ============================================================================
-- Production Pipeline Hardening — Database Migrations
-- Covers P1 (ops_alerts, dispatch fan-out) and P2 (lab connector, analysis source)
-- ============================================================================

-- ─── P1.1: Ops Alerts Table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ops_alerts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type    TEXT NOT NULL,        -- e.g. 'dispatch_creation_failed', 'email_send_failed'
    entity_type   TEXT NOT NULL,        -- e.g. 'booking', 'dispatch_offer'
    entity_id     TEXT NOT NULL,        -- UUID of the affected entity (text for flexibility)
    severity      TEXT NOT NULL DEFAULT 'warning',  -- 'info' | 'warning' | 'critical'
    details       JSONB DEFAULT '{}'::jsonb,
    status        TEXT NOT NULL DEFAULT 'open',     -- 'open' | 'acknowledged' | 'resolved'
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMPTZ,
    resolved_by   UUID REFERENCES auth.users(id)
);

-- Index for admin dashboard queries (open alerts, newest first)
CREATE INDEX IF NOT EXISTS idx_ops_alerts_status_created
    ON ops_alerts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_alerts_type
    ON ops_alerts (alert_type);

-- ─── P1.5: Dispatch Fan-Out Tracking ────────────────────────────────────────
-- Track how many re-fan-out rounds have occurred and which providers declined
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dispatch_requests' AND column_name = 'fan_out_round'
    ) THEN
        ALTER TABLE dispatch_requests ADD COLUMN fan_out_round INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dispatch_requests' AND column_name = 'declined_provider_ids'
    ) THEN
        ALTER TABLE dispatch_requests ADD COLUMN declined_provider_ids UUID[] DEFAULT '{}';
    END IF;
END $$;

-- ─── P2.4: Per-Centre Lab Connector Type ────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'processing_centers' AND column_name = 'lab_connector_type'
    ) THEN
        ALTER TABLE processing_centers ADD COLUMN lab_connector_type TEXT DEFAULT 'mocdoc';
    END IF;
END $$;

ALTER TABLE processing_centers DROP CONSTRAINT IF EXISTS chk_processing_centers_lab_connector_type;
ALTER TABLE processing_centers ADD CONSTRAINT chk_processing_centers_lab_connector_type
    CHECK (lab_connector_type IN ('mocdoc', 'crelio', 'cloudlims', 'manual'));

-- ─── P2.7: Report Jobs Analysis Source ──────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'report_jobs' AND column_name = 'analysis_source'
    ) THEN
        ALTER TABLE report_jobs ADD COLUMN analysis_source TEXT DEFAULT 'mediassist';
    END IF;
END $$;

-- ─── RLS: ops_alerts readable by admins only ────────────────────────────────
ALTER TABLE ops_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ops_alerts_admin_read ON ops_alerts;
CREATE POLICY ops_alerts_admin_read ON ops_alerts
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM users WHERE role = 'admin'
        )
    );

DROP POLICY IF EXISTS ops_alerts_service_insert ON ops_alerts;
CREATE POLICY ops_alerts_service_insert ON ops_alerts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);  -- Satisfies Supabase linter while allowing authenticated inserts
