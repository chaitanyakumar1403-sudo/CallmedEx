-- ============================================================================
-- CallMedex Complete Production Supabase Schema Migration (v2.0)
-- Copy and paste this script directly into the Supabase SQL Editor to set up
-- all required tables, indexes, constraints, and RLS policies cleanly.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. Extend user roles ──────────────────────────────────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient','doctor','phlebotomist','organization','staff','pharmacy','nurse','ambulance','admin','supervisor'));


-- Add registration_status to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_status TEXT DEFAULT 'active';

-- ─── 2. Universal Dispatch Requests ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispatch_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    patient_id UUID REFERENCES users(id),
    provider_type TEXT NOT NULL,  -- 'nurse','phlebotomist','doctor','ambulance','pharmacy_delivery'
    service_subtype TEXT,         -- 'wound_dressing','injection','blood_collection' etc.
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

-- Update status check constraint to include samples_delivered_to_lab
ALTER TABLE dispatch_requests DROP CONSTRAINT IF EXISTS dispatch_requests_status_check;
ALTER TABLE dispatch_requests ADD CONSTRAINT dispatch_requests_status_check
  CHECK (status IN (
    'searching','provider_notified','provider_accepted','en_route',
    'arrived','in_progress','samples_delivered_to_lab','completed','cancelled','no_provider'
  ));

CREATE INDEX IF NOT EXISTS idx_dispatch_requests_patient ON dispatch_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_requests_provider ON dispatch_requests(assigned_provider_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_requests_status ON dispatch_requests(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_requests_type ON dispatch_requests(provider_type);

ALTER TABLE dispatch_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients view own dispatch requests" ON dispatch_requests
    FOR SELECT USING (auth.uid() = patient_id);

-- ─── 3. Universal Provider Locations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    provider_type TEXT NOT NULL,   -- 'nurse','phlebotomist','doctor','ambulance','pharmacy_delivery'
    is_online BOOLEAN DEFAULT false,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    speed_kmh DOUBLE PRECISION,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_locations_user ON provider_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_locations_online ON provider_locations(is_online);
CREATE INDEX IF NOT EXISTS idx_provider_locations_type ON provider_locations(provider_type);

-- ─── 4. Dispatch Offers ─────────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_dispatch_offers_request ON dispatch_offers(dispatch_request_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_offers_provider ON dispatch_offers(provider_id);

-- ─── 5. Nurses Table ────────────────────────────────────────────────────────
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
    verification_status TEXT DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nurses_user ON nurses(user_id);
CREATE INDEX IF NOT EXISTS idx_nurses_online ON nurses(is_online);

-- ─── 6. Pharmacy Inventory Table ─────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_sku ON pharmacy_inventory(sku);

-- ─── 7. Legal Documents & Acceptances ───────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_token ON legal_acceptances(mou_token);

-- ─── 8. Booking History (Audit Trail) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_history_booking ON booking_history(booking_id);

-- ─── 9. Extend Bookings status check to include pending_review ──────────────
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending','pending_review','searching','provider_notified','provider_accepted',
    'confirmed','checked_in','in_progress','completed','cancelled','no_show'
  ));

