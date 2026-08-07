BEGIN;

-- 1. Patient Biomarkers Time-Series Table
CREATE TABLE IF NOT EXISTS patient_biomarkers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    observation_code TEXT NOT NULL,
    observation_name TEXT NOT NULL,
    value_number NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    source_report_job_id UUID REFERENCES report_jobs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_biomarkers_patient_time
    ON patient_biomarkers(patient_id, recorded_at DESC);

ALTER TABLE public.patient_biomarkers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all access" ON public.patient_biomarkers;
CREATE POLICY "Deny all access" ON public.patient_biomarkers
    FOR ALL TO public USING (false) WITH CHECK (false);

-- 2. Doctor Briefings Cache Table
CREATE TABLE IF NOT EXISTS doctor_briefings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    specialty_type TEXT NOT NULL,
    summary_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_briefings_patient
    ON doctor_briefings(patient_id, specialty_type);

ALTER TABLE public.doctor_briefings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all access" ON public.doctor_briefings;
CREATE POLICY "Deny all access" ON public.doctor_briefings
    FOR ALL TO public USING (false) WITH CHECK (false);

-- 3. Emergency SOS Contacts Table
CREATE TABLE IF NOT EXISTS emergency_sos_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_sos_patient
    ON emergency_sos_contacts(patient_id) WHERE is_active = TRUE;

ALTER TABLE public.emergency_sos_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all access" ON public.emergency_sos_contacts;
CREATE POLICY "Deny all access" ON public.emergency_sos_contacts
    FOR ALL TO public USING (false) WITH CHECK (false);

-- 4. Patient Medications Table
CREATE TABLE IF NOT EXISTS patient_medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    total_pills INT NOT NULL,
    remaining_pills INT NOT NULL,
    pills_per_day INT NOT NULL DEFAULT 1,
    refill_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_medications_patient
    ON patient_medications(patient_id);

ALTER TABLE public.patient_medications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all access" ON public.patient_medications;
CREATE POLICY "Deny all access" ON public.patient_medications
    FOR ALL TO public USING (false) WITH CHECK (false);

COMMIT;

NOTIFY pgrst, 'reload schema';
