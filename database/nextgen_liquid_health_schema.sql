-- ==============================================================================
-- CALLMEDEX LIQUID HEALTH — DATABASE EXTENSIONS & MIGRATION SCRIPT
-- Version: 3.2.0-LIQUID-HEALTH
-- Sourced from: CALLMEDEX-LIQUID-HEALTH.md §12.1
-- ==============================================================================

BEGIN;

-- 1. Care Circle Members Table (§8.5)
-- Enables scoped family health guardianship (book_pay, view_reports, receive_alerts, join_consultations)
CREATE TABLE IF NOT EXISTS care_circle_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    phone TEXT NOT NULL,
    full_name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    scopes JSONB NOT NULL DEFAULT '["book_pay", "view_reports", "receive_alerts"]'::jsonb,
    status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'revoked')),
    invite_token TEXT UNIQUE,
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_circle_patient_status
    ON care_circle_members(patient_id, status);

CREATE INDEX IF NOT EXISTS idx_care_circle_member_user
    ON care_circle_members(member_user_id) WHERE member_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_care_circle_phone
    ON care_circle_members(phone);

ALTER TABLE public.care_circle_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all access" ON public.care_circle_members;
CREATE POLICY "Deny all access" ON public.care_circle_members
    FOR ALL TO public USING (false) WITH CHECK (false);


-- 2. Nurse Visit Logs Table (§5.6 & §12.1 Parity Gap)
-- Vitals recording, wound care, and IV administration for home nursing dispatches
CREATE TABLE IF NOT EXISTS nurse_visit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nurse_id UUID NOT NULL REFERENCES users(id),
    vitals JSONB NOT NULL DEFAULT '{}'::jsonb,
    wound_care_notes TEXT,
    iv_logs JSONB,
    procedure_notes TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nurse_visit_logs_booking
    ON nurse_visit_logs(booking_id);

CREATE INDEX IF NOT EXISTS idx_nurse_visit_logs_patient
    ON nurse_visit_logs(patient_id, created_at DESC);

ALTER TABLE public.nurse_visit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all access" ON public.nurse_visit_logs;
CREATE POLICY "Deny all access" ON public.nurse_visit_logs
    FOR ALL TO public USING (false) WITH CHECK (false);


-- 3. Biomarker Retest Rules Table (§8.9)
-- Conservative clinical retest suggestions based on abnormal or interval observations
CREATE TABLE IF NOT EXISTS biomarker_retest_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    biomarker_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('low', 'high', 'critical', 'normal')),
    interval_days INT NOT NULL,
    suggested_service_id UUID REFERENCES home_services(id) ON DELETE SET NULL,
    clinical_rationale TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biomarker_retest_type_status
    ON biomarker_retest_rules(biomarker_type, status);

ALTER TABLE public.biomarker_retest_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all access" ON public.biomarker_retest_rules;
CREATE POLICY "Deny all access" ON public.biomarker_retest_rules
    FOR ALL TO public USING (false) WITH CHECK (false);

-- Seed standard clinical retest rules
INSERT INTO biomarker_retest_rules (biomarker_type, status, interval_days, clinical_rationale)
VALUES
    ('VITAMIN_D', 'low', 90, 'Vitamin D re-testing is clinically recommended 3 months after supplementation to monitor target 25-OH-D levels.'),
    ('HBA1C', 'high', 90, 'HbA1c reflects average blood glucose over a 3-month erythrocyte lifespan; retest every 90 days if elevated.'),
    ('LIPID_PROFILE', 'high', 180, 'Serum lipid re-evaluation is recommended every 3–6 months following dietary modification or statin titration.'),
    ('THYROID_TSH', 'high', 60, 'TSH and free T4 levels require 6–8 weeks to reach steady state after dosage adjustment.'),
    ('THYROID_TSH', 'low', 60, 'Suppressed TSH requires 6-8 week repeat evaluation to prevent subclinical hyperthyroidism progression.'),
    ('SERUM_CREATININE', 'high', 30, 'Elevated creatinine or reduced eGFR warrants a 30-day renal function re-check.'),
    ('HEMOGLOBIN', 'low', 45, 'Follow-up complete blood count (CBC) recommended 6 weeks after therapeutic iron therapy to assess reticulocyte response.')
ON CONFLICT DO NOTHING;


-- 4. Extend ai_report_analyses with Multilingual Translation Cache (§8.6)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_report_analyses' AND column_name = 'summary_translations'
    ) THEN
        ALTER TABLE ai_report_analyses ADD COLUMN summary_translations JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;


-- 5. Record schema migration if schema_migrations table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schema_migrations' AND column_name = 'filename'
    ) THEN
        INSERT INTO schema_migrations (filename, applied_by, notes)
        VALUES ('nextgen_liquid_health_schema.sql', CURRENT_USER, 'Add care_circle_members, nurse_visit_logs, biomarker_retest_rules, summary_translations for Liquid Health')
        ON CONFLICT (filename) DO NOTHING;
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schema_migrations' AND column_name = 'version'
    ) THEN
        INSERT INTO schema_migrations (version, description)
        VALUES ('3.2.0', 'Add care_circle_members, nurse_visit_logs, biomarker_retest_rules, summary_translations for Liquid Health')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
