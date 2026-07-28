-- ============================================================================
-- CallMedex Task 1 — Processing Center Foundation
--
-- Spec: docs/superpowers/specs/2026-07-28-processing-center-foundation-design.md
--
-- The Processing Center is the operational layer between phlebotomists and
-- partner laboratories. The patient books from CallMedex and never sees a
-- centre, a laboratory or a diagnostic centre anywhere in this flow.
--
-- Idempotent — safe to re-run. Every new table gets an explicit deny-all
-- policy (lint 0008): the FastAPI backend uses the service key and bypasses
-- RLS.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PROCESSING CENTRES
--    Created only by a CallMedex admin. There is deliberately no signup route,
--    no MOU flow and no verification pipeline entry for a centre.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS processing_centers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        TEXT NOT NULL UNIQUE,              -- 'HYD-01', 'VSP-01'
    name        TEXT NOT NULL,
    city        TEXT NOT NULL,
    address     TEXT DEFAULT '',
    pincode     TEXT DEFAULT '',
    state       TEXT DEFAULT '',
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,

    -- Internal only. Must never appear in a patient-facing payload.
    partner_lab_name      TEXT DEFAULT '',
    partner_lab_reference TEXT DEFAULT '',

    daily_capacity INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'onboarding'
        CHECK (status IN ('onboarding', 'active', 'paused', 'closed')),

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pc_city   ON processing_centers(city) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_pc_status ON processing_centers(status);

-- Several people work at HYD-01, so the custody actor is the person, not the
-- centre. One shared login would make the chain of custody meaningless.
CREATE TABLE IF NOT EXISTS processing_center_staff (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processing_center_id UUID NOT NULL REFERENCES processing_centers(id) ON DELETE CASCADE,
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pc_role              TEXT NOT NULL CHECK (pc_role IN ('admin', 'technician')),
    is_active            BOOLEAN DEFAULT true,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (processing_center_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pc_staff_user ON processing_center_staff(user_id) WHERE is_active;

-- Serviceable areas. Today one city row per centre reproduces the
-- "one PC per city" rollout; adding HYD-02 later is a row, not a code change.
CREATE TABLE IF NOT EXISTS processing_center_areas (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processing_center_id UUID NOT NULL REFERENCES processing_centers(id) ON DELETE CASCADE,
    city      TEXT,                    -- normalised, lowercase
    pincode   TEXT,                    -- when set, the strongest match
    radius_km NUMERIC(6,2),            -- geo fallback around the centre
    priority  INT NOT NULL DEFAULT 100,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_pc_areas_pincode ON processing_center_areas(pincode) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_pc_areas_city    ON processing_center_areas(city)    WHERE is_active;

-- Without this, 'Vizag' / 'Visakhapatnam' / 'VISAKHAPATNAM' silently fail to
-- resolve and the patient is told their city is unserviced.
CREATE TABLE IF NOT EXISTS city_aliases (
    alias          TEXT PRIMARY KEY,
    canonical_city TEXT NOT NULL
);

INSERT INTO city_aliases (alias, canonical_city) VALUES
 ('vizag',            'visakhapatnam'),
 ('visakhapatnam',    'visakhapatnam'),
 ('vishakhapatnam',   'visakhapatnam'),
 ('hyd',              'hyderabad'),
 ('hyderabad',        'hyderabad'),
 ('secunderabad',     'hyderabad')
ON CONFLICT (alias) DO NOTHING;

-- Centres seed at 'onboarding' with no laboratory name. A real admin activates
-- them and enters the real partner. Nothing here is pre-verified.
INSERT INTO processing_centers (code, name, city, state, status)
VALUES
 ('HYD-01', 'Hyderabad Processing Centre 01',     'hyderabad',     'Telangana',      'onboarding'),
 ('VSP-01', 'Visakhapatnam Processing Centre 01', 'visakhapatnam', 'Andhra Pradesh', 'onboarding')
ON CONFLICT (code) DO NOTHING;

INSERT INTO processing_center_areas (processing_center_id, city, priority)
SELECT pc.id, pc.city, 100
  FROM processing_centers pc
 WHERE pc.code IN ('HYD-01', 'VSP-01')
   AND NOT EXISTS (
        SELECT 1 FROM processing_center_areas a
         WHERE a.processing_center_id = pc.id AND a.city = pc.city
   );

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ROLE
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient','doctor','phlebotomist','organization','staff',
                  'pharmacy','nurse','ambulance','admin','supervisor',
                  'processing_center'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. HOME-SERVICE CATALOG — owned by CallMedex, not by any centre
--
--    Two service families, deliberately kept apart:
--      home services (here)   blood tests, ECG, vitals — CallMedex prices them,
--                             a phlebotomist delivers them, the patient never
--                             sees a provider.
--      walk-in services       MRI, CT, X-ray — the diagnostic centre publishes
--      (provider_services)    and prices them, and the patient picks a centre.
--                             UNCHANGED by this migration.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tube_types (
    code              TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    cap_colour        TEXT DEFAULT '',
    additive          TEXT DEFAULT '',
    typical_volume_ml NUMERIC(5,2),
    is_active         BOOLEAN DEFAULT true
);

INSERT INTO tube_types (code, name, cap_colour, additive, typical_volume_ml) VALUES
 ('edta_lavender', 'EDTA (Lavender)',   'lavender', 'K2/K3 EDTA',     3.0),
 ('sst_gold',      'SST (Gold)',        'gold',     'Clot activator + gel', 5.0),
 ('citrate_blue',  'Citrate (Blue)',    'blue',     'Sodium citrate', 2.7),
 ('fluoride_grey', 'Fluoride (Grey)',   'grey',     'Sodium fluoride', 2.0),
 ('plain_red',     'Plain (Red)',       'red',      'None',           5.0)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS home_services (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Reuses the existing synonym dictionary so "Haemogram" still finds CBC.
    catalog_id   UUID REFERENCES service_catalog(id) ON DELETE SET NULL,
    code         TEXT NOT NULL UNIQUE,
    service_kind TEXT NOT NULL DEFAULT 'blood_test'
        CHECK (service_kind IN ('blood_test', 'ecg', 'vitals')),
    name        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'blood_test',
    description TEXT DEFAULT '',

    base_price                NUMERIC(10,2) NOT NULL,
    urgent_surcharge_override NUMERIC(10,2),   -- NULL => platform_settings knob

    home_collection_available BOOLEAN DEFAULT true,
    fasting_required          BOOLEAN DEFAULT false,
    fasting_hours             INT DEFAULT 0,
    preparation_instructions  TEXT DEFAULT '',
    estimated_report_hours    INT,

    is_active  BOOLEAN DEFAULT true,           -- the enable/disable switch
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_home_services_active ON home_services(service_kind) WHERE is_active;

CREATE TABLE IF NOT EXISTS home_service_tubes (
    home_service_id UUID NOT NULL REFERENCES home_services(id) ON DELETE CASCADE,
    tube_type_code  TEXT NOT NULL REFERENCES tube_types(code),
    volume_ml       NUMERIC(5,2),
    PRIMARY KEY (home_service_id, tube_type_code)
);

CREATE TABLE IF NOT EXISTS home_service_city_pricing (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    home_service_id UUID NOT NULL REFERENCES home_services(id) ON DELETE CASCADE,
    processing_center_id UUID NOT NULL REFERENCES processing_centers(id) ON DELETE CASCADE,
    price      NUMERIC(10,2) NOT NULL,
    is_active  BOOLEAN DEFAULT true,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (home_service_id, processing_center_id)
);

-- ESR and CRP are not yet in service_catalog; add them so every home service
-- has a synonym entry to search against.
INSERT INTO service_catalog (name, slug, category, synonyms, home_collection_possible, typical_turnaround_hours) VALUES
 ('ESR', 'esr', 'lab_test', ARRAY['Erythrocyte Sedimentation Rate','Sed Rate'], true, 6),
 ('CRP', 'crp', 'lab_test', ARRAY['C-Reactive Protein','C Reactive Protein'],   true, 6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO home_services
    (catalog_id, code, service_kind, name, category, base_price,
     fasting_required, fasting_hours, preparation_instructions, estimated_report_hours)
SELECT sc.id, v.code, 'blood_test', v.name, 'blood_test', v.price,
       v.fasting, v.fasting_hours, v.prep, v.tat
  FROM (VALUES
    ('CBC',     'cbc',             'Complete Blood Count', 350.00, false,  0, '', 6),
    ('LFT',     'lft',             'Liver Function Test',  650.00, true,   8, 'Fast for 8 hours. Water is allowed.', 8),
    ('KFT',     'kft',             'Kidney Function Test', 650.00, true,   8, 'Fast for 8 hours. Water is allowed.', 8),
    ('LIPID',   'lipid-profile',   'Lipid Profile',        600.00, true,  12, 'Fast for 12 hours. Water is allowed.', 8),
    ('HBA1C',   'hba1c',           'HbA1c',                500.00, false,  0, '', 6),
    ('THYROID', 'thyroid-profile', 'Thyroid Profile',      550.00, false,  0, 'Take the sample before any thyroid medication.', 12),
    ('VITD',    'vitamin-d',       'Vitamin D',            1200.00, false, 0, '', 24),
    ('VITB12',  'vitamin-b12',     'Vitamin B12',          1100.00, false, 0, '', 24),
    ('ESR',     'esr',             'ESR',                  200.00, false,  0, '', 6),
    ('CRP',     'crp',             'CRP',                  450.00, false,  0, '', 6)
  ) AS v(code, slug, name, price, fasting, fasting_hours, prep, tat)
  LEFT JOIN service_catalog sc ON sc.slug = v.slug
 WHERE NOT EXISTS (SELECT 1 FROM home_services hs WHERE hs.code = v.code);

INSERT INTO home_service_tubes (home_service_id, tube_type_code, volume_ml)
SELECT hs.id, v.tube, v.vol
  FROM (VALUES
    ('CBC',     'edta_lavender', 3.0),
    ('ESR',     'citrate_blue',  2.7),
    ('HBA1C',   'edta_lavender', 3.0),
    ('LFT',     'sst_gold',      5.0),
    ('KFT',     'sst_gold',      5.0),
    ('LIPID',   'sst_gold',      5.0),
    ('THYROID', 'sst_gold',      5.0),
    ('VITD',    'sst_gold',      5.0),
    ('VITB12',  'sst_gold',      5.0),
    ('CRP',     'sst_gold',      5.0)
  ) AS v(code, tube, vol)
  JOIN home_services hs ON hs.code = v.code
 WHERE NOT EXISTS (
    SELECT 1 FROM home_service_tubes t
     WHERE t.home_service_id = hs.id AND t.tube_type_code = v.tube
 );

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. FAMILY MEMBERS, BOOKING SUBJECTS AND TEST LINES
--    "Separate barcode, separate sample, separate report" per person falls out
--    of the schema once every subject — including the account holder — is a
--    family_members row.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    relationship    TEXT DEFAULT '',
    gender          TEXT DEFAULT '',
    date_of_birth   DATE,
    mobile          TEXT DEFAULT '',
    abha_number     TEXT DEFAULT '',        -- future per-member ABHA linkage
    is_self         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_members_account ON family_members(account_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_family_members_self
    ON family_members(account_user_id) WHERE is_self;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS processing_center_id UUID
    REFERENCES processing_centers(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_kind TEXT DEFAULT 'legacy';
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_kind_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_kind_check
    CHECK (booking_kind IN ('legacy', 'home_collection', 'walk_in'));

CREATE INDEX IF NOT EXISTS idx_bookings_pc ON bookings(processing_center_id, status);

CREATE TABLE IF NOT EXISTS booking_subjects (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id       UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    family_member_id UUID NOT NULL REFERENCES family_members(id),
    UNIQUE (booking_id, family_member_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_subjects_booking ON booking_subjects(booking_id);

CREATE TABLE IF NOT EXISTS booking_tests (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id         UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    booking_subject_id UUID NOT NULL REFERENCES booking_subjects(id) ON DELETE CASCADE,
    home_service_id    UUID NOT NULL REFERENCES home_services(id),
    price_charged      NUMERIC(10,2) NOT NULL,
    urgent_surcharge   NUMERIC(10,2) DEFAULT 0.00,
    source TEXT NOT NULL DEFAULT 'booking'
        CHECK (source IN ('booking', 'doorstep_addon')),
    added_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    added_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (booking_subject_id, home_service_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_tests_subject ON booking_tests(booking_subject_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 99. RLS — deny-all by default (lint 0008)
--     This block is appended to as later sections add tables.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    t TEXT;
    new_tables TEXT[] := ARRAY[
        'processing_centers', 'processing_center_staff',
        'processing_center_areas', 'city_aliases',
        'tube_types', 'home_services', 'home_service_tubes', 'home_service_city_pricing',
        'family_members', 'booking_subjects', 'booking_tests'
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
