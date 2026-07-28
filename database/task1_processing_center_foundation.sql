BEGIN;

-- ============================================================================
-- CallMedex Task 1 — Processing Center Foundation
--
-- Spec: docs/superpowers/specs/2026-07-28-processing-center-foundation-design.md
--
-- The Processing Center is the operational layer between phlebotomists and
-- partner laboratories. The patient books from CallMedex and never sees a
-- centre, a laboratory or a diagnostic centre anywhere in this flow.
--
-- Idempotent — safe to re-run. New functions pin search_path (lint 0011) and
-- every new table gets an explicit deny-all policy (lint 0008): the FastAPI
-- backend uses the service key and bypasses RLS.
-- ============================================================================

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
-- 99. RLS — deny-all by default (lint 0008)
--     This block is appended to as later sections add tables.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    t TEXT;
    new_tables TEXT[] := ARRAY[
        'processing_centers', 'processing_center_staff',
        'processing_center_areas', 'city_aliases'
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
