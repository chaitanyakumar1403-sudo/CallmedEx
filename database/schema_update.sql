
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
