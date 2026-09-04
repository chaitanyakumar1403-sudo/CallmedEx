"""
CallMedex Master Scope of Services & Tariff Catalogs
Extracted directly from partner agreements and master fee benchmarks:
- Doctors: CALLMedEx_Doctor_Services_Scope_and_Pricing.xlsx
- Dietitians: CALLMEDEX_Dietetic_Services_Terms_and_Conditions.docx
- Physiotherapists: PHYSIOTHERAPY_SCOPE_SERVICES.xlsx & PHYSIOTHERAPIST.docx
- Nurses: CALLMedEx_Home_Nursing_Scope_and_Pricing.xlsx

Enforces the authentic 80/20 commercial split:
- 80% Net Provider Remuneration
- 20% CallMedex Technology & Administrative Fee
"""
from typing import List, Dict, Any, Optional

# ─── 1. Doctor Master Scope ──────────────────────────────────────────────────
DOCTOR_MASTER_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "doc_tele_gp",
        "category": "Tele / Video Consultation",
        "service_name": "General Physician Video Consult (Acute symptoms, Cold/Fever/Cough)",
        "modality": "online",
        "duration": "15 Mins Video",
        "benchmark_price": 400.0,
        "description": "Evidence-based clinical triage, digital prescription (e-Rx), and symptom evaluation.",
    },
    {
        "id": "doc_tele_specialist",
        "category": "Tele / Video Consultation",
        "service_name": "Specialist Doctor Video Consult (MD/MS: Internal Med, Pediatrics, Derma)",
        "modality": "online",
        "duration": "20 Mins Video",
        "benchmark_price": 700.0,
        "description": "Comprehensive specialist diagnostic review, chronic care management, and drug therapy.",
    },
    {
        "id": "doc_tele_superspecialist",
        "category": "Tele / Video Consultation",
        "service_name": "Super-Specialist Video Consult (DM/MCh: Cardiology, Neurology, Endocrinology)",
        "modality": "online",
        "duration": "25 Mins Video",
        "benchmark_price": 1200.0,
        "description": "Advanced organ-specific tertiary review, surgical opinion, and secondary guidance.",
    },
    {
        "id": "doc_tele_followup",
        "category": "Tele / Video Consultation",
        "service_name": "Follow-Up Teleconsultation & Lab Report Review (Within 7 Days)",
        "modality": "online",
        "duration": "10 Mins Video",
        "benchmark_price": 250.0,
        "description": "Review of biomarker test results, treatment response audit, and dosage titrations.",
    },
    {
        "id": "doc_tele_chronic",
        "category": "Tele / Video Consultation",
        "service_name": "Chronic Disease Management Follow-up (Diabetes, HTN, Thyroid review)",
        "modality": "online",
        "duration": "15 Mins Video",
        "benchmark_price": 450.0,
        "description": "Metabolic stability monitoring, long-term prescription renewal, and lifestyle guidance.",
    },
    {
        "id": "doc_clinic_gp",
        "category": "Clinic / Center Consultation",
        "service_name": "General Physician In-Person Consultation & Clinical Examination",
        "modality": "clinic",
        "duration": "Per Outpatient Visit",
        "benchmark_price": 500.0,
        "description": "Physical clinical examination, auscultation, palpation, and systemic evaluation.",
    },
    {
        "id": "doc_clinic_specialist",
        "category": "Clinic / Center Consultation",
        "service_name": "Specialist Doctor Consultation (MD/MS - Ortho, OBG, Pediatrics, ENT)",
        "modality": "clinic",
        "duration": "Per Outpatient Visit",
        "benchmark_price": 800.0,
        "description": "In-clinic physical examination by board-certified clinical specialist.",
    },
    {
        "id": "doc_clinic_superspecialist",
        "category": "Clinic / Center Consultation",
        "service_name": "Super-Specialist Consultation (Cardiology, Gastroenterology, Urology)",
        "modality": "clinic",
        "duration": "Per Outpatient Visit",
        "benchmark_price": 1500.0,
        "description": "In-person clinical evaluation by sub-specialty DM/MCh consultant.",
    },
    {
        "id": "doc_home_gp",
        "category": "Doctor Home Visit",
        "service_name": "General Physician Comprehensive Home Visit & Bedside Examination",
        "modality": "home",
        "duration": "Per Home Visit (45m)",
        "benchmark_price": 1200.0,
        "description": "Bedside clinical examination, vitals review, and treatment initiation at patient residence.",
    },
    {
        "id": "doc_home_specialist",
        "category": "Doctor Home Visit",
        "service_name": "Specialist Doctor Home Visit (Internal Medicine, Diabetology)",
        "modality": "home",
        "duration": "Per Home Visit (45m)",
        "benchmark_price": 1800.0,
        "description": "Specialist physician bedside assessment and treatment plan modification.",
    },
    {
        "id": "doc_home_geriatric",
        "category": "Doctor Home Visit",
        "service_name": "Geriatric / Bed-Bound Frail Patient Home Comprehensive Evaluation",
        "modality": "home",
        "duration": "Per Home Visit (45m)",
        "benchmark_price": 1500.0,
        "description": "Holistic elderly health audit, polypharmacy rationalization, and caregiver counselling.",
    },
    {
        "id": "doc_home_palliative",
        "category": "Doctor Home Visit",
        "service_name": "Palliative / End-of-Life Supportive Care Doctor Home Visit",
        "modality": "home",
        "duration": "Per Home Visit (60m)",
        "benchmark_price": 2200.0,
        "description": "Pain titration, symptom relief, and compassionate supportive palliative home care.",
    },
]

# ─── 2. Dietitian Master Scope ───────────────────────────────────────────────
DIETITIAN_MASTER_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "diet_tele_consult",
        "category": "Tele-Dietetics & Online Care",
        "service_name": "Dietitian Online Teleconsultation (Dietary Recall & Meal Plan)",
        "modality": "online",
        "duration": "Per Consultation (20-30 min)",
        "benchmark_price": 400.0,
        "description": "Audio/video dietary assessment, 24-hour nutritional recall, and customized digital meal chart.",
    },
    {
        "id": "diet_clinic_consult",
        "category": "Center & Clinic Walk-In",
        "service_name": "Center Walk-In Dietitian Clinical Consultation",
        "modality": "clinic",
        "duration": "Per Clinic Visit (30 min)",
        "benchmark_price": 500.0,
        "description": "Face-to-face nutritional counselling, physical anthropometric measurements, and guidance.",
    },
    {
        "id": "diet_home_visit",
        "category": "Home Dietetic Services",
        "service_name": "Dietitian Comprehensive Home Visit (Pantry Audit & Family Counselling)",
        "modality": "home",
        "duration": "Per Home Visit (45-60 min)",
        "benchmark_price": 800.0,
        "description": "Bedside nutritional assessment, kitchen pantry audit, cooking oil/salt evaluation, and family meal planning.",
    },
    {
        "id": "diet_specialist_mnt",
        "category": "Medical Nutrition Therapy (MNT)",
        "service_name": "Specialist Clinical Nutrition Visit (Diabetic, Renal, Cardiac MNT)",
        "modality": "hybrid",
        "duration": "Per Consultation (30-45 min)",
        "benchmark_price": 800.0,
        "description": "Specialized therapeutic diet planning for uncontrolled diabetes, CKD, heart disease, or post-operative recovery.",
    },
    {
        "id": "diet_followup",
        "category": "Follow-Up & Monitoring",
        "service_name": "Follow-Up Diet Review & Plan Modification",
        "modality": "online",
        "duration": "Per Review (15 min)",
        "benchmark_price": 300.0,
        "description": "Weight trend evaluation, compliance tracking, and caloric adjustment.",
    },
    {
        "id": "diet_body_composition",
        "category": "Assessment & Diagnostics",
        "service_name": "Body Composition Analysis (BCA/BIA) & Anthropometric Assessment",
        "modality": "clinic",
        "duration": "Per Assessment",
        "benchmark_price": 500.0,
        "description": "Segmental body fat, muscle mass, visceral fat, and basal metabolic rate (BMR) scanning.",
    },
    {
        "id": "diet_preventive_wellness",
        "category": "Preventive & Lifestyle",
        "service_name": "Preventive Lifestyle, PCOD & Weight Management Nutrition Session",
        "modality": "hybrid",
        "duration": "Per Session (30 min)",
        "benchmark_price": 500.0,
        "description": "Hormonal balance nutrition, sustainable fat loss, and anti-inflammatory eating habits.",
    },
    {
        "id": "diet_pediatric_maternal",
        "category": "Special Population",
        "service_name": "Pediatric & Maternal Nutrition (Pregnancy, Lactation, Child Weaning)",
        "modality": "hybrid",
        "duration": "Per Session (30 min)",
        "benchmark_price": 600.0,
        "description": "Gestational nutrition, micronutrient sufficiency, and pediatric growth tracking.",
    },
    {
        "id": "diet_pkg_monthly",
        "category": "Packages & Continuous Care",
        "service_name": "Monthly Diet Management Program (2 Detailed Sessions + WhatsApp Support)",
        "modality": "hybrid",
        "duration": "Per Month Package",
        "benchmark_price": 1500.0,
        "description": "Complete 30-day nutrition coaching, bi-weekly reviews, and ongoing meal modifications.",
    },
    {
        "id": "diet_pkg_executive",
        "category": "Packages & Continuous Care",
        "service_name": "Comprehensive Executive Nutrition & Metabolic Reversal (Quarterly)",
        "modality": "hybrid",
        "duration": "3-Month Program (6 Sessions)",
        "benchmark_price": 3000.0,
        "description": "Intensive metabolic health program, biomarker correlation, and sustained lifestyle transformation.",
    },
]

# ─── 3. Physiotherapist Master Scope ─────────────────────────────────────────
PHYSIOTHERAPIST_MASTER_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "pt_assess_initial",
        "category": "Clinical Assessment",
        "service_name": "Initial Physiotherapy Assessment & Treatment Protocol Design",
        "modality": "clinic",
        "duration": "Per Visit (45 min)",
        "benchmark_price": 500.0,
        "description": "Comprehensive musculoskeletal/neurological evaluation, posture examination, and rehab roadmap.",
    },
    {
        "id": "pt_assess_followup",
        "category": "Clinical Assessment",
        "service_name": "Follow-Up Physiotherapy Progress Assessment",
        "modality": "clinic",
        "duration": "Per Visit (30 min)",
        "benchmark_price": 300.0,
        "description": "Re-evaluation of joint range of motion (ROM), pain intensity score (VAS), and functional gains.",
    },
    {
        "id": "pt_home_session",
        "category": "Home Rehabilitation",
        "service_name": "Physiotherapy Home Care Session (Bedside Mobilization & Exercise Therapy)",
        "modality": "home",
        "duration": "Per Home Visit (45-60 min)",
        "benchmark_price": 800.0,
        "description": "In-person residential rehabilitation using portable modalities, resistance equipment, and guided exercise.",
    },
    {
        "id": "pt_tele_rehab",
        "category": "Tele-Rehabilitation",
        "service_name": "Tele-Rehab Video Consultation & Home Exercise Prescription",
        "modality": "online",
        "duration": "Per Video Session (30 min)",
        "benchmark_price": 400.0,
        "description": "Interactive video posture correction, guided ergonomic exercise, and digital rehab routine.",
    },
    {
        "id": "pt_ortho_rehab",
        "category": "Orthopedic Rehabilitation",
        "service_name": "Post-Surgical Joint Rehabilitation (Total Knee / Hip Replacement)",
        "modality": "home",
        "duration": "Per Session (45-60 min)",
        "benchmark_price": 850.0,
        "description": "Early mobilization, gait re-education, quad strengthening, and swelling management post arthroplasty.",
    },
    {
        "id": "pt_neuro_stroke",
        "category": "Neurological Rehabilitation",
        "service_name": "Neuro-Rehab Session (Stroke, Hemiplegia, Parkinson's, Spinal Cord)",
        "modality": "home",
        "duration": "Per Session (60 min)",
        "benchmark_price": 900.0,
        "description": "Bobath/NDT-based motor relearning, spasticity management, balance training, and functional independence.",
    },
    {
        "id": "pt_spine_pain",
        "category": "Pain Management & Spine",
        "service_name": "Cervical / Lumbar Spondylosis & Sciatica Pain Protocol",
        "modality": "clinic",
        "duration": "Per Session (45 min)",
        "benchmark_price": 500.0,
        "description": "Spine traction, core stabilization exercises, neural mobilization, and McKenzie protocols.",
    },
    {
        "id": "pt_manual_therapy",
        "category": "Manual Therapy",
        "service_name": "Manual Therapy & Myofascial Release (MFR / Trigger Point)",
        "modality": "clinic",
        "duration": "Per Session (40 min)",
        "benchmark_price": 500.0,
        "description": "Targeted soft tissue release, joint mobilization grades I-IV, and passive stretching.",
    },
    {
        "id": "pt_electrotherapy",
        "category": "Electrotherapy & Modalities",
        "service_name": "Electrotherapy Session (TENS / IFT / Therapeutic Ultrasound)",
        "modality": "clinic",
        "duration": "Per Session (30 min)",
        "benchmark_price": 400.0,
        "description": "Electrophysical agents for deep tissue pain reduction, edema absorption, and muscle spasm relief.",
    },
    {
        "id": "pt_sports_injury",
        "category": "Sports Physiotherapy",
        "service_name": "Sports Injury Rehab & Kinesiology Taping (ACL, Meniscus, Rotator Cuff)",
        "modality": "hybrid",
        "duration": "Per Session (45 min)",
        "benchmark_price": 750.0,
        "description": "Plyometrics, proprioceptive agility training, elastic therapeutic taping, and return-to-sport protocols.",
    },
    {
        "id": "pt_geriatric_fall",
        "category": "Geriatric Care",
        "service_name": "Geriatric Mobility, Balance & Fall Prevention Training",
        "modality": "home",
        "duration": "Per Visit (45 min)",
        "benchmark_price": 700.0,
        "description": "Senior balance enhancement, dynamic gait stability, transfer assistance, and home safety audit.",
    },
    {
        "id": "pt_chest_pulmonary",
        "category": "Cardiopulmonary",
        "service_name": "Chest Physiotherapy & Post-COVID Respiratory Rehabilitation",
        "modality": "home",
        "duration": "Per Session (40 min)",
        "benchmark_price": 600.0,
        "description": "Postural drainage, chest percussion, spirometry guidance, and thoracic expansion training.",
    },
]

# ─── 4. Nursing Master Scope ─────────────────────────────────────────────────
NURSE_MASTER_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "nurse_vitals",
        "category": "Basic Nursing Procedures",
        "service_name": "Vital Signs Monitoring (BP, PR, SpO2, Temp, RR) & Health Charting",
        "modality": "home",
        "duration": "Per Visit (30 min)",
        "benchmark_price": 300.0,
        "description": "Bedside clinical parameter logging and immediate clinical triage alert.",
    },
    {
        "id": "nurse_injection",
        "category": "Basic Nursing Procedures",
        "service_name": "Subcutaneous / Intramuscular (IM/SC) Injection Administration",
        "modality": "home",
        "duration": "Per Visit",
        "benchmark_price": 250.0,
        "description": "Aseptic injection delivery strictly against a verified doctor's prescription.",
    },
    {
        "id": "nurse_iv_cannulation",
        "category": "Basic Nursing Procedures",
        "service_name": "Intravenous (IV) Cannulation & Saline Infusion Setup",
        "modality": "home",
        "duration": "Per Procedure",
        "benchmark_price": 450.0,
        "description": "Peripheral venipuncture, IV catheter fixation, and flow-rate regulation.",
    },
    {
        "id": "nurse_rbs_monitoring",
        "category": "Basic Nursing Procedures",
        "service_name": "Random Blood Glucose (RBS / GRBS) Monitoring with Glucometer",
        "modality": "home",
        "duration": "Per Visit",
        "benchmark_price": 200.0,
        "description": "Capillary blood sugar testing, recording, and physician notification.",
    },
    {
        "id": "nurse_minor_dressing",
        "category": "Wound & Surgical Care",
        "service_name": "Simple Aseptic Wound Dressing (Minor cuts, clean stitches, abrasions)",
        "modality": "home",
        "duration": "Per Dressing",
        "benchmark_price": 350.0,
        "description": "Sterile wound cleaning, antiseptic application, and non-adherent dressing.",
    },
    {
        "id": "nurse_complex_dressing",
        "category": "Wound & Surgical Care",
        "service_name": "Complex / Post-Surgical Incision & Bed Sore Care (Stages I & II)",
        "modality": "home",
        "duration": "Per Dressing",
        "benchmark_price": 800.0,
        "description": "Debridement support, specialized alginate/foam dressings, and pressure ulcer care.",
    },
    {
        "id": "nurse_suture_removal",
        "category": "Wound & Surgical Care",
        "service_name": "Suture / Surgical Staple Removal with Antiseptic Dressing",
        "modality": "home",
        "duration": "Per Procedure",
        "benchmark_price": 400.0,
        "description": "Aseptic stitch/clip extraction, healing assessment, and protective covering.",
    },
    {
        "id": "nurse_catheter",
        "category": "Device & Tube Management",
        "service_name": "Urinary Catheterization (Foley's insertion / replacement / removal)",
        "modality": "home",
        "duration": "Per Procedure",
        "benchmark_price": 600.0,
        "description": "Sterile urethral catheterization, balloon inflation, and drainage collection check.",
    },
    {
        "id": "nurse_ryles_tube",
        "category": "Device & Tube Management",
        "service_name": "Ryle's Tube (Nasogastric / NG Tube) Insertion & Aspiration Check",
        "modality": "home",
        "duration": "Per Procedure",
        "benchmark_price": 700.0,
        "description": "Nasogastric tube placement verification, fixation, and feeding guidance.",
    },
    {
        "id": "nurse_tracheostomy",
        "category": "Device & Tube Management",
        "service_name": "Tracheostomy Tube Suctioning, Cleaning & Cannula Hygiene",
        "modality": "home",
        "duration": "Per Visit",
        "benchmark_price": 850.0,
        "description": "Airway suctioning, stoma care, inner cannula sanitization, and sterile dressing.",
    },
    {
        "id": "nurse_shift_12hr",
        "category": "Shift & Continuous Care",
        "service_name": "Skilled General Nursing Duty (Continuous Bedside Monitoring - 12 Hours)",
        "modality": "home",
        "duration": "12 Hours Shift",
        "benchmark_price": 1600.0,
        "description": "Continuous day or night shift nursing care by GNM/B.Sc certified nurse.",
    },
    {
        "id": "nurse_shift_24hr",
        "category": "Shift & Continuous Care",
        "service_name": "24-Hour Residential Skilled Nursing Care (Dual-Shift / Stay)",
        "modality": "home",
        "duration": "24 Hours Shift",
        "benchmark_price": 3000.0,
        "description": "Round-the-clock home nursing attendant care for critically dependent patients.",
    },
]

# ─── 5. Dental Practice Master Scope (CALL MEDEX - DENTAL PROCEDURE.xlsx) ───
# Canonical 19 Dental Procedures. 100% In-Clinic Walk-In Only.
DENTAL_MASTER_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "dent_routine_cleanings",
        "category": "Diagnostic",
        "service_name": "Routine Cleanings (Prophylaxis)",
        "modality": "clinic",
        "duration": "45 Mins (In-Clinic)",
        "benchmark_price": 800.0,
        "description": "Removal of plaque and tartar buildup to prevent periodontal disease.",
    },
    {
        "id": "dent_comprehensive_exams",
        "category": "Diagnostic",
        "service_name": "Comprehensive Exams",
        "modality": "clinic",
        "duration": "30 Mins (In-Clinic)",
        "benchmark_price": 400.0,
        "description": "Thorough physical evaluation of teeth, soft tissues, and oral cavity structure.",
    },
    {
        "id": "dent_dental_xrays",
        "category": "Diagnostic",
        "service_name": "Dental X-Rays",
        "modality": "clinic",
        "duration": "15 Mins (In-Clinic)",
        "benchmark_price": 350.0,
        "description": "Diagnostic imaging (bitewing/panoramic) to identify deep decay or bone loss.",
    },
    {
        "id": "dent_fluoride_treatments",
        "category": "Preventive",
        "service_name": "Fluoride Treatments",
        "modality": "clinic",
        "duration": "15 Mins (In-Clinic)",
        "benchmark_price": 600.0,
        "description": "Highly concentrated topical application to reinforce enamel against acid attack.",
    },
    {
        "id": "dent_dental_sealants",
        "category": "Preventive",
        "service_name": "Dental Sealants",
        "modality": "clinic",
        "duration": "30 Mins (In-Clinic)",
        "benchmark_price": 750.0,
        "description": "Protective thin composite barrier applied to deep pits/fissures of molars.",
    },
    {
        "id": "dent_dental_fillings",
        "category": "Restorative",
        "service_name": "Dental Fillings",
        "modality": "clinic",
        "duration": "45 Mins (In-Clinic)",
        "benchmark_price": 1200.0,
        "description": "Excavation of decay followed by restoration using tooth-colored composite resin.",
    },
    {
        "id": "dent_root_canal_therapy",
        "category": "Endodontic",
        "service_name": "Root Canal Therapy",
        "modality": "clinic",
        "duration": "90 Mins (In-Clinic)",
        "benchmark_price": 3500.0,
        "description": "Extirpation of infected or necrotic pulp tissue from root canals to salvage tooth.",
    },
    {
        "id": "dent_crowns_caps",
        "category": "Prosthodontic",
        "service_name": "Dental Crowns (Caps)",
        "modality": "clinic",
        "duration": "60 Mins (In-Clinic)",
        "benchmark_price": 4500.0,
        "description": "Full-coverage custom-fabricated ceramic or porcelain prosthesis to protect weak teeth.",
    },
    {
        "id": "dent_bridges",
        "category": "Prosthodontic",
        "service_name": "Bridges",
        "modality": "clinic",
        "duration": "90 Mins (In-Clinic)",
        "benchmark_price": 8000.0,
        "description": "Fixed multi-unit prosthetic appliance replacing missing teeth anchored to adjacent abutments.",
    },
    {
        "id": "dent_dentures",
        "category": "Prosthodontic",
        "service_name": "Dentures",
        "modality": "clinic",
        "duration": "60 Mins (In-Clinic)",
        "benchmark_price": 12000.0,
        "description": "Removable tissue-supported complete or partial appliance to replace missing arches.",
    },
    {
        "id": "dent_dental_implants",
        "category": "Surgical-Restorative",
        "service_name": "Dental Implants",
        "modality": "clinic",
        "duration": "120 Mins (In-Clinic)",
        "benchmark_price": 25000.0,
        "description": "Surgical placement of titanium endosteal fixture serving as an artificial tooth root.",
    },
    {
        "id": "dent_teeth_whitening",
        "category": "Cosmetic",
        "service_name": "Teeth Whitening",
        "modality": "clinic",
        "duration": "60 Mins (In-Clinic)",
        "benchmark_price": 5000.0,
        "description": "In-office chemically activated or light-assisted bleaching process to lift internal stains.",
    },
    {
        "id": "dent_dental_veneers",
        "category": "Cosmetic",
        "service_name": "Dental Veneers",
        "modality": "clinic",
        "duration": "90 Mins (In-Clinic)",
        "benchmark_price": 7500.0,
        "description": "Ultra-thin custom porcelain facings bonded permanently to anterior teeth surfaces.",
    },
    {
        "id": "dent_cosmetic_bonding",
        "category": "Cosmetic",
        "service_name": "Cosmetic Bonding",
        "modality": "clinic",
        "duration": "45 Mins (In-Clinic)",
        "benchmark_price": 2000.0,
        "description": "Direct application of composite materials to repair minor micro-fractures or structural diastemas.",
    },
    {
        "id": "dent_scaling_root_planing",
        "category": "Periodontal",
        "service_name": "Scaling and Root Planing",
        "modality": "clinic",
        "duration": "75 Mins (In-Clinic)",
        "benchmark_price": 1800.0,
        "description": "Therapeutic deep instrumentation below the gumline to clear calculus and smooth roots.",
    },
    {
        "id": "dent_gum_grafting",
        "category": "Periodontal-Surgical",
        "service_name": "Gum Grafting",
        "modality": "clinic",
        "duration": "90 Mins (In-Clinic)",
        "benchmark_price": 9000.0,
        "description": "Surgical tissue transplantation to restore severe areas of gingival recession.",
    },
    {
        "id": "dent_tooth_extractions",
        "category": "Oral Surgery",
        "service_name": "Tooth Extractions",
        "modality": "clinic",
        "duration": "45 Mins (In-Clinic)",
        "benchmark_price": 1000.0,
        "description": "Surgical or non-surgical removal of non-restorable or heavily fractured teeth.",
    },
    {
        "id": "dent_wisdom_teeth_removal",
        "category": "Oral Surgery",
        "service_name": "Wisdom Teeth Removal",
        "modality": "clinic",
        "duration": "90 Mins (In-Clinic)",
        "benchmark_price": 4000.0,
        "description": "Surgical extraction of impacted, malposed, or symptomatic third molars.",
    },
    {
        "id": "dent_emergency_dental_care",
        "category": "Emergency",
        "service_name": "Emergency Dental Care",
        "modality": "clinic",
        "duration": "45 Mins (In-Clinic)",
        "benchmark_price": 1500.0,
        "description": "Immediate triage and palliative or corrective treatment for acute abscesses or trauma.",
    },
]

# ─── 6. Diagnostic Center Scope (DIAGNOSTIC CENTER SCOPE.xls) ───────────────
# Strictly MRI (33), CT Scans (31), Scans (11), Blood Tests (CBC & CULTURES only).
# No other blood tests or lab health packages can be provided by diagnostic centers.
DIAGNOSTIC_CENTER_SCOPE: Dict[str, List[Dict[str, Any]]] = {
    "mri": [
        {"id": "mri_brain_plain", "name": "MRI BRAIN PLAIN", "benchmark_price": 5000.0, "category": "mri"},
        {"id": "mri_brain_plain_contrast", "name": "MRI BRAIN PLAIN WITH CONTRAST", "benchmark_price": 8000.0, "category": "mri"},
        {"id": "mri_spine_single", "name": "MRI SPINE SINGLE REGION", "benchmark_price": 5000.0, "category": "mri"},
        {"id": "mri_dl_spine", "name": "MRI DL SPINE", "benchmark_price": 6000.0, "category": "mri"},
        {"id": "mri_cspine_cv_junction", "name": "MRI CSPINE WITH CV JUNCTION", "benchmark_price": 6500.0, "category": "mri"},
        {"id": "mri_cervical_brachial_plexus", "name": "CERVICAL SPINE WITH BRACHIAL PLEXUS", "benchmark_price": 9500.0, "category": "mri"},
        {"id": "mri_abdomen", "name": "MRI ABDOMEN", "benchmark_price": 7000.0, "category": "mri"},
        {"id": "mri_pelvis", "name": "MRI PELVIS", "benchmark_price": 7000.0, "category": "mri"},
        {"id": "mri_brain_angio", "name": "MRI BRAIN ANGIOGRAM", "benchmark_price": 8000.0, "category": "mri"},
        {"id": "mri_venogram_brain", "name": "MRI VENOGRAM - Brain", "benchmark_price": 8000.0, "category": "mri"},
        {"id": "mri_any_joint", "name": "MRI ANY JOINT", "benchmark_price": 6000.0, "category": "mri"},
        {"id": "mri_contrast_charges", "name": "ONLY CONTRAST CHARGES", "benchmark_price": 3000.0, "category": "mri"},
        {"id": "mri_neck", "name": "MRI NECK", "benchmark_price": 6000.0, "category": "mri"},
        {"id": "mri_renal_angio", "name": "MRI RENAL ANGIO", "benchmark_price": 8000.0, "category": "mri"},
        {"id": "mri_brain_neck_angio", "name": "MRI BRAIN AND NECK ANGIOGRAM", "benchmark_price": 9000.0, "category": "mri"},
        {"id": "mri_fistulogram", "name": "MRI FISTULOGRAM", "benchmark_price": 6000.0, "category": "mri"},
        {"id": "mri_orbits", "name": "MRI ORBITS", "benchmark_price": 5000.0, "category": "mri"},
        {"id": "mri_pns", "name": "MRI PNS", "benchmark_price": 6000.0, "category": "mri"},
        {"id": "mri_peripheral_lower_limb_angio", "name": "MRI PERIPHERAL LOWER LIMB ANGIOGRAM", "benchmark_price": 11000.0, "category": "mri"},
        {"id": "mri_brain_orbits", "name": "MRI BRAIN WITH ORBITS", "benchmark_price": 7000.0, "category": "mri"},
        {"id": "mri_breast", "name": "MRI BREAST", "benchmark_price": 9000.0, "category": "mri"},
        {"id": "mri_breast_screening", "name": "ABREVATION BREAST MRI FOR SCREENING", "benchmark_price": 8000.0, "category": "mri"},
        {"id": "mri_breast_contrast", "name": "MRI BREAST WITH CONTRAST", "benchmark_price": 9000.0, "category": "mri"},
        {"id": "mri_cardiac", "name": "MRI CARDIAC", "benchmark_price": 15000.0, "category": "mri"},
        {"id": "mri_stroke_protocol", "name": "MRI STROKE PROTOCOL", "benchmark_price": 8000.0, "category": "mri"},
        {"id": "mri_sella_contrast", "name": "MRI SELLA WITH CONTRAST", "benchmark_price": 8000.0, "category": "mri"},
        {"id": "mri_mrcp", "name": "MRCP", "benchmark_price": 7000.0, "category": "mri"},
        {"id": "mri_urogram", "name": "MRI UROGRAM", "benchmark_price": 7000.0, "category": "mri"},
        {"id": "mri_prostate", "name": "MRI PROSTATE", "benchmark_price": 9000.0, "category": "mri"},
        {"id": "mri_epilepsy_protocol", "name": "MRI EPILEPSY PROTOCOL", "benchmark_price": 8000.0, "category": "mri"},
        {"id": "mri_dementia_protocol", "name": "MRI DEMENTIA PROTOCOL", "benchmark_price": 8000.0, "category": "mri"},
        {"id": "mri_headache_protocol", "name": "MRI HEADACHE PROTOCOL", "benchmark_price": 8000.0, "category": "mri"},
        {"id": "mri_defecography", "name": "MRI DEFECOGRAPHY", "benchmark_price": 10000.0, "category": "mri"},
    ],
    "ct_scans": [
        {"id": "ct_3d_any_region", "name": "3 D CT ANY REGION", "benchmark_price": 5000.0, "category": "ct"},
        {"id": "ct_3d_skull", "name": "3D CT SKULL", "benchmark_price": 5000.0, "category": "ct"},
        {"id": "ct_abdomen_plain", "name": "CT ABDOMEN PLAIN", "benchmark_price": 4000.0, "category": "ct"},
        {"id": "ct_abdomen_contrast", "name": "CT ABDOMEN PLAIN WITH CONTRAST", "benchmark_price": 6500.0, "category": "ct"},
        {"id": "ct_aortogram", "name": "CT AORTOGRAM", "benchmark_price": 8500.0, "category": "ct"},
        {"id": "ct_biopsy", "name": "CT BIOPSY", "benchmark_price": 9000.0, "category": "ct"},
        {"id": "ct_brain_plain", "name": "CT BRAIN PLAIN", "benchmark_price": 2500.0, "category": "ct"},
        {"id": "ct_chest_plain", "name": "CT CHEST PLAIN", "benchmark_price": 4000.0, "category": "ct"},
        {"id": "ct_chest_contrast", "name": "CT CHEST PLAIN WITH CONTRAST", "benchmark_price": 6500.0, "category": "ct"},
        {"id": "ct_entroclysis", "name": "CT ENTROCLYSIS", "benchmark_price": 7000.0, "category": "ct"},
        {"id": "ct_facial_bones", "name": "CT Facial Bones", "benchmark_price": 5000.0, "category": "ct"},
        {"id": "ct_fnac", "name": "CT FNAC", "benchmark_price": 8000.0, "category": "ct"},
        {"id": "ct_guided_pigtail", "name": "CT GUIDED PIGTAIL CATHETER", "benchmark_price": 8600.0, "category": "ct"},
        {"id": "ct_kub", "name": "CT KUB", "benchmark_price": 4000.0, "category": "ct"},
        {"id": "ct_mastoids", "name": "CT MASTOIDS", "benchmark_price": 4000.0, "category": "ct"},
        {"id": "ct_neck", "name": "CT NECK", "benchmark_price": 4500.0, "category": "ct"},
        {"id": "ct_neck_contrast", "name": "CT NECK PLAIN WITH CONTRAST", "benchmark_price": 5500.0, "category": "ct"},
        {"id": "ct_neck_vessel_angio", "name": "CT NECK VESSEL ANGIO", "benchmark_price": 6500.0, "category": "ct"},
        {"id": "ct_orbits", "name": "CT ORBITS", "benchmark_price": 3700.0, "category": "ct"},
        {"id": "ct_pcnl", "name": "CT PCNL", "benchmark_price": 8500.0, "category": "ct"},
        {"id": "ct_pelvis_hip_joints", "name": "CT PELVIS WITH HIP JOINTS", "benchmark_price": 5000.0, "category": "ct"},
        {"id": "ct_pns_single", "name": "CT PNS (Single film)", "benchmark_price": 3000.0, "category": "ct"},
        {"id": "ct_pns_two", "name": "CT PNS (Two films)", "benchmark_price": 3500.0, "category": "ct"},
        {"id": "ct_pns_three", "name": "CT PNS (Three films)", "benchmark_price": 3500.0, "category": "ct"},
        {"id": "ct_temporal_bones", "name": "CT TEMPORAL BONES", "benchmark_price": 4000.0, "category": "ct"},
        {"id": "ct_pulmonary_angio", "name": "CT PULMONARY ANGIO", "benchmark_price": 6500.0, "category": "ct"},
        {"id": "ct_renal_angio", "name": "CT RENAL ANGIOGRAM", "benchmark_price": 8000.0, "category": "ct"},
        {"id": "ct_spine_any_region", "name": "CT SPINE ANY REGION", "benchmark_price": 5000.0, "category": "ct"},
        {"id": "ct_limb_angio", "name": "CT UPPER / LOWER LIMB ANGIORAM", "benchmark_price": 8000.0, "category": "ct"},
        {"id": "ct_urogram", "name": "CT UROGRAM", "benchmark_price": 5000.0, "category": "ct"},
        {"id": "ct_enterography", "name": "CT ENTEROGRAPHY", "benchmark_price": 8000.0, "category": "ct"},
    ],
    "scans": [
        {"id": "scan_ultrasound", "name": "ULTRA SOUND SCANS", "benchmark_price": 1200.0, "category": "imaging"},
        {"id": "scan_doppler", "name": "DOPPLER", "benchmark_price": 2500.0, "category": "imaging"},
        {"id": "scan_tiffa", "name": "TIFFA", "benchmark_price": 3000.0, "category": "imaging"},
        {"id": "scan_antenatal", "name": "ANTENATAL SCAN", "benchmark_price": 1800.0, "category": "imaging"},
        {"id": "scan_2d_echo", "name": "2D ECHO", "benchmark_price": 2200.0, "category": "imaging"},
        {"id": "scan_xray_single", "name": "X RAY (SINGLE)", "benchmark_price": 500.0, "category": "imaging"},
        {"id": "scan_xray_double", "name": "X RAY (DOUBLE)", "benchmark_price": 800.0, "category": "imaging"},
        {"id": "scan_tmt", "name": "TMT", "benchmark_price": 2000.0, "category": "imaging"},
        {"id": "scan_bmd", "name": "BMD", "benchmark_price": 2500.0, "category": "imaging"},
        {"id": "scan_mammogram", "name": "MAMMOGRAM", "benchmark_price": 2500.0, "category": "imaging"},
        {"id": "scan_hsg", "name": "HSG", "benchmark_price": 3500.0, "category": "imaging"},
    ],
    "blood_tests": [
        {"id": "blood_cbc", "name": "CBC", "benchmark_price": 400.0, "category": "lab_test"},
        {"id": "blood_cultures", "name": "CULTURES", "benchmark_price": 900.0, "category": "lab_test"},
    ],
}


def get_diagnostic_center_scope() -> Dict[str, List[Dict[str, Any]]]:
    """Returns the locked scope of services for diagnostic centers with benchmark MRPs."""
    return DIAGNOSTIC_CENTER_SCOPE


def is_allowed_diagnostic_center_service(name: str, service_type: str = "") -> bool:
    """
    Validation gate: Diagnostic centers can ONLY offer MRI, CT Scans, General Scans,
    and strictly CBC and CULTURES for blood tests. All other blood tests or packages are barred.
    """
    clean_name = (name or "").strip().lower()
    if not clean_name:
        return False

    norm_name = clean_name.replace(" ", "").replace("-", "").replace("_", "").replace("&", "and")

    # Check against all allowed scan categories in DIAGNOSTIC_CENTER_SCOPE
    for cat, items in DIAGNOSTIC_CENTER_SCOPE.items():
        for it in items:
            it_name = it["name"].lower()
            it_norm = it_name.replace(" ", "").replace("-", "").replace("_", "").replace("&", "and")
            if (clean_name == it_name or clean_name in it_name or it_name in clean_name
                or norm_name == it_norm or norm_name in it_norm or it_norm in norm_name):
                return True
            # Handle ultrasound/USG and radiography clinical variants
            if cat == "scans":
                if ("ultrasound" in norm_name or "usg" in clean_name.split()) and ("ultrasound" in it_norm or "sound" in it_norm):
                    return True
                if ("xray" in norm_name or "x-ray" in clean_name) and "xray" in it_norm:
                    return True
            if cat in ("mri", "ct"):
                if clean_name.startswith(cat) and any(w in it_name for w in clean_name.split()[1:]):
                    return True

    # Check Blood tests restriction: strictly CBC and CULTURES only
    allowed_blood = {"cbc", "cultures", "complete blood count", "blood culture", "culture & sensitivity", "culture"}
    if any(ab in clean_name for ab in allowed_blood):
        return True

    return False


# ─── Master Lookup Map ───────────────────────────────────────────────────────
ROLE_CATALOG_MAP = {
    "doctor": DOCTOR_MASTER_CATALOG,
    "dietitian": DIETITIAN_MASTER_CATALOG,
    "physiotherapist": PHYSIOTHERAPIST_MASTER_CATALOG,
    "nurse": NURSE_MASTER_CATALOG,
    "dentist": DENTAL_MASTER_CATALOG,
}


def get_master_catalog_for_role(role: str) -> List[Dict[str, Any]]:
    """Retrieve the master service and fee catalog for a given provider role with 80/20 commercial split."""
    raw = ROLE_CATALOG_MAP.get(role.lower(), [])
    enriched: List[Dict[str, Any]] = []
    for item in raw:
        price = float(item.get("benchmark_price", 400.0))
        split = compute_commercial_split(price)
        enriched.append({
            **item,
            "custom_price": price,
            "platform_fee_pct": split["platform_fee_pct"],
            "platform_fee_amount": split["platform_fee_amount"],
            "provider_share_amount": split["provider_share_amount"],
            "is_active": True,
        })
    return enriched


def compute_commercial_split(
    price: float, platform_fee_pct: Optional[float] = None
) -> Dict[str, float]:
    """
    Calculate the 80/20 commercial split for any service price.
    Platform Fee: 20%
    Provider Take-Home: 80%

    The percentage is read from PricingService, the single place that defines
    it, rather than restated here. Three separate literal 20s used to sit in
    this file, payment.py and provider_scope.py, so changing the fee meant
    finding all of them and any one missed would quietly pay a partner the
    wrong share.
    """
    if platform_fee_pct is None:
        from app.services.marketplace import PricingService

        platform_fee_pct = PricingService.platform_fee_pct()
    p = max(0.0, float(price))
    platform_fee = round((p * platform_fee_pct) / 100.0, 2)
    provider_share = round(p - platform_fee, 2)
    return {
        "gross_price": p,
        "custom_price": p,
        "platform_fee_pct": platform_fee_pct,
        "platform_fee_amount": platform_fee,
        "provider_share_amount": provider_share,
    }


def sanitize_selected_scope(role: str, submitted_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Process and validate the scope of services selected by a provider during MOU acceptance.
    Defaults to master catalog pricing if custom price is omitted or invalid.
    """
    master = {item["id"]: item for item in get_master_catalog_for_role(role)}
    sanitized: List[Dict[str, Any]] = []

    for sub in submitted_items:
        sid = sub.get("id")
        if not sid or sid not in master:
            continue

        base = master[sid]
        # Allow provider to customize price, else use benchmark
        raw_price = sub.get("custom_price", sub.get("agreed_price", base["benchmark_price"]))
        try:
            custom_price = float(raw_price)
            if custom_price <= 0:
                custom_price = base["benchmark_price"]
        except (ValueError, TypeError):
            custom_price = base["benchmark_price"]

        split = compute_commercial_split(custom_price)

        sanitized.append({
            "id": sid,
            "category": base.get("category", "General"),
            "service_name": base.get("service_name", sid),
            "modality": sub.get("modality", base.get("modality", "clinic")),
            "duration": base.get("duration", ""),
            "benchmark_price": base["benchmark_price"],
            "custom_price": split["gross_price"],
            "platform_fee_pct": split["platform_fee_pct"],
            "platform_fee_amount": split["platform_fee_amount"],
            "provider_share_amount": split["provider_share_amount"],
            "is_active": sub.get("is_active", True),
        })

    # If provider submitted nothing, seed with the entire master catalog with benchmark rates
    if not sanitized and role in ROLE_CATALOG_MAP:
        for base in ROLE_CATALOG_MAP[role]:
            split = compute_commercial_split(base["benchmark_price"])
            sanitized.append({
                "id": base["id"],
                "category": base.get("category", "General"),
                "service_name": base.get("service_name", base["id"]),
                "modality": base.get("modality", "clinic"),
                "duration": base.get("duration", ""),
                "benchmark_price": base["benchmark_price"],
                "custom_price": split["gross_price"],
                "platform_fee_pct": split["platform_fee_pct"],
                "platform_fee_amount": split["platform_fee_amount"],
                "provider_share_amount": split["provider_share_amount"],
                "is_active": True,
            })

    return sanitized
