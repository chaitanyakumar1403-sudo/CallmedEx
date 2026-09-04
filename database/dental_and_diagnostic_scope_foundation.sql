-- ============================================================================
-- CallMedex Provider & Diagnostic Scope Foundation:
-- 1. Adds 'dentist' to users_role_check
-- 2. Adds 'dental' to bookings_service_type_check
-- 3. Creates 'dentists' table with RLS & indexes (Strictly In-Clinic Walk-in)
-- 4. Updates provider_directory view to include dentists
-- 5. Upserts 19 Canonical Dental Procedures into service_catalog
-- 6. Upserts 77 Diagnostic Center Scope items (MRI, CT, Scans, CBC, Cultures) into service_catalog
-- ============================================================================

BEGIN;

-- ─── 0. Allow 'dentist' on users ───────────────────────────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'patient','doctor','phlebotomist','organization','staff','pharmacy',
    'nurse','ambulance','admin','supervisor','processing_center',
    'dietitian','physiotherapist','dentist'
  ));

-- ─── 0b. Allow 'dental' on bookings ─────────────────────────────────────────
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_service_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_service_type_check
  CHECK (service_type IN (
    'lab_test','imaging','health_package','video_consult','home_collection',
    'doctor_appointment','nurse_visit','ambulance','pharmacy_delivery',
    'physiotherapy','consultation','home_visit','nursing_care',
    'medicine_delivery','procedure','dental'
  ));

-- ─── 1. Dentists Table (Strictly In-Clinic Walk-In) ─────────────────────────
CREATE TABLE IF NOT EXISTS dentists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    dental_license_number TEXT NOT NULL DEFAULT '',
    qualification TEXT DEFAULT '',
    specializations TEXT[] DEFAULT '{}',
    years_of_experience INT DEFAULT 0,
    clinic_name TEXT DEFAULT '',
    consultation_fee REAL DEFAULT 400.0,
    consultation_mode TEXT DEFAULT 'clinic' CHECK (consultation_mode IN ('clinic')),
    available_for_online BOOLEAN DEFAULT false,
    available_for_home_visit BOOLEAN DEFAULT false,
    scope_of_services JSONB DEFAULT '[]'::jsonb,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'rejected')),
    verified_at TIMESTAMPTZ,
    rating REAL DEFAULT NULL,
    total_reviews INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dentists_user ON dentists(user_id);
CREATE INDEX IF NOT EXISTS idx_dentists_verification ON dentists(verification_status);

-- ─── 2. Update provider_directory View ───────────────────────────────────────
CREATE OR REPLACE VIEW provider_directory WITH (security_invoker = on) AS
SELECT
    u.id AS provider_user_id,
    'organization' AS provider_type,
    o.organization_name AS display_name,
    o.organization_type AS subtype,
    u.city, u.state,
    NULL::double precision AS lat,
    NULL::double precision AS lng,
    5.0::real AS rating,
    o.verification_status,
    COALESCE(ps.is_listed, true) AS is_listed,
    COALESCE(ps.home_service_enabled, false) AS home_service_enabled,
    u.district
FROM organizations o
JOIN users u ON u.id = o.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(o.organization_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'doctor', u.full_name, d.specialization,
    u.city, u.state, NULL, NULL, d.rating, d.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, false),
    u.district
FROM doctors d
JOIN users u ON u.id = d.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(u.full_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'pharmacy', ph.pharmacy_name, ph.pharmacy_type,
    u.city, u.state, NULL, NULL, 5.0, ph.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, ph.home_delivery),
    u.district
FROM pharmacies ph
JOIN users u ON u.id = ph.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(ph.pharmacy_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'dietitian', u.full_name, array_to_string(dt.specializations, ', '),
    u.city, u.state, NULL, NULL, dt.rating, dt.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, dt.available_for_home_visit),
    u.district
FROM dietitians dt
JOIN users u ON u.id = dt.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(u.full_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'physiotherapist', u.full_name, array_to_string(pt.specializations, ', '),
    u.city, u.state, pt.current_lat, pt.current_lng, pt.rating, pt.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, pt.available_for_home_visit),
    u.district
FROM physiotherapists pt
JOIN users u ON u.id = pt.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(u.full_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'dentist', u.full_name, COALESCE(NULLIF(dnt.clinic_name, ''), array_to_string(dnt.specializations, ', ')),
    u.city, u.state, NULL, NULL, dnt.rating, dnt.verification_status,
    COALESCE(ps.is_listed, true), false,
    u.district
FROM dentists dnt
JOIN users u ON u.id = dnt.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(u.full_name), ''), '') <> '';

-- ─── 3. 19 Canonical Dental Procedures into service_catalog ─────────────────
INSERT INTO service_catalog (name, slug, category, sub_category, synonyms, typical_turnaround_hours, is_active, preparation, description) VALUES
('Routine Cleanings (Prophylaxis)', 'routine-cleanings-prophylaxis', 'procedure', 'dental', ARRAY['Routine Cleanings (Prophylaxis)', 'Diagnostic'], 24, true, 'Standard oral hygiene before visit.', 'Removal of plaque and tartar buildup to prevent periodontal disease.'),
('Comprehensive Exams', 'comprehensive-exams', 'procedure', 'dental', ARRAY['Comprehensive Exams', 'Diagnostic'], 24, true, 'Standard oral hygiene before visit.', 'Thorough physical evaluation of teeth, soft tissues, and oral cavity structure.'),
('Dental X-Rays', 'dental-x-rays', 'procedure', 'dental', ARRAY['Dental X-Rays', 'Diagnostic'], 24, true, 'Standard oral hygiene before visit.', 'Diagnostic imaging (bitewing/panoramic) to identify deep decay or bone loss.'),
('Fluoride Treatments', 'fluoride-treatments', 'procedure', 'dental', ARRAY['Fluoride Treatments', 'Preventive'], 24, true, 'Standard oral hygiene before visit.', 'Highly concentrated topical application to reinforce enamel against acid attack.'),
('Dental Sealants', 'dental-sealants', 'procedure', 'dental', ARRAY['Dental Sealants', 'Preventive'], 24, true, 'Standard oral hygiene before visit.', 'Protective thin composite barrier applied to deep pits/fissures of molars.'),
('Dental Fillings', 'dental-fillings', 'procedure', 'dental', ARRAY['Dental Fillings', 'Restorative'], 24, true, 'Standard oral hygiene before visit.', 'Excavation of decay followed by restoration using tooth-colored composite resin.'),
('Root Canal Therapy', 'root-canal-therapy', 'procedure', 'dental', ARRAY['Root Canal Therapy', 'Endodontic'], 24, true, 'Standard oral hygiene before visit.', 'Extirpation of infected or necrotic pulp tissue from root canals to salvage tooth.'),
('Dental Crowns (Caps)', 'dental-crowns-caps', 'procedure', 'dental', ARRAY['Dental Crowns (Caps)', 'Prosthodontic'], 24, true, 'Standard oral hygiene before visit.', 'Full-coverage custom-fabricated ceramic or porcelain prosthesis to protect weak teeth.'),
('Bridges', 'bridges', 'procedure', 'dental', ARRAY['Bridges', 'Prosthodontic'], 24, true, 'Standard oral hygiene before visit.', 'Fixed multi-unit prosthetic appliance replacing missing teeth anchored to adjacent abutments.'),
('Dentures', 'dentures', 'procedure', 'dental', ARRAY['Dentures', 'Prosthodontic'], 24, true, 'Standard oral hygiene before visit.', 'Removable tissue-supported complete or partial appliance to replace missing arches.'),
('Dental Implants', 'dental-implants', 'procedure', 'dental', ARRAY['Dental Implants', 'Surgical-Restorative'], 24, true, 'Standard oral hygiene before visit.', 'Surgical placement of titanium endosteal fixture serving as an artificial tooth root.'),
('Teeth Whitening', 'teeth-whitening', 'procedure', 'dental', ARRAY['Teeth Whitening', 'Cosmetic'], 24, true, 'Standard oral hygiene before visit.', 'In-office chemically activated or light-assisted bleaching process to lift internal stains.'),
('Dental Veneers', 'dental-veneers', 'procedure', 'dental', ARRAY['Dental Veneers', 'Cosmetic'], 24, true, 'Standard oral hygiene before visit.', 'Ultra-thin custom porcelain facings bonded permanently to anterior teeth surfaces.'),
('Cosmetic Bonding', 'cosmetic-bonding', 'procedure', 'dental', ARRAY['Cosmetic Bonding', 'Cosmetic'], 24, true, 'Standard oral hygiene before visit.', 'Direct application of composite materials to repair minor micro-fractures or structural diastemas.'),
('Scaling and Root Planing', 'scaling-and-root-planing', 'procedure', 'dental', ARRAY['Scaling and Root Planing', 'Periodontal'], 24, true, 'Standard oral hygiene before visit.', 'Therapeutic deep instrumentation below the gumline to clear calculus and smooth roots.'),
('Gum Grafting', 'gum-grafting', 'procedure', 'dental', ARRAY['Gum Grafting', 'Periodontal-Surgical'], 24, true, 'Standard oral hygiene before visit.', 'Surgical tissue transplantation to restore severe areas of gingival recession.'),
('Tooth Extractions', 'tooth-extractions', 'procedure', 'dental', ARRAY['Tooth Extractions', 'Oral Surgery'], 24, true, 'Standard oral hygiene before visit.', 'Surgical or non-surgical removal of non-restorable or heavily fractured teeth.'),
('Wisdom Teeth Removal', 'wisdom-teeth-removal', 'procedure', 'dental', ARRAY['Wisdom Teeth Removal', 'Oral Surgery'], 24, true, 'Standard oral hygiene before visit.', 'Surgical extraction of impacted, malposed, or symptomatic third molars.'),
('Emergency Dental Care', 'emergency-dental-care', 'procedure', 'dental', ARRAY['Emergency Dental Care', 'Emergency'], 24, true, 'Standard oral hygiene before visit.', 'Immediate triage and palliative or corrective treatment for acute abscesses or trauma.')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true;

-- ─── 4. Diagnostic Center Scope Items into service_catalog ─────────────────
INSERT INTO service_catalog (name, slug, category, sub_category, synonyms, typical_turnaround_hours, is_active, preparation, description) VALUES
('MRI BRAIN PLAIN', 'mri-brain-plain', 'imaging', 'mri', ARRAY['MRI BRAIN PLAIN'], 12, true, 'Remove metal items before scan.', 'Standard MRI BRAIN PLAIN diagnostic procedure benchmarked at Rs. 5000'),
('MRI BRAIN PLAIN WITH CONTRAST', 'mri-brain-plain-with-contrast', 'imaging', 'mri', ARRAY['MRI BRAIN PLAIN WITH CONTRAST'], 12, true, 'Remove metal items before scan.', 'Standard MRI BRAIN PLAIN WITH CONTRAST diagnostic procedure benchmarked at Rs. 8000'),
('MRI SPINE SINGLE REGION', 'mri-spine-single-region', 'imaging', 'mri', ARRAY['MRI SPINE SINGLE REGION'], 12, true, 'Remove metal items before scan.', 'Standard MRI SPINE SINGLE REGION diagnostic procedure benchmarked at Rs. 5000'),
('MRI DL SPINE', 'mri-dl-spine', 'imaging', 'mri', ARRAY['MRI DL SPINE'], 12, true, 'Remove metal items before scan.', 'Standard MRI DL SPINE diagnostic procedure benchmarked at Rs. 6000'),
('MRI CSPINE WITH CV JUNCTION', 'mri-cspine-with-cv-junction', 'imaging', 'mri', ARRAY['MRI CSPINE WITH CV JUNCTION'], 12, true, 'Remove metal items before scan.', 'Standard MRI CSPINE WITH CV JUNCTION diagnostic procedure benchmarked at Rs. 6500'),
('CERVICAL SPINE WITH BRACHIAL PLEXUS', 'cervical-spine-with-brachial-plexus', 'imaging', 'mri', ARRAY['CERVICAL SPINE WITH BRACHIAL PLEXUS'], 12, true, 'Remove metal items before scan.', 'Standard CERVICAL SPINE WITH BRACHIAL PLEXUS diagnostic procedure benchmarked at Rs. 9500'),
('MRI ABDOMEN', 'mri-abdomen', 'imaging', 'mri', ARRAY['MRI ABDOMEN'], 12, true, 'Remove metal items before scan.', 'Standard MRI ABDOMEN diagnostic procedure benchmarked at Rs. 7000'),
('MRI PELVIS', 'mri-pelvis', 'imaging', 'mri', ARRAY['MRI PELVIS'], 12, true, 'Remove metal items before scan.', 'Standard MRI PELVIS diagnostic procedure benchmarked at Rs. 7000'),
('MRI BRAIN ANGIOGRAM', 'mri-brain-angiogram', 'imaging', 'mri', ARRAY['MRI BRAIN ANGIOGRAM'], 12, true, 'Remove metal items before scan.', 'Standard MRI BRAIN ANGIOGRAM diagnostic procedure benchmarked at Rs. 8000'),
('MRI VENOGRAM - Brain', 'mri-venogram-brain', 'imaging', 'mri', ARRAY['MRI VENOGRAM - Brain'], 12, true, 'Remove metal items before scan.', 'Standard MRI VENOGRAM - Brain diagnostic procedure benchmarked at Rs. 8000'),
('MRI ANY JOINT', 'mri-any-joint', 'imaging', 'mri', ARRAY['MRI ANY JOINT'], 12, true, 'Remove metal items before scan.', 'Standard MRI ANY JOINT diagnostic procedure benchmarked at Rs. 6000'),
('ONLY CONTRAST CHARGES', 'only-contrast-charges', 'imaging', 'mri', ARRAY['ONLY CONTRAST CHARGES'], 12, true, 'Remove metal items before scan.', 'Standard ONLY CONTRAST CHARGES diagnostic procedure benchmarked at Rs. 3000'),
('MRI NECK', 'mri-neck', 'imaging', 'mri', ARRAY['MRI NECK'], 12, true, 'Remove metal items before scan.', 'Standard MRI NECK diagnostic procedure benchmarked at Rs. 6000'),
('MRI RENAL ANGIO', 'mri-renal-angio', 'imaging', 'mri', ARRAY['MRI RENAL ANGIO'], 12, true, 'Remove metal items before scan.', 'Standard MRI RENAL ANGIO diagnostic procedure benchmarked at Rs. 8000'),
('MRI BRAIN AND NECK ANGIOGRAM', 'mri-brain-and-neck-angiogram', 'imaging', 'mri', ARRAY['MRI BRAIN AND NECK ANGIOGRAM'], 12, true, 'Remove metal items before scan.', 'Standard MRI BRAIN AND NECK ANGIOGRAM diagnostic procedure benchmarked at Rs. 9000'),
('MRI FISTULOGRAM', 'mri-fistulogram', 'imaging', 'mri', ARRAY['MRI FISTULOGRAM'], 12, true, 'Remove metal items before scan.', 'Standard MRI FISTULOGRAM diagnostic procedure benchmarked at Rs. 6000'),
('MRI ORBITS', 'mri-orbits', 'imaging', 'mri', ARRAY['MRI ORBITS'], 12, true, 'Remove metal items before scan.', 'Standard MRI ORBITS diagnostic procedure benchmarked at Rs. 5000'),
('MRI PNS', 'mri-pns', 'imaging', 'mri', ARRAY['MRI PNS'], 12, true, 'Remove metal items before scan.', 'Standard MRI PNS diagnostic procedure benchmarked at Rs. 6000'),
('MRI PERIPHERAL LOWER LIMB ANGIOGRAM', 'mri-peripheral-lower-limb-angiogram', 'imaging', 'mri', ARRAY['MRI PERIPHERAL LOWER LIMB ANGIOGRAM'], 12, true, 'Remove metal items before scan.', 'Standard MRI PERIPHERAL LOWER LIMB ANGIOGRAM diagnostic procedure benchmarked at Rs. 11000'),
('MRI BRAIN WITH ORBITS', 'mri-brain-with-orbits', 'imaging', 'mri', ARRAY['MRI BRAIN WITH ORBITS'], 12, true, 'Remove metal items before scan.', 'Standard MRI BRAIN WITH ORBITS diagnostic procedure benchmarked at Rs. 7000'),
('MRI BREAST', 'mri-breast', 'imaging', 'mri', ARRAY['MRI BREAST'], 12, true, 'Remove metal items before scan.', 'Standard MRI BREAST diagnostic procedure benchmarked at Rs. 9000'),
('ABREVATION BREAST MRI FOR SCREENING', 'abrevation-breast-mri-for-screening', 'imaging', 'mri', ARRAY['ABREVATION BREAST MRI FOR SCREENING'], 12, true, 'Remove metal items before scan.', 'Standard ABREVATION BREAST MRI FOR SCREENING diagnostic procedure benchmarked at Rs. 8000'),
('MRI BREAST WITH CONTRAST', 'mri-breast-with-contrast', 'imaging', 'mri', ARRAY['MRI BREAST WITH CONTRAST'], 12, true, 'Remove metal items before scan.', 'Standard MRI BREAST WITH CONTRAST diagnostic procedure benchmarked at Rs. 9000'),
('MRI CARDIAC', 'mri-cardiac', 'imaging', 'mri', ARRAY['MRI CARDIAC'], 12, true, 'Remove metal items before scan.', 'Standard MRI CARDIAC diagnostic procedure benchmarked at Rs. 15000'),
('MRI STROKE PROTOCOL', 'mri-stroke-protocol', 'imaging', 'mri', ARRAY['MRI STROKE PROTOCOL'], 12, true, 'Remove metal items before scan.', 'Standard MRI STROKE PROTOCOL diagnostic procedure benchmarked at Rs. 8000'),
('MRI SELLA WITH CONTRAST', 'mri-sella-with-contrast', 'imaging', 'mri', ARRAY['MRI SELLA WITH CONTRAST'], 12, true, 'Remove metal items before scan.', 'Standard MRI SELLA WITH CONTRAST diagnostic procedure benchmarked at Rs. 8000'),
('MRCP', 'mrcp', 'imaging', 'mri', ARRAY['MRCP'], 12, true, 'Remove metal items before scan.', 'Standard MRCP diagnostic procedure benchmarked at Rs. 7000'),
('MRI UROGRAM', 'mri-urogram', 'imaging', 'mri', ARRAY['MRI UROGRAM'], 12, true, 'Remove metal items before scan.', 'Standard MRI UROGRAM diagnostic procedure benchmarked at Rs. 7000'),
('MRI PROSTATE', 'mri-prostate', 'imaging', 'mri', ARRAY['MRI PROSTATE'], 12, true, 'Remove metal items before scan.', 'Standard MRI PROSTATE diagnostic procedure benchmarked at Rs. 9000'),
('MRI EPILEPSY PROTOCOL', 'mri-epilepsy-protocol', 'imaging', 'mri', ARRAY['MRI EPILEPSY PROTOCOL'], 12, true, 'Remove metal items before scan.', 'Standard MRI EPILEPSY PROTOCOL diagnostic procedure benchmarked at Rs. 8000'),
('MRI DEMENTIA PROTOCOL', 'mri-dementia-protocol', 'imaging', 'mri', ARRAY['MRI DEMENTIA PROTOCOL'], 12, true, 'Remove metal items before scan.', 'Standard MRI DEMENTIA PROTOCOL diagnostic procedure benchmarked at Rs. 8000'),
('MRI HEADACHE PROTOCOL', 'mri-headache-protocol', 'imaging', 'mri', ARRAY['MRI HEADACHE PROTOCOL'], 12, true, 'Remove metal items before scan.', 'Standard MRI HEADACHE PROTOCOL diagnostic procedure benchmarked at Rs. 8000'),
('MRI DEFECOGRAPHY', 'mri-defecography', 'imaging', 'mri', ARRAY['MRI DEFECOGRAPHY'], 12, true, 'Remove metal items before scan.', 'Standard MRI DEFECOGRAPHY diagnostic procedure benchmarked at Rs. 10000'),
('3 D CT ANY REGION', '3-d-ct-any-region', 'imaging', 'ct_scans', ARRAY['3 D CT ANY REGION'], 12, true, 'Remove metal items before scan.', 'Standard 3 D CT ANY REGION diagnostic procedure benchmarked at Rs. 5000'),
('3D CT SKULL', '3d-ct-skull', 'imaging', 'ct_scans', ARRAY['3D CT SKULL'], 12, true, 'Remove metal items before scan.', 'Standard 3D CT SKULL diagnostic procedure benchmarked at Rs. 5000'),
('CT ABDOMEN PLAIN', 'ct-abdomen-plain', 'imaging', 'ct_scans', ARRAY['CT ABDOMEN PLAIN'], 12, true, 'Remove metal items before scan.', 'Standard CT ABDOMEN PLAIN diagnostic procedure benchmarked at Rs. 4000'),
('CT ABDOMEN PLAIN WITH CONTRAST', 'ct-abdomen-plain-with-contrast', 'imaging', 'ct_scans', ARRAY['CT ABDOMEN PLAIN WITH CONTRAST'], 12, true, 'Remove metal items before scan.', 'Standard CT ABDOMEN PLAIN WITH CONTRAST diagnostic procedure benchmarked at Rs. 6500'),
('CT AORTOGRAM', 'ct-aortogram', 'imaging', 'ct_scans', ARRAY['CT AORTOGRAM'], 12, true, 'Remove metal items before scan.', 'Standard CT AORTOGRAM diagnostic procedure benchmarked at Rs. 8500'),
('CT BIOPSY', 'ct-biopsy', 'imaging', 'ct_scans', ARRAY['CT BIOPSY'], 12, true, 'Remove metal items before scan.', 'Standard CT BIOPSY diagnostic procedure benchmarked at Rs. 9000'),
('CT BRAIN PLAIN', 'ct-brain-plain', 'imaging', 'ct_scans', ARRAY['CT BRAIN PLAIN'], 12, true, 'Remove metal items before scan.', 'Standard CT BRAIN PLAIN diagnostic procedure benchmarked at Rs. 2500'),
('CT CHEST PLAIN', 'ct-chest-plain', 'imaging', 'ct_scans', ARRAY['CT CHEST PLAIN'], 12, true, 'Remove metal items before scan.', 'Standard CT CHEST PLAIN diagnostic procedure benchmarked at Rs. 4000'),
('CT CHEST PLAIN WITH CONTRAST', 'ct-chest-plain-with-contrast', 'imaging', 'ct_scans', ARRAY['CT CHEST PLAIN WITH CONTRAST'], 12, true, 'Remove metal items before scan.', 'Standard CT CHEST PLAIN WITH CONTRAST diagnostic procedure benchmarked at Rs. 6500'),
('CT ENTROCLYSIS', 'ct-entroclysis', 'imaging', 'ct_scans', ARRAY['CT ENTROCLYSIS'], 12, true, 'Remove metal items before scan.', 'Standard CT ENTROCLYSIS diagnostic procedure benchmarked at Rs. 7000'),
('CT Facial Bones', 'ct-facial-bones', 'imaging', 'ct_scans', ARRAY['CT Facial Bones'], 12, true, 'Remove metal items before scan.', 'Standard CT Facial Bones diagnostic procedure benchmarked at Rs. 5000'),
('CT FNAC', 'ct-fnac', 'imaging', 'ct_scans', ARRAY['CT FNAC'], 12, true, 'Remove metal items before scan.', 'Standard CT FNAC diagnostic procedure benchmarked at Rs. 8000'),
('CT GUIDED PIGTAIL CATHETER', 'ct-guided-pigtail-catheter', 'imaging', 'ct_scans', ARRAY['CT GUIDED PIGTAIL CATHETER'], 12, true, 'Remove metal items before scan.', 'Standard CT GUIDED PIGTAIL CATHETER diagnostic procedure benchmarked at Rs. 8600'),
('CT KUB', 'ct-kub', 'imaging', 'ct_scans', ARRAY['CT KUB'], 12, true, 'Remove metal items before scan.', 'Standard CT KUB diagnostic procedure benchmarked at Rs. 4000'),
('CT MASTOIDS', 'ct-mastoids', 'imaging', 'ct_scans', ARRAY['CT MASTOIDS'], 12, true, 'Remove metal items before scan.', 'Standard CT MASTOIDS diagnostic procedure benchmarked at Rs. 4000'),
('CT NECK', 'ct-neck', 'imaging', 'ct_scans', ARRAY['CT NECK'], 12, true, 'Remove metal items before scan.', 'Standard CT NECK diagnostic procedure benchmarked at Rs. 4500'),
('CT NECK PLAIN WITH CONTRAST', 'ct-neck-plain-with-contrast', 'imaging', 'ct_scans', ARRAY['CT NECK PLAIN WITH CONTRAST'], 12, true, 'Remove metal items before scan.', 'Standard CT NECK PLAIN WITH CONTRAST diagnostic procedure benchmarked at Rs. 5500'),
('CT NECK VESSEL ANGIO', 'ct-neck-vessel-angio', 'imaging', 'ct_scans', ARRAY['CT NECK VESSEL ANGIO'], 12, true, 'Remove metal items before scan.', 'Standard CT NECK VESSEL ANGIO diagnostic procedure benchmarked at Rs. 6500'),
('CT ORBITS', 'ct-orbits', 'imaging', 'ct_scans', ARRAY['CT ORBITS'], 12, true, 'Remove metal items before scan.', 'Standard CT ORBITS diagnostic procedure benchmarked at Rs. 3700'),
('CT PCNL', 'ct-pcnl', 'imaging', 'ct_scans', ARRAY['CT PCNL'], 12, true, 'Remove metal items before scan.', 'Standard CT PCNL diagnostic procedure benchmarked at Rs. 8500'),
('CT PELVIS WITH HIP JOINTS', 'ct-pelvis-with-hip-joints', 'imaging', 'ct_scans', ARRAY['CT PELVIS WITH HIP JOINTS'], 12, true, 'Remove metal items before scan.', 'Standard CT PELVIS WITH HIP JOINTS diagnostic procedure benchmarked at Rs. 5000'),
('CT PNS (Single film)', 'ct-pns-single-film', 'imaging', 'ct_scans', ARRAY['CT PNS (Single film)'], 12, true, 'Remove metal items before scan.', 'Standard CT PNS (Single film) diagnostic procedure benchmarked at Rs. 3000'),
('CT PNS (Two films)', 'ct-pns-two-films', 'imaging', 'ct_scans', ARRAY['CT PNS (Two films)'], 12, true, 'Remove metal items before scan.', 'Standard CT PNS (Two films) diagnostic procedure benchmarked at Rs. 3500'),
('CT PNS (Three films)', 'ct-pns-three-films', 'imaging', 'ct_scans', ARRAY['CT PNS (Three films)'], 12, true, 'Remove metal items before scan.', 'Standard CT PNS (Three films) diagnostic procedure benchmarked at Rs. 3500'),
('CT TEMPORAL BONES', 'ct-temporal-bones', 'imaging', 'ct_scans', ARRAY['CT TEMPORAL BONES'], 12, true, 'Remove metal items before scan.', 'Standard CT TEMPORAL BONES diagnostic procedure benchmarked at Rs. 4000'),
('CT PULMONARY ANGIO', 'ct-pulmonary-angio', 'imaging', 'ct_scans', ARRAY['CT PULMONARY ANGIO'], 12, true, 'Remove metal items before scan.', 'Standard CT PULMONARY ANGIO diagnostic procedure benchmarked at Rs. 6500'),
('CT RENAL ANGIOGRAM', 'ct-renal-angiogram', 'imaging', 'ct_scans', ARRAY['CT RENAL ANGIOGRAM'], 12, true, 'Remove metal items before scan.', 'Standard CT RENAL ANGIOGRAM diagnostic procedure benchmarked at Rs. 8000'),
('CT SPINE ANY REGION', 'ct-spine-any-region', 'imaging', 'ct_scans', ARRAY['CT SPINE ANY REGION'], 12, true, 'Remove metal items before scan.', 'Standard CT SPINE ANY REGION diagnostic procedure benchmarked at Rs. 5000'),
('CT UPPER / LOWER LIMB ANGIORAM', 'ct-upper-lower-limb-angioram', 'imaging', 'ct_scans', ARRAY['CT UPPER / LOWER LIMB ANGIORAM'], 12, true, 'Remove metal items before scan.', 'Standard CT UPPER / LOWER LIMB ANGIORAM diagnostic procedure benchmarked at Rs. 8000'),
('CT UROGRAM', 'ct-urogram', 'imaging', 'ct_scans', ARRAY['CT UROGRAM'], 12, true, 'Remove metal items before scan.', 'Standard CT UROGRAM diagnostic procedure benchmarked at Rs. 5000'),
('CT ENTEROGRAPHY', 'ct-enterography', 'imaging', 'ct_scans', ARRAY['CT ENTEROGRAPHY'], 12, true, 'Remove metal items before scan.', 'Standard CT ENTEROGRAPHY diagnostic procedure benchmarked at Rs. 8000'),
('ULTRA SOUND SCANS', 'ultra-sound-scans', 'imaging', 'scans', ARRAY['ULTRA SOUND SCANS'], 12, true, 'Remove metal items before scan.', 'Standard ULTRA SOUND SCANS diagnostic procedure benchmarked at Rs. 1200'),
('DOPPLER', 'doppler', 'imaging', 'scans', ARRAY['DOPPLER'], 12, true, 'Remove metal items before scan.', 'Standard DOPPLER diagnostic procedure benchmarked at Rs. 2500'),
('TIFFA', 'tiffa', 'imaging', 'scans', ARRAY['TIFFA'], 12, true, 'Remove metal items before scan.', 'Standard TIFFA diagnostic procedure benchmarked at Rs. 3000'),
('ANTENATAL SCAN', 'antenatal-scan', 'imaging', 'scans', ARRAY['ANTENATAL SCAN'], 12, true, 'Remove metal items before scan.', 'Standard ANTENATAL SCAN diagnostic procedure benchmarked at Rs. 1800'),
('2D ECHO', '2d-echo', 'imaging', 'scans', ARRAY['2D ECHO'], 12, true, 'Remove metal items before scan.', 'Standard 2D ECHO diagnostic procedure benchmarked at Rs. 2200'),
('X RAY (SINGLE)', 'x-ray-single', 'imaging', 'scans', ARRAY['X RAY (SINGLE)'], 12, true, 'Remove metal items before scan.', 'Standard X RAY (SINGLE) diagnostic procedure benchmarked at Rs. 500'),
('X RAY (DOUBLE)', 'x-ray-double', 'imaging', 'scans', ARRAY['X RAY (DOUBLE)'], 12, true, 'Remove metal items before scan.', 'Standard X RAY (DOUBLE) diagnostic procedure benchmarked at Rs. 800'),
('TMT', 'tmt', 'imaging', 'scans', ARRAY['TMT'], 12, true, 'Remove metal items before scan.', 'Standard TMT diagnostic procedure benchmarked at Rs. 2000'),
('BMD', 'bmd', 'imaging', 'scans', ARRAY['BMD'], 12, true, 'Remove metal items before scan.', 'Standard BMD diagnostic procedure benchmarked at Rs. 2500'),
('MAMMOGRAM', 'mammogram', 'imaging', 'scans', ARRAY['MAMMOGRAM'], 12, true, 'Remove metal items before scan.', 'Standard MAMMOGRAM diagnostic procedure benchmarked at Rs. 2500'),
('HSG', 'hsg', 'imaging', 'scans', ARRAY['HSG'], 12, true, 'Remove metal items before scan.', 'Standard HSG diagnostic procedure benchmarked at Rs. 3500'),
('CBC', 'cbc', 'lab_test', 'blood_tests', ARRAY['CBC'], 12, true, 'Fast for 8-10 hours if recommended.', 'Standard CBC diagnostic procedure benchmarked at Rs. 400'),
('CULTURES', 'cultures', 'lab_test', 'blood_tests', ARRAY['CULTURES'], 12, true, 'Fast for 8-10 hours if recommended.', 'Standard CULTURES diagnostic procedure benchmarked at Rs. 900')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true;

COMMIT;

NOTIFY pgrst, 'reload schema';
