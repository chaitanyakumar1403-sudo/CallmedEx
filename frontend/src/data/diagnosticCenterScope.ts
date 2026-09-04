// CallMedex Canonical Diagnostic Center Scope
// Extracted from services/DIAGNOSTIC CENTER SCOPE.xls
// Strictly MRI (33), CT Scans (31), General Scans (11), Blood Tests (CBC & CULTURES only).
// Total 77 canonical items.

export interface DiagnosticScopeItem {
  id: string;
  name: string;
  type: "imaging" | "lab_test";
  category: string;
  category_key: "mri" | "ct_scans" | "scans" | "blood_tests";
  price: number;
  description: string;
}

export const DIAGNOSTIC_SCOPE_CATEGORIES = [
  { key: "all", label: "All Services (77)" },
  { key: "mri", label: "MRI Scans (33)" },
  { key: "ct_scans", label: "CT Scans (31)" },
  { key: "scans", label: "Ultrasound & Specialized (11)" },
  { key: "blood_tests", label: "Core Blood Tests (2)" },
] as const;

export const DIAGNOSTIC_CENTER_SCOPE_ITEMS: DiagnosticScopeItem[] = [
  {
    "id": "mri_brain_plain",
    "name": "MRI BRAIN PLAIN",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 5000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 5000."
  },
  {
    "id": "mri_brain_plain_contrast",
    "name": "MRI BRAIN PLAIN WITH CONTRAST",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "mri_spine_single",
    "name": "MRI SPINE SINGLE REGION",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 5000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 5000."
  },
  {
    "id": "mri_dl_spine",
    "name": "MRI DL SPINE",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 6000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 6000."
  },
  {
    "id": "mri_cspine_cv_junction",
    "name": "MRI CSPINE WITH CV JUNCTION",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 6500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 6500."
  },
  {
    "id": "mri_cervical_brachial_plexus",
    "name": "CERVICAL SPINE WITH BRACHIAL PLEXUS",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 9500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 9500."
  },
  {
    "id": "mri_abdomen",
    "name": "MRI ABDOMEN",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 7000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 7000."
  },
  {
    "id": "mri_pelvis",
    "name": "MRI PELVIS",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 7000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 7000."
  },
  {
    "id": "mri_brain_angio",
    "name": "MRI BRAIN ANGIOGRAM",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "mri_venogram_brain",
    "name": "MRI VENOGRAM - Brain",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "mri_any_joint",
    "name": "MRI ANY JOINT",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 6000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 6000."
  },
  {
    "id": "mri_contrast_charges",
    "name": "ONLY CONTRAST CHARGES",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 3000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 3000."
  },
  {
    "id": "mri_neck",
    "name": "MRI NECK",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 6000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 6000."
  },
  {
    "id": "mri_renal_angio",
    "name": "MRI RENAL ANGIO",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "mri_brain_neck_angio",
    "name": "MRI BRAIN AND NECK ANGIOGRAM",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 9000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 9000."
  },
  {
    "id": "mri_fistulogram",
    "name": "MRI FISTULOGRAM",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 6000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 6000."
  },
  {
    "id": "mri_orbits",
    "name": "MRI ORBITS",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 5000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 5000."
  },
  {
    "id": "mri_pns",
    "name": "MRI PNS",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 6000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 6000."
  },
  {
    "id": "mri_peripheral_lower_limb_angio",
    "name": "MRI PERIPHERAL LOWER LIMB ANGIOGRAM",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 11000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 11000."
  },
  {
    "id": "mri_brain_orbits",
    "name": "MRI BRAIN WITH ORBITS",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 7000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 7000."
  },
  {
    "id": "mri_breast",
    "name": "MRI BREAST",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 9000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 9000."
  },
  {
    "id": "mri_breast_screening",
    "name": "ABREVATION BREAST MRI FOR SCREENING",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "mri_breast_contrast",
    "name": "MRI BREAST WITH CONTRAST",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 9000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 9000."
  },
  {
    "id": "mri_cardiac",
    "name": "MRI CARDIAC",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 15000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 15000."
  },
  {
    "id": "mri_stroke_protocol",
    "name": "MRI STROKE PROTOCOL",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "mri_sella_contrast",
    "name": "MRI SELLA WITH CONTRAST",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "mri_mrcp",
    "name": "MRCP",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 7000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 7000."
  },
  {
    "id": "mri_urogram",
    "name": "MRI UROGRAM",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 7000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 7000."
  },
  {
    "id": "mri_prostate",
    "name": "MRI PROSTATE",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 9000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 9000."
  },
  {
    "id": "mri_epilepsy_protocol",
    "name": "MRI EPILEPSY PROTOCOL",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "mri_dementia_protocol",
    "name": "MRI DEMENTIA PROTOCOL",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "mri_headache_protocol",
    "name": "MRI HEADACHE PROTOCOL",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "mri_defecography",
    "name": "MRI DEFECOGRAPHY",
    "type": "imaging",
    "category": "MRI Scans",
    "category_key": "mri",
    "price": 10000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 10000."
  },
  {
    "id": "ct_3d_any_region",
    "name": "3 D CT ANY REGION",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 5000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 5000."
  },
  {
    "id": "ct_3d_skull",
    "name": "3D CT SKULL",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 5000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 5000."
  },
  {
    "id": "ct_abdomen_plain",
    "name": "CT ABDOMEN PLAIN",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 4000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 4000."
  },
  {
    "id": "ct_abdomen_contrast",
    "name": "CT ABDOMEN PLAIN WITH CONTRAST",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 6500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 6500."
  },
  {
    "id": "ct_aortogram",
    "name": "CT AORTOGRAM",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 8500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8500."
  },
  {
    "id": "ct_biopsy",
    "name": "CT BIOPSY",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 9000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 9000."
  },
  {
    "id": "ct_brain_plain",
    "name": "CT BRAIN PLAIN",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 2500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 2500."
  },
  {
    "id": "ct_chest_plain",
    "name": "CT CHEST PLAIN",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 4000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 4000."
  },
  {
    "id": "ct_chest_contrast",
    "name": "CT CHEST PLAIN WITH CONTRAST",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 6500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 6500."
  },
  {
    "id": "ct_entroclysis",
    "name": "CT ENTROCLYSIS",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 7000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 7000."
  },
  {
    "id": "ct_facial_bones",
    "name": "CT Facial Bones",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 5000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 5000."
  },
  {
    "id": "ct_fnac",
    "name": "CT FNAC",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "ct_guided_pigtail",
    "name": "CT GUIDED PIGTAIL CATHETER",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 8600.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8600."
  },
  {
    "id": "ct_kub",
    "name": "CT KUB",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 4000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 4000."
  },
  {
    "id": "ct_mastoids",
    "name": "CT MASTOIDS",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 4000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 4000."
  },
  {
    "id": "ct_neck",
    "name": "CT NECK",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 4500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 4500."
  },
  {
    "id": "ct_neck_contrast",
    "name": "CT NECK PLAIN WITH CONTRAST",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 5500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 5500."
  },
  {
    "id": "ct_neck_vessel_angio",
    "name": "CT NECK VESSEL ANGIO",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 6500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 6500."
  },
  {
    "id": "ct_orbits",
    "name": "CT ORBITS",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 3700.0,
    "description": "Standard diagnostic study benchmarked at Rs. 3700."
  },
  {
    "id": "ct_pcnl",
    "name": "CT PCNL",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 8500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8500."
  },
  {
    "id": "ct_pelvis_hip_joints",
    "name": "CT PELVIS WITH HIP JOINTS",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 5000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 5000."
  },
  {
    "id": "ct_pns_single",
    "name": "CT PNS (Single film)",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 3000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 3000."
  },
  {
    "id": "ct_pns_two",
    "name": "CT PNS (Two films)",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 3500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 3500."
  },
  {
    "id": "ct_pns_three",
    "name": "CT PNS (Three films)",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 3500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 3500."
  },
  {
    "id": "ct_temporal_bones",
    "name": "CT TEMPORAL BONES",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 4000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 4000."
  },
  {
    "id": "ct_pulmonary_angio",
    "name": "CT PULMONARY ANGIO",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 6500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 6500."
  },
  {
    "id": "ct_renal_angio",
    "name": "CT RENAL ANGIOGRAM",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "ct_spine_any_region",
    "name": "CT SPINE ANY REGION",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 5000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 5000."
  },
  {
    "id": "ct_limb_angio",
    "name": "CT UPPER / LOWER LIMB ANGIORAM",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "ct_urogram",
    "name": "CT UROGRAM",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 5000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 5000."
  },
  {
    "id": "ct_enterography",
    "name": "CT ENTEROGRAPHY",
    "type": "imaging",
    "category": "CT Scans",
    "category_key": "ct_scans",
    "price": 8000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "scan_ultrasound",
    "name": "ULTRA SOUND SCANS",
    "type": "imaging",
    "category": "Ultrasound & Specialized Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "Standard diagnostic study benchmarked at Rs. 1200."
  },
  {
    "id": "scan_doppler",
    "name": "DOPPLER",
    "type": "imaging",
    "category": "Ultrasound & Specialized Scans",
    "category_key": "scans",
    "price": 2500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 2500."
  },
  {
    "id": "scan_tiffa",
    "name": "TIFFA",
    "type": "imaging",
    "category": "Ultrasound & Specialized Scans",
    "category_key": "scans",
    "price": 3000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 3000."
  },
  {
    "id": "scan_antenatal",
    "name": "ANTENATAL SCAN",
    "type": "imaging",
    "category": "Ultrasound & Specialized Scans",
    "category_key": "scans",
    "price": 1800.0,
    "description": "Standard diagnostic study benchmarked at Rs. 1800."
  },
  {
    "id": "scan_2d_echo",
    "name": "2D ECHO",
    "type": "imaging",
    "category": "Ultrasound & Specialized Scans",
    "category_key": "scans",
    "price": 2200.0,
    "description": "Standard diagnostic study benchmarked at Rs. 2200."
  },
  {
    "id": "scan_xray_single",
    "name": "X RAY (SINGLE)",
    "type": "imaging",
    "category": "Ultrasound & Specialized Scans",
    "category_key": "scans",
    "price": 500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 500."
  },
  {
    "id": "scan_xray_double",
    "name": "X RAY (DOUBLE)",
    "type": "imaging",
    "category": "Ultrasound & Specialized Scans",
    "category_key": "scans",
    "price": 800.0,
    "description": "Standard diagnostic study benchmarked at Rs. 800."
  },
  {
    "id": "scan_tmt",
    "name": "TMT",
    "type": "imaging",
    "category": "Ultrasound & Specialized Scans",
    "category_key": "scans",
    "price": 2000.0,
    "description": "Standard diagnostic study benchmarked at Rs. 2000."
  },
  {
    "id": "scan_bmd",
    "name": "BMD",
    "type": "imaging",
    "category": "Ultrasound & Specialized Scans",
    "category_key": "scans",
    "price": 2500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 2500."
  },
  {
    "id": "scan_mammogram",
    "name": "MAMMOGRAM",
    "type": "imaging",
    "category": "Ultrasound & Specialized Scans",
    "category_key": "scans",
    "price": 2500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 2500."
  },
  {
    "id": "scan_hsg",
    "name": "HSG",
    "type": "imaging",
    "category": "Ultrasound & Specialized Scans",
    "category_key": "scans",
    "price": 3500.0,
    "description": "Standard diagnostic study benchmarked at Rs. 3500."
  },
  {
    "id": "blood_cbc",
    "name": "CBC",
    "type": "lab_test",
    "category": "Core Blood Tests",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "Standard diagnostic study benchmarked at Rs. 400."
  },
  {
    "id": "blood_cultures",
    "name": "CULTURES",
    "type": "lab_test",
    "category": "Core Blood Tests",
    "category_key": "blood_tests",
    "price": 900.0,
    "description": "Standard diagnostic study benchmarked at Rs. 900."
  }
];
