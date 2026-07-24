-- ============================================================================
-- Layer 0 Foundation Migration — unified marketplace model (ADDITIVE)
-- Canonical provider identity = users.id.
-- ADDITIVE posture: this migration only CREATES new marketplace tables + the
-- provider_directory view. It DROPS no existing tables and adds NO bookings FK.
-- The legacy tables (slots, health_packages, organization_services,
-- doctor_availability, doctor_blocked_dates) are intentionally RETAINED so the
-- existing (Layer 2/3/6) endpoints keep working; they are superseded by the new
-- provider_* tables and get dropped in the layer that migrates their code.
-- The bookings.provider_id → users(id) FK is likewise deferred to Layer 3
-- (booking-flow rebuild), where the org-booking provider_id convention is
-- migrated to users.id. Idempotent — safe to re-run.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Refresh the view only (not data) so column changes re-apply cleanly.
DROP VIEW IF EXISTS provider_directory;

-- ── provider_settings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_settings (
    provider_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    home_service_enabled BOOLEAN DEFAULT false,
    home_radius_km REAL DEFAULT 10.0,
    commission_pct NUMERIC(5,2) DEFAULT 15.00,
    is_listed BOOLEAN DEFAULT true,
    accepts_online_payment BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── provider_branches ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    phone TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_branches_provider ON provider_branches(provider_user_id);

-- ── provider_services ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES provider_branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'lab_test',
    base_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    home_available BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_services_provider ON provider_services(provider_user_id);

-- ── provider_packages ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    included_service_ids UUID[] DEFAULT '{}',
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    home_available BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'approved' CHECK (status IN ('draft','pending','approved','rejected')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_packages_provider ON provider_packages(provider_user_id);

-- ── provider_availability (recurring template) ─────────────────────────────
CREATE TABLE IF NOT EXISTS provider_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES provider_branches(id) ON DELETE SET NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_minutes INT DEFAULT 30,
    capacity_per_slot INT DEFAULT 1,
    mode TEXT DEFAULT 'lab_visit' CHECK (mode IN ('lab_visit','home')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_availability_provider ON provider_availability(provider_user_id);

-- ── provider_slots (concrete, capacity-tracked) ────────────────────────────
CREATE TABLE IF NOT EXISTS provider_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES provider_branches(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INT DEFAULT 1,
    booked_count INT DEFAULT 0,
    mode TEXT DEFAULT 'lab_visit' CHECK (mode IN ('lab_visit','home')),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_slots_provider_date ON provider_slots(provider_user_id, date);

-- ── provider_blocked_dates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_blocked_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES provider_branches(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_blocked_provider ON provider_blocked_dates(provider_user_id);

-- ── verification_reviews (authority record) ────────────────────────────────
CREATE TABLE IF NOT EXISTS verification_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    ai_result JSONB DEFAULT '{}',
    ai_decision TEXT CHECK (ai_decision IN ('auto_approve','auto_reject','needs_review')),
    gov_result JSONB DEFAULT '{}',
    final_status TEXT NOT NULL DEFAULT 'under_review'
        CHECK (final_status IN ('verified','rejected','under_review')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_verification_reviews_status ON verification_reviews(final_status);
CREATE INDEX IF NOT EXISTS idx_verification_reviews_provider ON verification_reviews(provider_user_id);

-- ── bookings.provider_id FK → DEFERRED to Layer 3 ─────────────────────────
-- Not added here: the org-booking convention still keys on organizations.id.
-- Layer 3 (booking-flow rebuild) migrates that convention to users.id and adds
-- the FK then, so Layer 0 stays additive and non-breaking.

-- ── provider_directory view (single search surface) ────────────────────────
-- security_invoker=on → the view runs with the QUERYING role's permissions/RLS,
-- not the creator's (clears Supabase linter 0010 security_definer_view). Postgres 15+.
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
    COALESCE(ps.home_service_enabled, false) AS home_service_enabled
FROM organizations o
JOIN users u ON u.id = o.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(o.organization_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'doctor', u.full_name, d.specialization,
    u.city, u.state, NULL, NULL, d.rating, d.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, false)
FROM doctors d
JOIN users u ON u.id = d.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(u.full_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'pharmacy', ph.pharmacy_name, ph.pharmacy_type,
    u.city, u.state, NULL, NULL, 5.0, ph.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, ph.home_delivery)
FROM pharmacies ph
JOIN users u ON u.id = ph.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(ph.pharmacy_name), ''), '') <> '';
