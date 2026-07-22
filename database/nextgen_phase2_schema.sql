-- ============================================================================
-- CallMedex Next-Gen Phase 2: Universal Booking & Dispatch Engine
-- Run AFTER nextgen_phase1_schema.sql
-- ============================================================================

-- ─── 1. Extend booking service types and statuses ─────────────────────────
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_service_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_service_type_check
  CHECK (service_type IN (
    'lab_test','imaging','health_package','video_consult','home_collection',
    'doctor_appointment','nurse_visit','ambulance','pharmacy_delivery','physiotherapy'
  ));

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending','searching','provider_notified','provider_accepted',
    'confirmed','checked_in','in_progress','completed','cancelled','no_show'
  ));

-- ─── 2. Booking History (Audit trail for every status change) ─────────────
CREATE TABLE IF NOT EXISTS booking_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID,           -- user_id of who triggered the change (NULL for system)
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_history_booking ON booking_history(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_history_created ON booking_history(created_at);

-- ─── 3. Universal Dispatch Requests ──────────────────────────────────────
-- Replaces the phlebotomist-only dispatches table with a universal one
CREATE TABLE IF NOT EXISTS dispatch_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    patient_id UUID REFERENCES users(id),
    provider_type TEXT NOT NULL,  -- 'nurse','phlebotomist','doctor','ambulance','pharmacy_delivery'
    service_subtype TEXT,         -- 'wound_dressing','injection','blood_collection' etc.
    status TEXT DEFAULT 'searching' CHECK (status IN (
        'searching','provider_notified','provider_accepted','en_route',
        'arrived','in_progress','samples_delivered_to_lab','completed','cancelled','no_provider'
    )),

    patient_lat DOUBLE PRECISION NOT NULL,
    patient_lng DOUBLE PRECISION NOT NULL,
    patient_address TEXT DEFAULT '',
    patient_address_details JSONB DEFAULT '{}',  -- {house_number, landmark, apartment, floor}
    assigned_provider_id UUID,
    search_radius_km REAL DEFAULT 10.0,
    search_timeout_minutes INT DEFAULT 5,
    max_offers INT DEFAULT 5,     -- Max number of providers to notify simultaneously
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

CREATE INDEX IF NOT EXISTS idx_dispatch_requests_patient ON dispatch_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_requests_provider ON dispatch_requests(assigned_provider_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_requests_status ON dispatch_requests(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_requests_type ON dispatch_requests(provider_type);

ALTER TABLE dispatch_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients view own dispatch requests" ON dispatch_requests
    FOR SELECT USING (auth.uid() = patient_id);

-- ─── 4. Dispatch Offers (Individual notifications sent to providers) ──────
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
CREATE INDEX IF NOT EXISTS idx_dispatch_offers_status ON dispatch_offers(status);

ALTER TABLE dispatch_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers view own offers" ON dispatch_offers
    FOR SELECT USING (auth.uid() = provider_id);

-- ─── 5. Provider Locations (Universal for all field providers) ────────────
CREATE TABLE IF NOT EXISTS provider_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    provider_type TEXT NOT NULL,   -- 'nurse','phlebotomist','doctor','ambulance'
    is_online BOOLEAN DEFAULT false,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    heading REAL,                  -- direction of travel in degrees
    speed_kmh REAL                 -- current speed for ETA calculation
);

CREATE INDEX IF NOT EXISTS idx_provider_locations_online ON provider_locations(is_online);
CREATE INDEX IF NOT EXISTS idx_provider_locations_type ON provider_locations(provider_type);
CREATE INDEX IF NOT EXISTS idx_provider_locations_user ON provider_locations(user_id);
