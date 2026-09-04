-- ============================================================================
-- Migration: task13_medication_anchor_and_sos_alerts.sql
-- Description: Two columns/tables the patient dashboard needed and never had.
--
-- 1. patient_medications.last_counted_at
--    The medicine cabinet stored remaining_pills once and read it back
--    verbatim forever, so a prescription entered months ago still reported
--    "10/10, 5 days supply" and the refill radar could never fire. The supply
--    is now projected at read time from the last counted date at the
--    prescribed daily rate (_project_supply in app/routers/patient_sos.py),
--    and "Mark refilled" re-anchors it. Without this column the projection
--    falls back to updated_at/created_at, which is close but drifts every
--    time any other field is touched.
--
--    Back-filled from created_at so existing prescriptions start burning down
--    from when they were entered, not from the day this migration runs --
--    otherwise every stale row would reset to "full" on deploy.
--
-- 2. emergency_sos_alerts
--    /sos/trigger wrote a log line and returned "dispatched". Nothing was
--    persisted and nothing was sent, so there was no record that a patient
--    had ever raised an emergency. The endpoint now actually notifies the
--    saved contacts and records the attempt here, including how many were
--    reached -- which is the number that must be auditable after an incident.
-- Date: 2026-09-04
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. MEDICATION SUPPLY ANCHOR
-- ----------------------------------------------------------------------------
ALTER TABLE patient_medications
    ADD COLUMN IF NOT EXISTS last_counted_at TIMESTAMPTZ;

UPDATE patient_medications
   SET last_counted_at = COALESCE(created_at, NOW())
 WHERE last_counted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2. EMERGENCY SOS ALERT LOG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emergency_sos_alerts (
    -- TEXT, not UUID: the endpoint mints a human-traceable id
    -- ("sos-<patient prefix>-<epoch>") that ops can quote on a call.
    id                TEXT PRIMARY KEY,
    patient_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lat               DOUBLE PRECISION,
    lng               DOUBLE PRECISION,
    notes             TEXT DEFAULT '',
    contacts_total    INT NOT NULL DEFAULT 0,
    -- How many were ACTUALLY reached, not how many exist. The old endpoint
    -- reported the latter and called it "notified".
    contacts_notified INT NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_patient
    ON emergency_sos_alerts(patient_id, created_at DESC);

-- Undelivered alerts are the ones ops must chase, so make them cheap to find.
CREATE INDEX IF NOT EXISTS idx_sos_alerts_undelivered
    ON emergency_sos_alerts(created_at DESC)
 WHERE contacts_notified = 0;

-- Deny-all, matching every other table in this schema: the FastAPI backend
-- uses the service key and bypasses RLS (lint 0008).
ALTER TABLE public.emergency_sos_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all access" ON public.emergency_sos_alerts;
CREATE POLICY "Deny all access" ON public.emergency_sos_alerts
    FOR ALL TO public USING (false) WITH CHECK (false);

INSERT INTO schema_migrations (filename, applied_by, notes)
VALUES (
    'task13_medication_anchor_and_sos_alerts.sql',
    'claude',
    'Adds patient_medications.last_counted_at (back-filled from created_at) '
    'so the refill radar can burn a supply down, and emergency_sos_alerts so '
    'a raised SOS leaves a record of who was actually reached.'
)
ON CONFLICT (filename) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- VERIFICATION (run after applying)
-- ----------------------------------------------------------------------------
-- Every prescription should now have an anchor:
--   SELECT count(*) FROM patient_medications WHERE last_counted_at IS NULL;
--
-- What the cabinet will show for each row (mirrors _project_supply):
--   SELECT medicine_name, remaining_pills, pills_per_day,
--          GREATEST(0, remaining_pills - pills_per_day *
--                   EXTRACT(DAY FROM NOW() - last_counted_at)::int) AS projected
--     FROM patient_medications;
--
-- SOS alerts nobody was reached for:
--   SELECT * FROM emergency_sos_alerts WHERE contacts_notified = 0
--    ORDER BY created_at DESC;

-- ----------------------------------------------------------------------------
-- ROLLBACK
-- ----------------------------------------------------------------------------
-- BEGIN;
-- DROP TABLE IF EXISTS emergency_sos_alerts;
-- ALTER TABLE patient_medications DROP COLUMN IF EXISTS last_counted_at;
-- DELETE FROM schema_migrations
--  WHERE filename = 'task13_medication_anchor_and_sos_alerts.sql';
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
