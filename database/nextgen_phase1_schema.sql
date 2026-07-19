-- ============================================================================
-- CallMedex Next-Gen Phase 1: Universal Provider Registration & Legal Docs
-- Run AFTER the base schema.sql and all previous phase schemas.
-- ============================================================================

-- ─── 1. Legal Documents (Version-controlled MOU/ToS/Privacy templates) ────
CREATE TABLE IF NOT EXISTS legal_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type TEXT NOT NULL,
    -- e.g. 'mou_doctor', 'mou_pharmacy', 'mou_organization', 'mou_phlebotomist',
    --      'mou_nurse', 'mou_staff', 'mou_ambulance', 'tos', 'privacy_policy', 'dpdp_consent'
    version TEXT NOT NULL DEFAULT 'v1.0',
    title TEXT NOT NULL,
    content_text TEXT,              -- Full text content for in-app display
    content_url TEXT,               -- Optional PDF URL in Supabase Storage
    applicable_roles TEXT[] DEFAULT '{}',  -- e.g. '{doctor,pharmacy,organization}'
    is_active BOOLEAN DEFAULT true,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_type ON legal_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_active ON legal_documents(is_active);

-- ─── 2. Legal Acceptances (Audit trail for every agreement) ───────────────
CREATE TABLE IF NOT EXISTS legal_acceptances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES legal_documents(id),
    mou_token TEXT UNIQUE,          -- One-time signed token from email link
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    accepted_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT,
    device_info JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user ON legal_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_token ON legal_acceptances(mou_token);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_status ON legal_acceptances(status);

ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own acceptances" ON legal_acceptances
    FOR SELECT USING (auth.uid() = user_id);

-- ─── 3. Registration status on users table ────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_status TEXT DEFAULT 'active';
-- Note: For existing users, they remain 'active'. New non-patient signups start as 'pending_mou'.

-- ─── 4. Extend user roles to include nurse, ambulance ─────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient','doctor','phlebotomist','organization','staff','pharmacy','nurse','ambulance','admin'));

-- ─── 5. Add home_visit to doctors consultation_mode ───────────────────────
ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_consultation_mode_check;
ALTER TABLE doctors ADD CONSTRAINT doctors_consultation_mode_check
  CHECK (consultation_mode IN ('in_person','online','both','home_visit'));

-- ─── 6. Fix ownership_type options ────────────────────────────────────────
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_ownership_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_ownership_type_check
  CHECK (ownership_type IN ('private','partnership','sole_proprietorship'));

-- ─── 7. Nurses Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nurses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    nursing_license_number TEXT NOT NULL DEFAULT '',
    qualification TEXT DEFAULT '',
    specializations TEXT[] DEFAULT '{}',
    -- Valid specializations: 'wound_dressing','injection','iv_infusion',
    -- 'post_operative','catheter_care','elderly_care','pediatric','icu','general'
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
CREATE INDEX IF NOT EXISTS idx_nurses_verification ON nurses(verification_status);

ALTER TABLE nurses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nurses view own profile" ON nurses
    FOR SELECT USING (auth.uid() = user_id);

-- ─── 8. Audit Log (Immutable system-wide action log) ──────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID,                  -- The user performing the action (NULL for system)
    action TEXT NOT NULL,           -- e.g. 'user.registered', 'mou.accepted', 'booking.created'
    entity_type TEXT,               -- e.g. 'user', 'booking', 'dispatch', 'legal_acceptance'
    entity_id UUID,                 -- The ID of the affected entity
    details JSONB DEFAULT '{}',     -- Arbitrary context (old/new values, metadata)
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- ─── 9. Seed default legal documents ──────────────────────────────────────
INSERT INTO legal_documents (id, document_type, version, title, content_text, applicable_roles, is_active, effective_date)
VALUES
(uuid_generate_v4(), 'mou_doctor', 'v1.0', 'Doctor MOU — CallMedex',
 E'MEMORANDUM OF UNDERSTANDING (MOU)\n\nBetween CallMeDex (\"Platform\") and the Registering Doctor (\"Partner\").\n\n1. PURPOSE\nThis MOU outlines the terms under which the Partner agrees to provide medical consultation services through the CallMeDex platform.\n\n2. RESPONSIBILITIES OF PARTNER\n- The Partner guarantees that their medical license (NMC/State Medical Council) is valid and current.\n- The Partner will honor all appointments and consultations booked through the Platform.\n- The Partner agrees to maintain patient confidentiality per DPDP Act 2023 and HIPAA guidelines.\n- Consultation fees will be determined and managed centrally by the Platform.\n\n3. RESPONSIBILITIES OF PLATFORM\n- The Platform will route patient bookings securely and manage scheduling.\n- The Platform handles payment processing and settlement.\n- The Platform provides AI-assisted verification but holds no liability for falsified credentials.\n\n4. SETTLEMENT\n- All consultation fees are collected by the Platform and settled to the Partner per the agreed commission structure.\n- Settlement cycles and rates are communicated separately.\n\n5. ACCEPTANCE\nBy clicking \"I Agree & Activate My Account\", the Partner legally binds themselves to these terms.',
 '{doctor}', true, CURRENT_DATE),

(uuid_generate_v4(), 'mou_organization', 'v1.0', 'Organization MOU — CallMedex',
 E'MEMORANDUM OF UNDERSTANDING (MOU)\n\nBetween CallMeDex (\"Platform\") and the Registering Organization (\"Partner\").\n\n1. PURPOSE\nThis MOU outlines the terms under which the Partner agrees to list their healthcare facility, services, and available staff on the CallMeDex platform.\n\n2. RESPONSIBILITIES OF PARTNER\n- The Partner guarantees that all medical licenses, establishment certificates, and staff qualifications are genuine and legally valid.\n- The Partner will honor all appointments booked through the Platform.\n- The Partner agrees to abide by ABDM data sharing and privacy regulations.\n\n3. RESPONSIBILITIES OF PLATFORM\n- The Platform agrees to route patient bookings securely.\n- The Platform handles initial AI document verification but holds no liability for falsified records.\n\n4. SETTLEMENT\n- Service fees are collected by the Platform and settled per the agreed commission structure.\n\n5. ACCEPTANCE\nBy clicking \"I Agree & Activate My Account\", the Partner legally binds themselves to these terms.',
 '{organization}', true, CURRENT_DATE),

(uuid_generate_v4(), 'mou_pharmacy', 'v1.0', 'Pharmacy MOU — CallMedex',
 E'MEMORANDUM OF UNDERSTANDING (MOU)\n\nBetween CallMeDex (\"Platform\") and the Registering Pharmacy (\"Partner\").\n\n1. PURPOSE\nThis MOU outlines the terms under which the Partner agrees to fulfill medicine orders and provide pharmaceutical services through the CallMeDex platform.\n\n2. RESPONSIBILITIES OF PARTNER\n- The Partner guarantees that their Drug License and Registration are valid.\n- The Partner will fulfill all orders placed through the Platform in a timely manner.\n- The Partner agrees to comply with all applicable drug dispensing regulations.\n\n3. RESPONSIBILITIES OF PLATFORM\n- The Platform routes orders and manages delivery logistics.\n- The Platform handles payment collection and settlement.\n\n4. ACCEPTANCE\nBy clicking \"I Agree & Activate My Account\", the Partner legally binds themselves to these terms.',
 '{pharmacy}', true, CURRENT_DATE),

(uuid_generate_v4(), 'mou_phlebotomist', 'v1.0', 'Phlebotomist MOU — CallMedex',
 E'MEMORANDUM OF UNDERSTANDING (MOU)\n\nBetween CallMeDex (\"Platform\") and the Registering Phlebotomist (\"Partner\").\n\n1. PURPOSE\nThis MOU outlines the terms under which the Partner agrees to provide home sample collection services through the CallMeDex platform.\n\n2. RESPONSIBILITIES OF PARTNER\n- The Partner guarantees valid certification (DMLT/MLT) and adherence to proper sample handling protocols.\n- The Partner will respond promptly to dispatch assignments.\n- The Partner agrees to maintain hygiene and safety standards.\n\n3. RESPONSIBILITIES OF PLATFORM\n- The Platform provides GPS-based dispatch and live tracking.\n- The Platform manages payment and settlement.\n\n4. ACCEPTANCE\nBy clicking \"I Agree & Activate My Account\", the Partner legally binds themselves to these terms.',
 '{phlebotomist}', true, CURRENT_DATE),

(uuid_generate_v4(), 'mou_nurse', 'v1.0', 'Nurse MOU — CallMedex',
 E'MEMORANDUM OF UNDERSTANDING (MOU)\n\nBetween CallMeDex (\"Platform\") and the Registering Nurse (\"Partner\").\n\n1. PURPOSE\nThis MOU outlines the terms under which the Partner agrees to provide home nursing services through the CallMeDex platform.\n\n2. RESPONSIBILITIES OF PARTNER\n- The Partner guarantees valid nursing license and qualifications.\n- The Partner will respond promptly to dispatch requests and maintain professional conduct.\n- The Partner agrees to follow medical protocols and maintain patient safety.\n\n3. RESPONSIBILITIES OF PLATFORM\n- The Platform provides GPS-based dispatch, live tracking, and masked communication.\n- The Platform manages booking, payment, and settlement.\n\n4. ACCEPTANCE\nBy clicking \"I Agree & Activate My Account\", the Partner legally binds themselves to these terms.',
 '{nurse}', true, CURRENT_DATE),

(uuid_generate_v4(), 'mou_staff', 'v1.0', 'Staff MOU — CallMedex',
 E'MEMORANDUM OF UNDERSTANDING (MOU)\n\nBetween CallMeDex (\"Platform\") and the Registering Staff Member (\"Partner\").\n\n1. PURPOSE\nThis MOU outlines the terms under which the Partner agrees to operate within an organization registered on the CallMeDex platform.\n\n2. RESPONSIBILITIES OF PARTNER\n- The Partner will use the platform responsibly and maintain patient data confidentiality.\n- The Partner will follow the operating procedures of their linked organization.\n\n3. ACCEPTANCE\nBy clicking \"I Agree & Activate My Account\", the Partner legally binds themselves to these terms.',
 '{staff}', true, CURRENT_DATE);
