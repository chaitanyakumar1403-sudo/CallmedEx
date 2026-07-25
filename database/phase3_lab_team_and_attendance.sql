-- ============================================================================
-- CallMedex — Lab/phlebotomist team-up + attendance gate
--
-- 1. lab_phlebotomist_links: a two-sided affiliation. Either party may open the
--    request; the OTHER party must accept before the link is real. Neither a
--    centre nor a collector can unilaterally claim the other.
-- 2. attendance_logs gains the fields the 05:15 selfie gate needs.
--
-- Idempotent. New tables carry deny-all policies and new functions pin
-- search_path, per the project's lint posture.
-- ============================================================================

BEGIN;

-- ─── 1. Lab ↔ phlebotomist affiliation ───────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_phlebotomist_links (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phlebotomist_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Who opened the request decides who has to answer it.
    initiated_by TEXT NOT NULL CHECK (initiated_by IN ('organization', 'phlebotomist')),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),

    message         TEXT DEFAULT '',
    response_note   TEXT DEFAULT '',
    requested_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    responded_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    requested_at    TIMESTAMPTZ DEFAULT NOW(),
    responded_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_links_org    ON lab_phlebotomist_links(org_user_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_links_phlebo ON lab_phlebotomist_links(phlebotomist_user_id, status);

-- One live conversation per pair: re-inviting someone you already invited should
-- update that request, not stack duplicates in both dashboards.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lab_links_open_pair
    ON lab_phlebotomist_links(org_user_id, phlebotomist_user_id)
    WHERE status IN ('pending', 'accepted');

-- ─── 2. Attendance gate ──────────────────────────────────────────────────
-- The MOUs require a live selfie with the collection kit before field duty.
-- Missing it holds PAYMENT, not dispatch: blocking dispatch would penalise the
-- patient who booked, and the platform's duty runs to the patient first.
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS deadline_local  TEXT DEFAULT '';
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS provider_role   TEXT DEFAULT 'phlebotomist';
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS hold_applied    BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_attendance_status_date
    ON attendance_logs(log_date, status);

-- ─── 3. Touch triggers ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_lab_links_touch ON lab_phlebotomist_links;
CREATE TRIGGER trg_lab_links_touch BEFORE UPDATE ON lab_phlebotomist_links
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── 4. RLS: deny-all (backend uses the service key; no browser client) ──
ALTER TABLE lab_phlebotomist_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all access" ON lab_phlebotomist_links;
CREATE POLICY "Deny all access" ON lab_phlebotomist_links
    FOR ALL TO public USING (false) WITH CHECK (false);

COMMIT;

NOTIFY pgrst, 'reload schema';
