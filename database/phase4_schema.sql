-- ============================================================================
-- CallMedex Database Schema Update (Phase 4: Moat Features)
-- 100% Safe, Isolated Tables
-- ============================================================================

-- ─── NHCX Insurance Claims ──────────────────────────────────────────────────
CREATE TABLE insurance_claims (
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

CREATE INDEX idx_insurance_claims_patient ON insurance_claims(patient_id);
CREATE INDEX idx_insurance_claims_status ON insurance_claims(status);

ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own claims" ON insurance_claims
    FOR SELECT USING (auth.uid() = patient_id);


-- ─── AI Report Analyses ─────────────────────────────────────────────────────
CREATE TABLE ai_report_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    raw_report_url TEXT NOT NULL,
    plain_language_summary TEXT DEFAULT '',
    doctor_clinical_summary TEXT DEFAULT '',
    abnormal_flags JSONB DEFAULT '[]', -- E.g. [{"marker": "HbA1c", "value": "8.5%", "status": "high"}]
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_report_analyses_patient ON ai_report_analyses(patient_id);

ALTER TABLE ai_report_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own reports" ON ai_report_analyses
    FOR SELECT USING (auth.uid() = patient_id);


-- ─── Provider Quality Scores (Fraud Detection) ──────────────────────────────
CREATE TABLE provider_quality_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider_type TEXT CHECK (provider_type IN ('doctor', 'pharmacy', 'phlebotomist')),
    total_bookings INT DEFAULT 0,
    no_show_count INT DEFAULT 0,
    patient_complaints INT DEFAULT 0,
    trust_score REAL DEFAULT 100.0, -- Starts at 100, drops on bad behavior
    is_flagged BOOLEAN DEFAULT false,
    last_recalculated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_provider_quality_scores_provider ON provider_quality_scores(provider_id);
CREATE INDEX idx_provider_quality_scores_flagged ON provider_quality_scores(is_flagged);

ALTER TABLE provider_quality_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers view own score" ON provider_quality_scores
    FOR SELECT USING (auth.uid() = provider_id);
