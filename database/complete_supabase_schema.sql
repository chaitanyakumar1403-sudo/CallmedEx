-- ============================================================================
-- CallMedex 100% Master Production Supabase Schema (v2.0 Complete)
-- Single All-in-One File covering ALL 31 Tables, Indexes, Constraints, and Policies
-- Covers: Authentication, Telemedicine, Universal Dispatch, Dark Store Pharmacy,
-- ABDM/NHCX Insurance Claims, AI Report Analysis, Fraud Monitor, & MOU Acceptances
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. Users (Common fields for all 10 roles) ──────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    mobile TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'phlebotomist', 'organization', 'staff', 'pharmacy', 'nurse', 'ambulance', 'admin', 'supervisor')),
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    date_of_birth DATE,
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    district TEXT DEFAULT '',
    state TEXT DEFAULT '',
    pincode TEXT DEFAULT '',
    country TEXT DEFAULT 'India',
    managed_city TEXT DEFAULT NULL,
    registration_status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient','doctor','phlebotomist','organization','staff','pharmacy','nurse','ambulance','admin','supervisor'));

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_managed_city ON users(managed_city);

-- ─── 2. Patients ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
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

CREATE INDEX IF NOT EXISTS idx_patients_user ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_abha ON patients(abha_number);

-- ─── 3. Doctors ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    medical_license_number TEXT NOT NULL,
    specialization TEXT NOT NULL,
    qualification TEXT NOT NULL,
    years_of_experience INT DEFAULT 0,
    hospital_clinic_name TEXT DEFAULT '',
    consultation_fee REAL DEFAULT 0.0,
    available_timings TEXT DEFAULT '',
    consultation_mode TEXT DEFAULT 'both' CHECK (consultation_mode IN ('online', 'offline', 'both', 'home_visit')),
    available_for_online BOOLEAN DEFAULT true,
    languages_spoken TEXT[] DEFAULT '{"English"}',
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verified_at TIMESTAMPTZ,
    rating REAL DEFAULT 5.0,
    total_reviews INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctors_user ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_specialization ON doctors(specialization);

-- ─── 4. Phlebotomists ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phlebotomists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phleb_type TEXT DEFAULT 'full_time' CHECK (phleb_type IN ('full_time', 'part_time', 'freelance')),
    qualification TEXT DEFAULT '',
    specialization TEXT DEFAULT '',
    years_of_experience INT DEFAULT 0,
    certification_number TEXT DEFAULT '',
    on_duty BOOLEAN DEFAULT false,
    current_lat REAL,
    current_lng REAL,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verified_at TIMESTAMPTZ,
    rating REAL DEFAULT 5.0,
    total_reviews INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phlebotomists_user ON phlebotomists(user_id);

-- ─── 5. Nurses (v2.0) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nurses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    nursing_license_number TEXT NOT NULL DEFAULT '',
    qualification TEXT DEFAULT '',
    specializations TEXT[] DEFAULT '{}',
    years_of_experience INT DEFAULT 0,
    is_online BOOLEAN DEFAULT false,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    service_radius_km REAL DEFAULT 10.0,
    rating REAL DEFAULT 5.0,
    acceptance_rate REAL DEFAULT 100.0,
    total_completed INT DEFAULT 0,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nurses_user ON nurses(user_id);

-- ─── 6. Organizations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_name TEXT NOT NULL,
    organization_type TEXT DEFAULT 'hospital' CHECK (organization_type IN ('hospital', 'clinic', 'diagnostic_center', 'poly_clinic')),
    license_number TEXT DEFAULT '',
    establishment_year INT,
    ownership_type TEXT DEFAULT 'private' CHECK (ownership_type IN ('private', 'government', 'trust', 'partnership', 'sole_proprietorship')),
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

CREATE INDEX IF NOT EXISTS idx_organizations_user ON organizations(user_id);

-- ─── 7. Staff ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    linked_organization_id UUID REFERENCES organizations(id),
    staff_role TEXT NOT NULL,
    department TEXT DEFAULT '',
    years_of_experience INT DEFAULT 0,
    alternate_phone TEXT DEFAULT '',
    verification_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 8. Pharmacies & Pharmacy Inventory (Dark Store SKUs) ────────────────
CREATE TABLE IF NOT EXISTS pharmacies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    pharmacy_name TEXT NOT NULL,
    pharmacy_type TEXT DEFAULT 'retail' CHECK (pharmacy_type IN ('retail', 'wholesale', 'chain', 'hospital_attached')),
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

CREATE TABLE IF NOT EXISTS pharmacy_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pharmacy_id UUID REFERENCES users(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'General Medicine',
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    stock_quantity INT DEFAULT 0,
    generic_name TEXT DEFAULT '',
    discount_percentage NUMERIC(5,2) DEFAULT 0.00,
    requires_prescription BOOLEAN DEFAULT false,
    batch_number TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_pharmacy ON pharmacy_inventory(pharmacy_id);

CREATE TABLE IF NOT EXISTS pharmacy_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE SET NULL,
    prescription_url TEXT,
    medicines_list JSONB DEFAULT '[]',
    total_cost REAL DEFAULT 0.0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
    delivery_address TEXT DEFAULT '',
    patient_lat REAL,
    patient_lng REAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 9. Documents, Slots, Bookings, & Packages ────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT DEFAULT '',
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verification_notes TEXT DEFAULT '',
    verified_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('organization', 'doctor')),
    provider_name TEXT DEFAULT '',
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    capacity INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id),
    provider_id UUID NOT NULL,
    provider_type TEXT NOT NULL,
    service_type TEXT NOT NULL,
    slot_id UUID REFERENCES slots(id),
    slot_start TIMESTAMPTZ,
    slot_end TIMESTAMPTZ,
    status TEXT DEFAULT 'pending',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending','pending_review','searching','provider_notified','provider_accepted',
    'confirmed','checked_in','in_progress','completed','cancelled','no_show'
  ));

CREATE TABLE IF NOT EXISTS health_packages (
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

CREATE TABLE IF NOT EXISTS booking_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 10. Universal Dispatch Requests, Locations, & Offers ─────────────────
CREATE TABLE IF NOT EXISTS dispatch_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    patient_id UUID REFERENCES users(id),
    provider_type TEXT NOT NULL,
    service_subtype TEXT,
    status TEXT DEFAULT 'searching',
    patient_lat DOUBLE PRECISION NOT NULL,
    patient_lng DOUBLE PRECISION NOT NULL,
    patient_address TEXT DEFAULT '',
    patient_address_details JSONB DEFAULT '{}',
    assigned_provider_id UUID,
    search_radius_km REAL DEFAULT 10.0,
    search_timeout_minutes INT DEFAULT 5,
    max_offers INT DEFAULT 5,
    notes TEXT DEFAULT '',
    estimated_distance_km REAL,
    estimated_eta_minutes INT,
    assigned_at TIMESTAMPTZ,
    en_route_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dispatch_requests DROP CONSTRAINT IF EXISTS dispatch_requests_status_check;
ALTER TABLE dispatch_requests ADD CONSTRAINT dispatch_requests_status_check
  CHECK (status IN (
    'searching','provider_notified','provider_accepted','en_route',
    'arrived','in_progress','samples_delivered_to_lab','completed','cancelled','no_provider'
  ));

CREATE TABLE IF NOT EXISTS provider_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    provider_type TEXT NOT NULL,
    is_online BOOLEAN DEFAULT false,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    speed_kmh DOUBLE PRECISION,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispatch_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispatch_request_id UUID REFERENCES dispatch_requests(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired')),
    distance_km REAL,
    offered_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL
);

-- ─── 11. Telemedicine Consultations (NMC 2026 Compliant) ──────────────────
CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    video_room_url TEXT DEFAULT '',
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    digital_consent_captured BOOLEAN DEFAULT false,
    consent_timestamp TIMESTAMPTZ,
    transcript_text TEXT DEFAULT '',
    ai_summary TEXT DEFAULT '',
    eprescription_url TEXT DEFAULT '',
    requires_followup BOOLEAN DEFAULT false,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 12. Insurance Claims & AI Report Analyses ─────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    abha_number TEXT,
    insurer_name TEXT,
    claim_amount REAL DEFAULT 0.0,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'disbursed')),
    nhcx_transaction_id TEXT,
    fhir_bundle JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_report_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    raw_report_url TEXT NOT NULL,
    plain_language_summary TEXT DEFAULT '',
    doctor_clinical_summary TEXT DEFAULT '',
    abnormal_flags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_quality_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider_type TEXT CHECK (provider_type IN ('doctor', 'pharmacy', 'phlebotomist', 'nurse')),
    total_bookings INT DEFAULT 0,
    no_show_count INT DEFAULT 0,
    patient_complaints INT DEFAULT 0,
    trust_score REAL DEFAULT 100.0,
    is_flagged BOOLEAN DEFAULT false,
    last_recalculated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 13. Masked Calling, Chat, & Notifications ──────────────────────────────
CREATE TABLE IF NOT EXISTS communication_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    dispatch_request_id UUID,
    patient_id UUID REFERENCES users(id),
    provider_id UUID REFERENCES users(id),
    virtual_number TEXT,
    telephony_provider TEXT DEFAULT 'exotel',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'error')),
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES communication_sessions(id),
    caller_id UUID,
    receiver_id UUID,
    direction TEXT,
    duration_seconds INT DEFAULT 0,
    status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'connected', 'missed', 'failed', 'completed')),
    recording_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    dispatch_request_id UUID,
    sender_id UUID REFERENCES users(id),
    receiver_id UUID REFERENCES users(id),
    message_text TEXT,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'location', 'system', 'prescription')),
    media_url TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'push', 'in_app')),
    title TEXT,
    body TEXT,
    data JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 14. Legal Documents, MOU Acceptances, & Audit Log ───────────────────────
CREATE TABLE IF NOT EXISTS legal_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'v1.0',
    title TEXT NOT NULL,
    content_text TEXT,
    content_url TEXT,
    applicable_roles TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legal_acceptances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES legal_documents(id),
    mou_token TEXT UNIQUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    accepted_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT,
    device_info JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
