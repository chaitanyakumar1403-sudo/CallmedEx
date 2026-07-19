-- ============================================================================
-- CallMedex Database Schema
-- Full Supabase/PostgreSQL schema for the healthcare marketplace platform
-- Maps to claude.md Sections 3, 4, 7, 8, 9, 10, 13, 15
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "postgis";  -- Enable for Phase 2 dispatch

-- ─── Users (Common fields for all roles) ──────────────────────────────────
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'phlebotomist', 'organization', 'staff', 'pharmacy', 'admin')),
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    date_of_birth DATE,
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    district TEXT DEFAULT '',
    state TEXT DEFAULT '',
    pincode TEXT DEFAULT '',
    country TEXT DEFAULT 'India',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_city ON users(city);

-- ─── Patients ─────────────────────────────────────────────────────────────
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    medical_history TEXT[] DEFAULT '{}',
    blood_group TEXT DEFAULT '',
    height_cm REAL,
    weight_kg REAL,
    preferred_language TEXT DEFAULT 'en',
    abha_number TEXT,
    abha_ref_id TEXT,
    consent_status TEXT DEFAULT 'pending' CHECK (consent_status IN ('pending', 'linked', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_user ON patients(user_id);
CREATE INDEX idx_patients_abha ON patients(abha_number);

-- ─── Doctors ──────────────────────────────────────────────────────────────
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    medical_license_number TEXT DEFAULT '',
    specialization TEXT DEFAULT '',
    qualification TEXT DEFAULT '',
    years_of_experience INT DEFAULT 0,
    hospital_clinic_name TEXT DEFAULT '',
    consultation_fee REAL DEFAULT 0,
    available_timings TEXT DEFAULT '',
    consultation_mode TEXT DEFAULT 'both' CHECK (consultation_mode IN ('in_person', 'online', 'both')),
    available_for_online BOOLEAN DEFAULT false,
    languages_spoken TEXT[] DEFAULT '{English}',
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doctors_user ON doctors(user_id);
CREATE INDEX idx_doctors_specialization ON doctors(specialization);
CREATE INDEX idx_doctors_verification ON doctors(verification_status);

-- ─── Phlebotomists ────────────────────────────────────────────────────────
CREATE TABLE phlebotomists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phleb_type TEXT DEFAULT 'full_time' CHECK (phleb_type IN ('part_time', 'full_time')),
    qualification TEXT DEFAULT '',
    specialization TEXT DEFAULT '',
    years_of_experience INT DEFAULT 0,
    certification_number TEXT DEFAULT '',
    on_duty BOOLEAN DEFAULT false,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    -- current_location GEOGRAPHY(Point, 4326),  -- Enable with PostGIS for Phase 2
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_phlebotomists_user ON phlebotomists(user_id);
CREATE INDEX idx_phlebotomists_duty ON phlebotomists(on_duty);

-- ─── Organizations ────────────────────────────────────────────────────────
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_name TEXT DEFAULT '',
    organization_type TEXT DEFAULT 'hospital' CHECK (organization_type IN ('polyclinic', 'hospital', 'diagnostic_center')),
    license_number TEXT DEFAULT '',
    establishment_year INT,
    ownership_type TEXT DEFAULT 'private' CHECK (ownership_type IN ('private', 'government', 'trust', 'partnership')),
    head_of_institution TEXT DEFAULT '',
    total_departments INT DEFAULT 0,
    total_staff INT DEFAULT 0,
    total_branches INT DEFAULT 1,
    operating_hours TEXT DEFAULT '',
    alternate_phone TEXT DEFAULT '',
    emergency_phone TEXT DEFAULT '',
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_user ON organizations(user_id);
CREATE INDEX idx_organizations_type ON organizations(organization_type);

-- ─── Staff ────────────────────────────────────────────────────────────────
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    linked_organization_id UUID REFERENCES organizations(id),
    staff_role TEXT DEFAULT '',
    department TEXT DEFAULT '',
    years_of_experience INT DEFAULT 0,
    alternate_phone TEXT DEFAULT '',
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staff_user ON staff(user_id);
CREATE INDEX idx_staff_org ON staff(linked_organization_id);

-- ─── Pharmacies ───────────────────────────────────────────────────────────
CREATE TABLE pharmacies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    pharmacy_name TEXT DEFAULT '',
    pharmacy_type TEXT DEFAULT 'retail' CHECK (pharmacy_type IN ('retail', 'hospital', 'clinic')),
    owner_name TEXT DEFAULT '',
    pharmacist_in_charge TEXT DEFAULT '',
    years_of_operation INT DEFAULT 0,
    operating_hours TEXT DEFAULT '',
    registration_number TEXT DEFAULT '',
    drug_license_number TEXT DEFAULT '',
    gst_number TEXT DEFAULT '',
    home_delivery BOOLEAN DEFAULT false,
    available_24x7 BOOLEAN DEFAULT false,
    service_radius_km REAL DEFAULT 5.0,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pharmacies_user ON pharmacies(user_id);
CREATE INDEX idx_pharmacies_delivery ON pharmacies(home_delivery);

-- ─── Documents (polymorphic store for all role uploads) ───────────────────
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,  -- 'medical_certificate', 'drug_license', 'aadhaar', 'id_proof', etc.
    file_url TEXT NOT NULL,
    file_name TEXT DEFAULT '',
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verification_notes TEXT DEFAULT '',
    verified_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_type ON documents(document_type);

-- ─── Slots (for Tier B slot-based booking) ────────────────────────────────
CREATE TABLE slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL,  -- References organizations or doctors
    provider_type TEXT NOT NULL CHECK (provider_type IN ('organization', 'doctor')),
    provider_name TEXT DEFAULT '',
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    capacity INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_slots_provider ON slots(provider_id);
CREATE INDEX idx_slots_date ON slots(date);
CREATE INDEX idx_slots_available ON slots(is_available);

-- ─── Bookings ─────────────────────────────────────────────────────────────
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id),
    provider_id UUID NOT NULL,
    provider_type TEXT NOT NULL,
    service_type TEXT NOT NULL CHECK (service_type IN ('lab_test', 'imaging', 'health_package', 'video_consult', 'home_collection')),
    slot_id UUID REFERENCES slots(id),
    slot_start TIMESTAMPTZ,
    slot_end TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_patient ON bookings(patient_id);
CREATE INDEX idx_bookings_provider ON bookings(provider_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- ─── Health Packages ──────────────────────────────────────────────────────
CREATE TABLE health_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    tests_included TEXT[] DEFAULT '{}',
    price REAL NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    organization_name TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_packages_org ON health_packages(organization_id);
CREATE INDEX idx_packages_active ON health_packages(is_active);

-- ─── Consent Records (DPDP Act compliance) ────────────────────────────────
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL,  -- 'data_processing', 'health_records', 'marketing', 'abdm_share'
    consent_given BOOLEAN NOT NULL,
    consent_text TEXT DEFAULT '',
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_consent_user ON consent_records(user_id);
CREATE INDEX idx_consent_type ON consent_records(consent_type);

-- ─── Row Level Security (enable per-table) ────────────────────────────────
-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- Patients can view their own records
CREATE POLICY "Patients can view own records" ON patients
    FOR SELECT USING (auth.uid() = user_id);

-- Bookings visible to the patient who created them
CREATE POLICY "Patients can view own bookings" ON bookings
    FOR SELECT USING (auth.uid() = patient_id);

-- Consent records visible to the user
CREATE POLICY "Users can view own consent" ON consent_records
    FOR SELECT USING (auth.uid() = user_id);

-- ─── Dispatches (Phlebotomist tracking Phase 2) ───────────────────────────
CREATE TABLE dispatches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id),
    booking_id UUID REFERENCES bookings(id),
    phlebotomist_id UUID REFERENCES phlebotomists(id),
    service_type TEXT DEFAULT 'home_collection',
    status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'assigned', 'en_route', 'sample_collected', 'delivered_to_lab', 'completed', 'cancelled')),
    patient_lat REAL,
    patient_lng REAL,
    patient_address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    estimated_distance_km REAL,
    assigned_at TIMESTAMPTZ,
    en_route_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dispatches_patient ON dispatches(patient_id);
CREATE INDEX idx_dispatches_phlebotomist ON dispatches(phlebotomist_id);
CREATE INDEX idx_dispatches_status ON dispatches(status);

ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own dispatches" ON dispatches
    FOR SELECT USING (auth.uid() = patient_id);
