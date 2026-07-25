-- ============================================================================
-- CallMedex Phase 1 — Sample lifecycle, provider economics, urgent tier,
--                     marketplace pricing, availability templates, MOU subtypes
--
-- Foundation for docs/SAMPLE_LIFECYCLE_AND_MARKETPLACE_PLAN.md
-- Canonical provider identity is users.id, per the Layer 0 convention.
-- Idempotent — safe to re-run. All new functions pin search_path (lint 0011)
-- and all new tables get explicit deny-all policies (lint 0008), matching the
-- project convention: the FastAPI backend uses the service key and bypasses RLS.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PLATFORM SETTINGS — admin-tunable knobs (urgent surcharge, etc.)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS platform_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL DEFAULT '{}',
    description TEXT DEFAULT '',
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Urgent surcharge: platform-wide, flat rupees or percentage of base price.
INSERT INTO platform_settings (key, value, description) VALUES
 ('urgent_surcharge',
  '{"mode":"flat","flat_inr":200,"percent":0,"min_inr":0,"max_inr":1000}',
  'Priority/urgent booking surcharge. mode = flat | percent.'),
 ('phlebo_offer_window_minutes',
  '{"minutes":10}',
  'Accept/reject window for a phlebotomist dispatch offer (MOU clause 3).'),
 ('phlebo_attendance_deadline',
  '{"time":"05:15","timezone":"Asia/Kolkata"}',
  'Daily selfie-with-kit deadline. Late or missing => payment hold.'),
 ('default_platform_fee_pct',
  '{"percent":20}',
  'Platform fee per MOU for doctors, physio, nursing and dental partners.')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. SAMPLE CHAIN OF CUSTODY
--    Today the barcode is generated client-side in PhlebotomistToolsModal.tsx
--    and never persisted, so no physical tube is traceable to a booking.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS samples (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    barcode               TEXT NOT NULL UNIQUE,
    booking_id            UUID REFERENCES bookings(id) ON DELETE SET NULL,
    dispatch_request_id   UUID REFERENCES dispatch_requests(id) ON DELETE SET NULL,
    patient_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phlebotomist_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Destination lab. Defaults to the phlebo's home lab; overridable per run
    -- when the booking belongs to a different partner center.
    destination_org_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    sample_type      TEXT DEFAULT 'blood',
    container_type   TEXT DEFAULT '',
    test_names       TEXT[] DEFAULT '{}',

    status TEXT NOT NULL DEFAULT 'collected' CHECK (status IN (
        'collected', 'in_transit', 'handover_requested',
        'received', 'rejected', 'processing', 'report_ready'
    )),

    collected_at       TIMESTAMPTZ DEFAULT NOW(),
    collection_lat     DOUBLE PRECISION,
    collection_lng     DOUBLE PRECISION,
    collection_photo_url TEXT DEFAULT '',

    received_at        TIMESTAMPTZ,
    received_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason   TEXT DEFAULT '',

    report_url         TEXT DEFAULT '',
    report_uploaded_at TIMESTAMPTZ,

    notes      TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_samples_barcode      ON samples(barcode);
CREATE INDEX IF NOT EXISTS idx_samples_booking      ON samples(booking_id);
CREATE INDEX IF NOT EXISTS idx_samples_patient      ON samples(patient_id);
CREATE INDEX IF NOT EXISTS idx_samples_phlebo       ON samples(phlebotomist_user_id, status);
CREATE INDEX IF NOT EXISTS idx_samples_destination  ON samples(destination_org_user_id, status);

-- Append-only custody log. The MOUs make the phlebo "fully responsible from
-- collection until delivery", so every transition needs actor + GPS + time.
CREATE TABLE IF NOT EXISTS sample_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id   UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    event       TEXT NOT NULL CHECK (event IN (
        'collected', 'scanned_transit', 'handover_requested',
        'received', 'rejected', 'processing_started', 'report_uploaded'
    )),
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role  TEXT DEFAULT '',
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    photo_url   TEXT DEFAULT '',
    notes       TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sample_events_sample ON sample_events(sample_id, created_at);

-- A phlebo submits a BATCH of tubes to a center. The center responds per sample,
-- so a partial acceptance (3 of 5 tubes intact) is representable.
CREATE TABLE IF NOT EXISTS sample_handovers (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phlebotomist_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destination_org_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'accepted', 'partially_accepted', 'rejected', 'cancelled'
    )),
    sample_count     INT DEFAULT 0,
    accepted_count   INT DEFAULT 0,
    rejected_count   INT DEFAULT 0,
    requested_at     TIMESTAMPTZ DEFAULT NOW(),
    responded_at     TIMESTAMPTZ,
    responded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT DEFAULT '',
    notes            TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_handovers_phlebo ON sample_handovers(phlebotomist_user_id, status);
CREATE INDEX IF NOT EXISTS idx_handovers_dest   ON sample_handovers(destination_org_user_id, status);

ALTER TABLE samples ADD COLUMN IF NOT EXISTS handover_id UUID REFERENCES sample_handovers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_samples_handover ON samples(handover_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PHLEBOTOMIST EMPLOYMENT MODEL
--    Part-time: ₹150 per verified collection, wallet, monthly settlement.
--    Full-time: salaried; incentives only. Both: 10-min accept, 05:15 selfie.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE phlebotomists ADD COLUMN IF NOT EXISTS home_lab_org_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE phlebotomists ADD COLUMN IF NOT EXISTS per_collection_rate  NUMERIC(10,2) DEFAULT 150.00;
ALTER TABLE phlebotomists ADD COLUMN IF NOT EXISTS monthly_salary       NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE phlebotomists ADD COLUMN IF NOT EXISTS employee_code        TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_phlebotomists_home_lab ON phlebotomists(home_lab_org_user_id);

-- Full-time phlebos are salaried, so no per-collection accrual.
UPDATE phlebotomists SET per_collection_rate = 0.00
 WHERE phleb_type = 'full_time' AND per_collection_rate = 150.00;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. WALLETS & LEDGER
--    Ledger-first: a disputed collection is reversed with a compensating entry
--    rather than by recomputing a balance.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS provider_wallets (
    provider_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance          NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    lifetime_earned  NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    lifetime_paid    NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    on_hold          BOOLEAN DEFAULT false,
    hold_reason      TEXT DEFAULT '',
    last_settled_at  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    direction        TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    amount           NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    balance_after    NUMERIC(12,2),
    reason TEXT NOT NULL CHECK (reason IN (
        'collection_payout', 'service_payout', 'incentive',
        'penalty', 'adjustment', 'settlement', 'reversal'
    )),
    -- What earned it. Lets a specific disputed collection be traced and reversed.
    sample_id   UUID REFERENCES samples(id) ON DELETE SET NULL,
    booking_id  UUID REFERENCES bookings(id) ON DELETE SET NULL,
    settlement_id UUID REFERENCES settlements(id) ON DELETE SET NULL,
    notes       TEXT DEFAULT '',
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_provider ON wallet_transactions(provider_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_sample   ON wallet_transactions(sample_id);

-- One credit per sample per reason: makes the payout path idempotent, so a
-- retried handover acceptance cannot double-pay a phlebotomist.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_tx_sample_reason
    ON wallet_transactions(sample_id, reason)
    WHERE sample_id IS NOT NULL AND direction = 'credit';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. INCENTIVES — phlebo upsell ("got the patient to add services")
--    Rules are data so commercial terms change without a deploy.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS incentive_rules (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    applies_to_role TEXT NOT NULL DEFAULT 'phlebotomist',
    trigger_event   TEXT NOT NULL CHECK (trigger_event IN (
        'upsell_service', 'upsell_package', 'collection_completed',
        'rating_threshold', 'monthly_volume'
    )),
    reward_type  TEXT NOT NULL DEFAULT 'flat' CHECK (reward_type IN ('flat', 'percent')),
    reward_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    min_order_value NUMERIC(10,2) DEFAULT 0.00,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO incentive_rules (code, name, description, applies_to_role, trigger_event, reward_type, reward_value)
VALUES
 ('PHLEBO_UPSELL_PKG', 'Health package upsell',
  'Phlebotomist converts a single-test visit into a health package booking.',
  'phlebotomist', 'upsell_package', 'percent', 5.00),
 ('PHLEBO_UPSELL_SVC', 'Add-on test upsell',
  'Phlebotomist adds one or more tests to an existing booking at the doorstep.',
  'phlebotomist', 'upsell_service', 'percent', 5.00)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS incentive_ledger (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rule_id          UUID REFERENCES incentive_rules(id) ON DELETE SET NULL,
    booking_id       UUID REFERENCES bookings(id) ON DELETE SET NULL,
    sample_id        UUID REFERENCES samples(id) ON DELETE SET NULL,
    base_amount      NUMERIC(12,2) DEFAULT 0.00,
    reward_amount    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'credited', 'rejected')),
    wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    notes      TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    credited_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incentive_ledger_provider ON incentive_ledger(provider_user_id, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ATTENDANCE — the 05:15 selfie-with-kit gate
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS attendance_logs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    selfie_url       TEXT DEFAULT '',
    submitted_at     TIMESTAMPTZ DEFAULT NOW(),
    is_late          BOOLEAN DEFAULT false,
    lat              DOUBLE PRECISION,
    lng              DOUBLE PRECISION,
    status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'verified', 'rejected', 'missed')),
    verified_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    notes            TEXT DEFAULT '',
    UNIQUE (provider_user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_provider_date ON attendance_logs(provider_user_id, log_date DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. URGENT / PRIORITY TIER
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_priority_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_priority_check
    CHECK (priority IN ('normal', 'urgent'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS urgent_surcharge_applied NUMERIC(10,2) DEFAULT 0.00;

ALTER TABLE dispatch_requests ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE dispatch_requests DROP CONSTRAINT IF EXISTS dispatch_requests_priority_check;
ALTER TABLE dispatch_requests ADD CONSTRAINT dispatch_requests_priority_check
    CHECK (priority IN ('normal', 'urgent'));

-- Partial index: the dispatch board's hottest query is "show me urgent, unassigned".
CREATE INDEX IF NOT EXISTS idx_dispatch_urgent_open
    ON dispatch_requests(created_at DESC)
    WHERE priority = 'urgent' AND status IN ('searching', 'provider_notified');

CREATE INDEX IF NOT EXISTS idx_bookings_priority ON bookings(priority, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. MARKETPLACE PRICING — center sets MRP, platform sets discount %
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE provider_services ADD COLUMN IF NOT EXISTS mrp             NUMERIC(10,2);
ALTER TABLE provider_services ADD COLUMN IF NOT EXISTS urgent_available BOOLEAN DEFAULT false;
ALTER TABLE provider_services ADD COLUMN IF NOT EXISTS catalog_id      UUID;
ALTER TABLE provider_services ADD COLUMN IF NOT EXISTS turnaround_hours INT;

-- Existing rows have base_price only; treat it as MRP until partners enter one.
UPDATE provider_services SET mrp = base_price WHERE mrp IS NULL;

ALTER TABLE provider_settings ADD COLUMN IF NOT EXISTS partner_discount_pct NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE provider_settings ADD COLUMN IF NOT EXISTS payout_model TEXT DEFAULT 'wallet';
ALTER TABLE provider_settings DROP CONSTRAINT IF EXISTS provider_settings_payout_model_check;
ALTER TABLE provider_settings ADD CONSTRAINT provider_settings_payout_model_check
    CHECK (payout_model IN ('wallet', 'confirmation_fee'));

-- Canonical test names + synonyms. This is what lets "MRI" match
-- "Magnetic Resonance Imaging" and "MRI Brain Screening" across partners.
CREATE TABLE IF NOT EXISTS service_catalog (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    category    TEXT NOT NULL DEFAULT 'lab_test'
        CHECK (category IN ('lab_test', 'imaging', 'health_package', 'procedure', 'consultation')),
    synonyms    TEXT[] DEFAULT '{}',
    description TEXT DEFAULT '',
    preparation TEXT DEFAULT '',
    home_collection_possible BOOLEAN DEFAULT false,
    typical_turnaround_hours INT,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(category) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_service_catalog_synonyms ON service_catalog USING GIN (synonyms);

ALTER TABLE provider_services
    DROP CONSTRAINT IF EXISTS provider_services_catalog_fkey;
ALTER TABLE provider_services
    ADD CONSTRAINT provider_services_catalog_fkey
    FOREIGN KEY (catalog_id) REFERENCES service_catalog(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_provider_services_catalog ON provider_services(catalog_id);

INSERT INTO service_catalog (name, slug, category, synonyms, home_collection_possible, typical_turnaround_hours) VALUES
 ('Complete Blood Count', 'cbc', 'lab_test', ARRAY['CBC','Full Blood Count','FBC','Haemogram','Hemogram'], true, 6),
 ('Lipid Profile', 'lipid-profile', 'lab_test', ARRAY['Cholesterol Test','Lipid Panel'], true, 8),
 ('Thyroid Profile', 'thyroid-profile', 'lab_test', ARRAY['TSH','T3 T4 TSH','Thyroid Function Test','TFT'], true, 12),
 ('Liver Function Test', 'lft', 'lab_test', ARRAY['LFT','Liver Panel'], true, 8),
 ('Kidney Function Test', 'kft', 'lab_test', ARRAY['KFT','Renal Profile','RFT'], true, 8),
 ('HbA1c', 'hba1c', 'lab_test', ARRAY['Glycated Haemoglobin','Diabetes Test','A1c'], true, 6),
 ('Vitamin D', 'vitamin-d', 'lab_test', ARRAY['25-OH Vitamin D','Vit D'], true, 24),
 ('Vitamin B12', 'vitamin-b12', 'lab_test', ARRAY['Cobalamin','Vit B12'], true, 24),
 ('Fasting Blood Sugar', 'fbs', 'lab_test', ARRAY['FBS','Fasting Glucose'], true, 4),
 ('Urine Routine', 'urine-routine', 'lab_test', ARRAY['Urine Analysis','Urine R/M'], true, 4),
 ('Iron Studies', 'iron-studies', 'lab_test', ARRAY['Serum Iron','Ferritin Panel'], true, 12),
 ('ECG', 'ecg', 'procedure', ARRAY['EKG','Electrocardiogram'], true, 1),
 ('MRI', 'mri', 'imaging', ARRAY['Magnetic Resonance Imaging','MRI Scan','MR Scan'], false, 24),
 ('CT Scan', 'ct-scan', 'imaging', ARRAY['Computed Tomography','CAT Scan'], false, 24),
 ('X-Ray', 'x-ray', 'imaging', ARRAY['Radiograph','XRay'], false, 4),
 ('Ultrasound', 'ultrasound', 'imaging', ARRAY['USG','Sonography','Scan'], false, 4),
 ('2D Echo', '2d-echo', 'imaging', ARRAY['Echocardiogram','Echo'], false, 6),
 ('Mammography', 'mammography', 'imaging', ARRAY['Mammogram','Breast Screening'], false, 24)
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. DOCTOR AVAILABILITY — "apply to all days" template grouping
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE provider_availability ADD COLUMN IF NOT EXISTS template_group_id UUID;
CREATE INDEX IF NOT EXISTS idx_provider_availability_group ON provider_availability(template_group_id);

ALTER TABLE doctor_availability ADD COLUMN IF NOT EXISTS template_group_id UUID;
CREATE INDEX IF NOT EXISTS idx_doctor_availability_group ON doctor_availability(template_group_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. MOU SUBTYPES + PAYMENT SHEETS
--     A dental clinic and a diagnostic center must receive different
--     agreements plus their own rate sheet at registration.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS provider_subtype    TEXT DEFAULT '';
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS payment_sheet_url   TEXT DEFAULT '';
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS payment_terms       JSONB DEFAULT '{}';

-- Distinguish the two phlebotomist agreements, which differ materially:
-- part-time is ₹150/collection via wallet, full-time is salaried.
UPDATE legal_documents SET provider_subtype = 'part_time'
 WHERE document_type = 'mou_phlebotomist' AND provider_subtype = '';

INSERT INTO legal_documents
    (document_type, version, title, content_text, applicable_roles,
     provider_subtype, payment_terms, is_active, effective_date)
SELECT
    'mou_phlebotomist', 'v1.0', 'Phlebotomist MOU (Full Time) — CallMedex',
    'Full-time phlebotomist terms: salaried engagement, daily attendance via app '
    'login and 05:15 selfie with collection kit, 10-minute offer acceptance, full '
    'responsibility for samples from collection until handover to the designated '
    'processing center, and company ownership of kits, uniforms and ID cards.',
    '{phlebotomist}', 'full_time',
    '{"model":"salary","per_collection_rate":0,"settlement":"monthly_payroll"}'::jsonb,
    true, CURRENT_DATE
WHERE NOT EXISTS (
    SELECT 1 FROM legal_documents
     WHERE document_type = 'mou_phlebotomist' AND provider_subtype = 'full_time'
);

UPDATE legal_documents
   SET payment_terms = '{"model":"wallet","per_collection_rate":150,"settlement":"monthly"}'::jsonb
 WHERE document_type = 'mou_phlebotomist'
   AND provider_subtype = 'part_time'
   AND payment_terms = '{}'::jsonb;

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. TRIGGERS — keep updated_at fresh (search_path pinned per lint 0011)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_samples_touch ON samples;
CREATE TRIGGER trg_samples_touch BEFORE UPDATE ON samples
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_wallets_touch ON provider_wallets;
CREATE TRIGGER trg_wallets_touch BEFORE UPDATE ON provider_wallets
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. RLS — deny-all by default (lint 0008). Backend uses the service key,
--     which has BYPASSRLS; the frontend has no Supabase client at all.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    t TEXT;
    new_tables TEXT[] := ARRAY[
        'platform_settings', 'samples', 'sample_events', 'sample_handovers',
        'provider_wallets', 'wallet_transactions', 'incentive_rules',
        'incentive_ledger', 'attendance_logs', 'service_catalog'
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
