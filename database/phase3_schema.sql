-- ============================================================================
-- CallMedex Database Schema Update (Phase 3: Pharmacy & Telemedicine)
-- Option B: 100% Safe, Isolated Tables
-- ============================================================================

-- ─── Pharmacy Orders (Dark Store Delivery) ──────────────────────────────────
CREATE TABLE pharmacy_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE SET NULL,
    prescription_url TEXT,
    medicines_list JSONB DEFAULT '[]', -- Struct array of {name, quantity}
    total_cost REAL DEFAULT 0.0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
    delivery_address TEXT DEFAULT '',
    patient_lat REAL,
    patient_lng REAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pharmacy_orders_patient ON pharmacy_orders(patient_id);
CREATE INDEX idx_pharmacy_orders_pharmacy ON pharmacy_orders(pharmacy_id);

ALTER TABLE pharmacy_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own orders" ON pharmacy_orders
    FOR SELECT USING (auth.uid() = patient_id);


-- ─── Consultations (Video Telemedicine - NMC 2026 Compliant) ────────────────
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL, -- Links to Phase 1 Tier B slots
    video_room_url TEXT DEFAULT '',
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    
    -- NMC 2026 Telemedicine Compliance fields
    digital_consent_captured BOOLEAN DEFAULT false,
    consent_timestamp TIMESTAMPTZ,
    
    -- AI Generated Outputs
    transcript_text TEXT DEFAULT '',
    ai_summary TEXT DEFAULT '',
    eprescription_url TEXT DEFAULT '',
    requires_followup BOOLEAN DEFAULT false,
    
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consultations_patient ON consultations(patient_id);
CREATE INDEX idx_consultations_doctor ON consultations(doctor_id);

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own consultations" ON consultations
    FOR SELECT USING (auth.uid() = patient_id);
