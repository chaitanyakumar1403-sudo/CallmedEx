-- ==============================================================================
-- xray_imaging_and_dental_services.sql
-- Ingests canonical X-Ray, Spine X-Ray, ECG, PFT, Audiometry, and Dental procedures
-- from CallMedex master specifications into service_catalog.
-- Idempotent: uses ON CONFLICT (slug) DO UPDATE.
-- ==============================================================================

-- 1. RADIOLOGY & DIAGNOSTIC IMAGING SERVICES (from X RAY PRICE.xlsx)
INSERT INTO service_catalog (
    name, slug, category, sub_category, synonyms,
    typical_turnaround_hours, is_active, preparation, description
) VALUES
(
    'X-Ray (Single View)',
    'x-ray-single',
    'imaging',
    'xray',
    ARRAY['X-Ray Single', 'X-Ray (Single)', 'Plain Radiography 1 View', 'Chest X-Ray Single View', 'Digital X-Ray Single'],
    4,
    true,
    'Remove metallic jewelry, body piercings, and belts prior to examination.',
    'High-resolution digital radiography single projection for bone, joint, or pulmonary diagnosis.'
),
(
    'X-Ray (Double View)',
    'x-ray-double',
    'imaging',
    'xray',
    ARRAY['X-Ray Double', 'X-Ray (Double)', 'X-Ray 2 Views', 'AP and Lateral View', 'Chest X-Ray PA and Lateral'],
    4,
    true,
    'Remove metallic jewelry, body piercings, and belts prior to examination.',
    'Two orthogonal digital projections (Anteroposterior and Lateral) for structural alignment.'
),
(
    'Spine X-Ray (Single View)',
    'spine-x-ray-single',
    'imaging',
    'xray',
    ARRAY['Spine X-Ray Single', 'Spine X-Ray (Single)', 'Cervical Spine X-Ray', 'Lumbar Spine X-Ray Single', 'Thoracic Spine 1 View'],
    4,
    true,
    'Wear loose, comfortable cotton clothing without metal zippers.',
    'Targeted digital spinal radiography evaluating vertebral alignment, disc heights, and curvature.'
),
(
    'Spine X-Ray (Double View)',
    'spine-x-ray-double',
    'imaging',
    'xray',
    ARRAY['Spine X-Ray Double', 'Spine X-Ray (Double)', 'Spine AP and Lateral', 'Lumbosacral Spine 2 Views', 'Cervical Spine AP Lat'],
    4,
    true,
    'Wear loose, comfortable cotton clothing without metal zippers.',
    'Dual-view AP and Lateral spinal imaging diagnosing spondylosis, scoliosis, and degenerative changes.'
),
(
    'ECG (12-Lead Resting)',
    'ecg-12-lead',
    'imaging',
    'ecg_echo',
    ARRAY['ECG', 'Electrocardiogram', '12 Lead ECG', 'Resting ECG', 'Cardiogram'],
    2,
    true,
    'Avoid strenuous exercise and caffeinated beverages 30 minutes before testing.',
    'Certified 12-lead electrocardiographic tracing evaluating cardiac electrical conduction and rhythm.'
),
(
    'Pulmonary Function Test (PFT)',
    'pft-spirometry',
    'imaging',
    'pft',
    ARRAY['PFT', 'Pulmonary Function Test', 'Spirometry', 'Lung Function Test', 'FVC Spirometry'],
    4,
    true,
    'Do not take short-acting bronchodilator inhalers for 4 hours before test unless advised by doctor.',
    'Comprehensive spirometric evaluation of forced vital capacity (FVC), FEV1, and airway resistance.'
),
(
    'Audiometry (Hearing Evaluation)',
    'audiometry-hearing-test',
    'imaging',
    'audiometry',
    ARRAY['Audiometry', 'PTA', 'Pure Tone Audiometry', 'Hearing Test', 'Audiogram', 'Air and Bone Conduction'],
    3,
    true,
    'Avoid exposure to loud environments or headphones for 14 hours prior to evaluation.',
    'Certified pure-tone audiometric threshold testing assessing air and bone conduction hearing profiles.'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    sub_category = EXCLUDED.sub_category,
    synonyms = EXCLUDED.synonyms,
    typical_turnaround_hours = EXCLUDED.typical_turnaround_hours,
    is_active = EXCLUDED.is_active,
    preparation = EXCLUDED.preparation,
    description = EXCLUDED.description;

-- 2. DENTAL PROCEDURES (from CALL MEDEX - DENTAL PROCEDURE.xlsx)
INSERT INTO service_catalog (
    name, slug, category, sub_category, synonyms,
    typical_turnaround_hours, is_active, preparation, description
) VALUES
(
    'Routine Dental Cleanings (Prophylaxis)',
    'routine-cleanings-prophylaxis',
    'dental',
    'preventive',
    ARRAY['Dental Cleaning', 'Teeth Scaling', 'Prophylaxis', 'Oral Cleaning'],
    1,
    true,
    'Brush teeth normally prior to your appointment.',
    'Removal of plaque and calculus buildup to prevent gingivitis and periodontal disease.'
),
(
    'Comprehensive Oral Examination',
    'comprehensive-oral-exam',
    'dental',
    'diagnostic',
    ARRAY['Dental Exam', 'Oral Checkup', 'Dental Consultation'],
    1,
    true,
    'Bring past dental radiographs or dental history if available.',
    'Thorough physical examination of teeth, gingival tissues, bite occlusion, and oral cavity structure.'
),
(
    'Root Canal Therapy',
    'root-canal-therapy',
    'dental',
    'endodontic',
    ARRAY['RCT', 'Root Canal', 'Endodontic Treatment', 'Tooth Nerve Treatment'],
    2,
    true,
    'Have a light meal prior to procedure unless advised otherwise.',
    'Extirpation of infected or necrotic pulp tissue from root canals to preserve natural tooth structure.'
),
(
    'Dental Crowns (Caps)',
    'dental-crowns-caps',
    'dental',
    'prosthodontic',
    ARRAY['Dental Crown', 'Tooth Cap', 'Ceramic Crown', 'Zirconia Crown'],
    24,
    true,
    'Standard oral hygiene.',
    'Full-coverage custom-fabricated ceramic or zirconia prosthesis restoring compromised teeth.'
),
(
    'Tooth Extractions',
    'tooth-extractions',
    'dental',
    'oral_surgery',
    ARRAY['Tooth Removal', 'Extraction', 'Dental Surgery'],
    1,
    true,
    'Inform dentist of current blood thinners or anticoagulant medications.',
    'Surgical or non-surgical removal of non-restorable or fractured teeth under local anesthesia.'
),
(
    'Wisdom Teeth Removal',
    'wisdom-teeth-removal',
    'dental',
    'oral_surgery',
    ARRAY['Wisdom Tooth Surgery', 'Impacted Molar Removal', 'Third Molar Extraction'],
    2,
    true,
    'Pre-procedure OPG panoramic X-ray required.',
    'Surgical extraction of impacted, malposed, or symptomatic third molars.'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    sub_category = EXCLUDED.sub_category,
    synonyms = EXCLUDED.synonyms,
    typical_turnaround_hours = EXCLUDED.typical_turnaround_hours,
    is_active = EXCLUDED.is_active,
    preparation = EXCLUDED.preparation,
    description = EXCLUDED.description;
