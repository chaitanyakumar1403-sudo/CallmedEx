-- ============================================================================
-- CallMedex Provider Expansion: Dietitians, Physiotherapists & MOU Scopes
--
-- 1. Creates `dietitians` and `physiotherapists` tables with JSONB scope_of_services,
--    statutory licensing numbers, consultation & home visit rates, and coordinates.
-- 2. Updates `provider_directory` view to index dietitians and physiotherapists
--    alongside doctors, organizations, and pharmacies across districts.
-- 3. Preserves security_invoker = on to clear Supabase linter 0010.
--
-- Idempotent & non-destructive.
-- ============================================================================

BEGIN;

-- ─── 0. Allow the two new roles on users ───────────────────────────────────
-- users_role_check never listed 'dietitian' or 'physiotherapist', so every
-- signup for the two roles this migration exists to support was rejected by
-- Postgres before it ever reached the tables below.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'patient','doctor','phlebotomist','organization','staff','pharmacy',
    'nurse','ambulance','admin','supervisor','processing_center',
    'dietitian','physiotherapist'
  ));

-- ─── 0b. Allow the service types these providers actually sell ─────────────
-- bookings_service_type_check stopped at 'physiotherapy'. A dietitian
-- appointment is a 'consultation' and a therapist travelling to the patient is
-- a 'home_visit'; both are in the ServiceType enum the API already accepts, so
-- without these the booking passed validation and was then rejected by Postgres.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_service_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_service_type_check
  CHECK (service_type IN (
    'lab_test','imaging','health_package','video_consult','home_collection',
    'doctor_appointment','nurse_visit','ambulance','pharmacy_delivery',
    'physiotherapy','consultation','home_visit','nursing_care',
    'medicine_delivery','procedure'
  ));

-- ─── 1. Dietitians Table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dietitians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    dietitian_license_number TEXT NOT NULL DEFAULT '', -- IDA / Registered Dietitian (RD) credentials
    qualification TEXT DEFAULT '',                     -- B.Sc / M.Sc Clinical Nutrition, PGD Dietetics
    specializations TEXT[] DEFAULT '{}',               -- Weight Mgmt, Diabetic MNT, Cardiac, Renal, Pediatric, Sports
    years_of_experience INT DEFAULT 0,
    clinic_center_name TEXT DEFAULT '',
    consultation_fee REAL DEFAULT 400.0,
    home_visit_fee REAL DEFAULT 800.0,
    consultation_mode TEXT DEFAULT 'both' CHECK (consultation_mode IN ('online', 'clinic', 'both', 'home_visit')),
    available_for_online BOOLEAN DEFAULT true,
    available_for_home_visit BOOLEAN DEFAULT true,
    scope_of_services JSONB DEFAULT '[]'::jsonb,       -- Selected services, modalities & agreed custom rates
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verified_at TIMESTAMPTZ,
    rating REAL DEFAULT NULL,
    total_reviews INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dietitians_user ON dietitians(user_id);
CREATE INDEX IF NOT EXISTS idx_dietitians_verification ON dietitians(verification_status);

-- ─── 2. Physiotherapists Table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS physiotherapists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    physio_license_number TEXT NOT NULL DEFAULT '',    -- State Council / IAP Registration credentials
    qualification TEXT DEFAULT '',                     -- BPT, MPT, Ph.D. Physiotherapy
    specializations TEXT[] DEFAULT '{}',               -- Ortho, Neuro, Sports, Geriatric, Pediatric, Pain Mgmt
    years_of_experience INT DEFAULT 0,
    clinic_center_name TEXT DEFAULT '',
    consultation_fee REAL DEFAULT 400.0,
    home_visit_fee REAL DEFAULT 800.0,
    consultation_mode TEXT DEFAULT 'both' CHECK (consultation_mode IN ('online', 'clinic', 'both', 'home_visit')),
    available_for_online BOOLEAN DEFAULT true,
    available_for_home_visit BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,                   -- Live dispatch readiness for home visits
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    service_radius_km REAL DEFAULT 15.0,
    scope_of_services JSONB DEFAULT '[]'::jsonb,       -- Selected procedures & agreed custom rates
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verified_at TIMESTAMPTZ,
    rating REAL DEFAULT NULL,
    total_reviews INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_physiotherapists_user ON physiotherapists(user_id);
CREATE INDEX IF NOT EXISTS idx_physiotherapists_verification ON physiotherapists(verification_status);

-- ─── 3. Update provider_directory View ───────────────────────────────────────
-- Appends branches for dietitians and physiotherapists.
-- Preserves `WITH (security_invoker = on)` and keeps `district` as the final column.
CREATE OR REPLACE VIEW provider_directory WITH (security_invoker = on) AS
SELECT
    u.id AS provider_user_id,
    'organization' AS provider_type,
    o.organization_name AS display_name,
    o.organization_type AS subtype,
    u.city, u.state,
    NULL::double precision AS lat,
    NULL::double precision AS lng,
    5.0::real AS rating,
    o.verification_status,
    COALESCE(ps.is_listed, true) AS is_listed,
    COALESCE(ps.home_service_enabled, false) AS home_service_enabled,
    u.district
FROM organizations o
JOIN users u ON u.id = o.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(o.organization_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'doctor', u.full_name, d.specialization,
    u.city, u.state, NULL, NULL, d.rating, d.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, false),
    u.district
FROM doctors d
JOIN users u ON u.id = d.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(u.full_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'pharmacy', ph.pharmacy_name, ph.pharmacy_type,
    u.city, u.state, NULL, NULL, 5.0, ph.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, ph.home_delivery),
    u.district
FROM pharmacies ph
JOIN users u ON u.id = ph.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(ph.pharmacy_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'dietitian', u.full_name, array_to_string(dt.specializations, ', '),
    u.city, u.state, NULL, NULL, dt.rating, dt.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, dt.available_for_home_visit),
    u.district
FROM dietitians dt
JOIN users u ON u.id = dt.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(u.full_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'physiotherapist', u.full_name, array_to_string(pt.specializations, ', '),
    u.city, u.state, pt.current_lat, pt.current_lng, pt.rating, pt.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, pt.available_for_home_visit),
    u.district
FROM physiotherapists pt
JOIN users u ON u.id = pt.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(u.full_name), ''), '') <> '';

COMMIT;

NOTIFY pgrst, 'reload schema';
