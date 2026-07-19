-- ============================================================================
-- CallMedex Phase 6A: Provider Management & Real Slot System
-- Doctor availability, organization-doctor linking, services & pricing
-- Run AFTER: schema.sql, nextgen_phase1_schema.sql, nextgen_phase2_schema.sql
-- ============================================================================

-- ─── Doctor Weekly Availability Schedule ──────────────────────────────────
-- Doctors define their recurring weekly availability.
-- The system auto-generates bookable slots from these patterns.
CREATE TABLE IF NOT EXISTS doctor_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INT NOT NULL DEFAULT 30,
    consultation_mode TEXT NOT NULL DEFAULT 'in_person'
        CHECK (consultation_mode IN ('in_person', 'online', 'home_visit', 'both')),
    max_patients_per_slot INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Optional: link to a specific organization location
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    location_name TEXT DEFAULT '',  -- e.g., "KIMS Hospital - OPD Room 12"
    location_address TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX idx_doctor_avail_doctor ON doctor_availability(doctor_id);
CREATE INDEX idx_doctor_avail_day ON doctor_availability(day_of_week);
CREATE INDEX idx_doctor_avail_org ON doctor_availability(organization_id);
CREATE INDEX idx_doctor_avail_active ON doctor_availability(is_active);

-- ─── Doctor Blocked Dates (Holidays, Leave) ──────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_blocked_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_date DATE NOT NULL,
    reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, blocked_date)
);

CREATE INDEX idx_blocked_dates_doctor ON doctor_blocked_dates(doctor_id);
CREATE INDEX idx_blocked_dates_date ON doctor_blocked_dates(blocked_date);

-- ─── Organization ↔ Doctor Link ──────────────────────────────────────────
-- An organization can have many doctors. A doctor can be in multiple orgs.
-- The fee can be overridden per-organization.
CREATE TABLE IF NOT EXISTS organization_doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    doctor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    specialization TEXT DEFAULT '',
    consultation_fee REAL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, doctor_user_id)
);

CREATE INDEX idx_org_doctors_org ON organization_doctors(organization_id);
CREATE INDEX idx_org_doctors_doctor ON organization_doctors(doctor_user_id);

-- ─── Organization Services (Lab Tests, Packages, Imaging) ────────────────
CREATE TABLE IF NOT EXISTS organization_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL DEFAULT 'lab_test'
        CHECK (service_type IN ('lab_test', 'health_package', 'imaging', 'procedure', 'consultation')),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    -- For packages: list of included tests
    included_tests TEXT[] DEFAULT '{}',
    -- For home collection support
    home_collection_available BOOLEAN DEFAULT false,
    home_collection_surcharge REAL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_services_org ON organization_services(organization_id);
CREATE INDEX idx_org_services_type ON organization_services(service_type);
CREATE INDEX idx_org_services_active ON organization_services(is_active);

-- ─── Doctor Consultation Fee Overrides ───────────────────────────────────
-- Independent doctors set their own fee. Orgs can override per-doctor.
-- Platform admin can also set a cap.
CREATE TABLE IF NOT EXISTS consultation_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = independent
    fee_type TEXT NOT NULL DEFAULT 'in_person'
        CHECK (fee_type IN ('in_person', 'online', 'home_visit')),
    amount REAL NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    is_active BOOLEAN DEFAULT true,
    set_by TEXT DEFAULT 'doctor' CHECK (set_by IN ('doctor', 'organization', 'platform')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, organization_id, fee_type)
);

CREATE INDEX idx_fees_doctor ON consultation_fees(doctor_id);
CREATE INDEX idx_fees_org ON consultation_fees(organization_id);

-- ─── RLS Policies ────────────────────────────────────────────────────────

ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_fees ENABLE ROW LEVEL SECURITY;

-- Doctor Availability: doctors see their own, patients see all active
CREATE POLICY "doctor_availability_select_all" ON doctor_availability
    FOR SELECT USING (true);
CREATE POLICY "doctor_availability_manage_own" ON doctor_availability
    FOR ALL USING (doctor_id = auth.uid());

-- Blocked Dates: doctors manage their own
CREATE POLICY "blocked_dates_select_all" ON doctor_blocked_dates
    FOR SELECT USING (true);
CREATE POLICY "blocked_dates_manage_own" ON doctor_blocked_dates
    FOR ALL USING (doctor_id = auth.uid());

-- Org Doctors: everyone can see, org owner manages
CREATE POLICY "org_doctors_select_all" ON organization_doctors
    FOR SELECT USING (true);
CREATE POLICY "org_doctors_manage_by_org" ON organization_doctors
    FOR ALL USING (
        organization_id IN (
            SELECT id FROM organizations WHERE user_id = auth.uid()
        )
    );

-- Org Services: everyone can see, org owner manages
CREATE POLICY "org_services_select_all" ON organization_services
    FOR SELECT USING (true);
CREATE POLICY "org_services_manage_by_org" ON organization_services
    FOR ALL USING (
        organization_id IN (
            SELECT id FROM organizations WHERE user_id = auth.uid()
        )
    );

-- Consultation Fees: everyone can see, doctor or org manages
CREATE POLICY "fees_select_all" ON consultation_fees
    FOR SELECT USING (true);
CREATE POLICY "fees_manage_own" ON consultation_fees
    FOR ALL USING (doctor_id = auth.uid());
