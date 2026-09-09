// CallMedex Canonical Diagnostic Center Scope
// Benchmark prices synchronized with CALL MEDEX LAB.xls
// Total 708 canonical items across Blood Tests, MRI, CT Scans, Digital X-Rays, Ultrasounds, Dopplers & Cardiology.

export interface DiagnosticScopeItem {
  id: string;
  name: string;
  type: "imaging" | "lab_test";
  category: string;
  category_key: "mri" | "ct_scans" | "xrays" | "scans" | "dopplers" | "cardiology" | "blood_tests";
  price: number;
  description: string;
}

export const DIAGNOSTIC_SCOPE_CATEGORIES = [
  { key: "all", label: "All Services (708)" },
  { key: "blood_tests", label: "Blood & Lab Tests (484)" },
  { key: "xrays", label: "Digital X-Rays (62)" },
  { key: "mri", label: "MRI Scans (33)" },
  { key: "ct_scans", label: "CT Scans (31)" },
  { key: "scans", label: "Ultrasound Scans (62)" },
  { key: "dopplers", label: "Doppler Studies (28)" },
  { key: "cardiology", label: "Cardiology (8)" },
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
    "id": "xray_1",
    "name": "X - RAY BOTH  MASTOIDS",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_2",
    "name": "X-RAY ABDOMEN",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_3",
    "name": "X-RAY ANKLE LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_4",
    "name": "X-RAY BLADDER ONE FILM",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_5",
    "name": "X-RAY BOTH ELBOW JOINT AP",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 600.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 600."
  },
  {
    "id": "xray_6",
    "name": "X-RAY BOTH KNEE JOINTS AP / LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 900.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 900."
  },
  {
    "id": "xray_7",
    "name": "X-RAY BOTH KNEES AP / LAT (STANDING)",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 900.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 900."
  },
  {
    "id": "xray_8",
    "name": "X-RAY BOTH MASTOIDS LATERAL VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 600.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 600."
  },
  {
    "id": "xray_9",
    "name": "X-RAY CERVICAL SPINE CONE VIEW LATERAL",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_10",
    "name": "X-RAY CERVICAL SPINE FLEXION/EXTENSION",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 550.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 550."
  },
  {
    "id": "xray_11",
    "name": "X-RAY CERVICAL SPINE LATERAL VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_12",
    "name": "X-RAY CHEST AP VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_13",
    "name": "X-RAY CHEST PA VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_14",
    "name": "X-RAY DORSAL SPINE AP/LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_15",
    "name": "X-RAY DORSO SPINE LAT.VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_16",
    "name": "X-RAY ELBOW AP/LATERAL VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_17",
    "name": "X-RAY ELBOW JOINT LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_18",
    "name": "X-RAY FOREARM AP / LAT",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_19",
    "name": "X-RAY GASTROGRAPHIC STUDY 20 ML",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 1100.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 1100."
  },
  {
    "id": "xray_20",
    "name": "X-RAY HAND AP / LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_21",
    "name": "X-RAY HAND P.A VIEW (BONY AGE)",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_22",
    "name": "X-RAY HAND PA (BONY AGE)",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_23",
    "name": "X-RAY HIP AP / LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_24",
    "name": "X-RAY HIP AP VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_25",
    "name": "X-RAY HIP JOINT AP&LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_26",
    "name": "X-RAY HUMERUS AP VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_27",
    "name": "X-RAY KNEE AP / LAT",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_28",
    "name": "X-RAY KUB",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_29",
    "name": "X-RAY L S SPINE A P VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_30",
    "name": "X-RAY LEFT ANKLE AP / LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_31",
    "name": "X-RAY LEFT KNEE JOINT AP & LATERAL VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_32",
    "name": "X-RAY LEG \u00a0AP/ LAT",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_33",
    "name": "X-RAY LUMBAR SACRAL AP/ LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_34",
    "name": "X-RAY LUMBAR SACRAL SPINE LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_35",
    "name": "X-RAY LUMBAR SPINE AP VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_36",
    "name": "X-RAY LUMBAR SPINE AP/LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_37",
    "name": "X-RAY LUMBAR SPINE EACH OBLIQUE VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_38",
    "name": "X-RAY LUMBO - SACRAL SPINE FLEXION/EXTENSION",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_39",
    "name": "X-RAY LUMBO SACRAL SPINE LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_40",
    "name": "X-RAY MANDIBLE AP/OBLIQUE VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_41",
    "name": "X-RAY MANDIBLE OBLIQUE DOUBLE",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_42",
    "name": "X-RAY MANDIBLE OBLIQUE SINGLE",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_43",
    "name": "X-RAY NASOPHARYNX",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_44",
    "name": "X-RAY NASOPHARYNX  LATERAL VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_45",
    "name": "X-RAY PELVIS AP \u00a0FOR S.I. JOINTS",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_46",
    "name": "X-RAY PELVIS EACH OBLIQUE VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_47",
    "name": "X-RAY PELVIS WITH BOTH HIPS AP/LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_48",
    "name": "X-RAY PELVIS WITH BOTH HIPS AP/LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_49",
    "name": "X-RAY RIGHT FOOT AP / LAT",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_50",
    "name": "X-RAY RIGHT FOOT AP/OBLIQUE",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_51",
    "name": "X-RAY RIGHT KNEE JOINT AP & LATERAL VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_52",
    "name": "X-RAY SACRUM AP VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_53",
    "name": "X-RAY SHOULDER AP / LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_54",
    "name": "X-ray Single Film Charges",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 50.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 50."
  },
  {
    "id": "xray_55",
    "name": "X-RAY SKULL AP/LAT",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_56",
    "name": "X-RAY SOFT TISSUE NECK",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_57",
    "name": "X-RAY STERNUM AP / LAT",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_58",
    "name": "X-RAY TM JOINT AP / LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_59",
    "name": "X-RAY T-TUBE CHOLANGIOGRAM",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 1300.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 1300."
  },
  {
    "id": "xray_60",
    "name": "X-RAY WRIST AP & LAT VIEWS",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 500.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 500."
  },
  {
    "id": "xray_61",
    "name": "X-RAY WRIST AP VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "xray_62",
    "name": "X-RAY WRIST LAT VIEW",
    "type": "imaging",
    "category": "Digital X-Rays",
    "category_key": "xrays",
    "price": 350.0,
    "description": "CallMedex verified digital X-ray benchmarked at Rs. 350."
  },
  {
    "id": "usg_1",
    "name": "ULTRASOUND INGUINAL REGION",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_2",
    "name": "ULTRASOUND HAND",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_3",
    "name": "Ultrasound Axilla",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_4",
    "name": "ULTRASOUND ABDOMEN PELVIS",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_5",
    "name": "ULTRASOUND OF LOWER DORSAL & UPPER LUMBAR REGION",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 2800.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 2800."
  },
  {
    "id": "usg_6",
    "name": "ULTRASOUND EYE",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_7",
    "name": "ULTRASOUND UPPER ABDOMEN",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_8",
    "name": "Ultrasound Guided Diagnostic Peritoneal Fluid Aspiration",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1500.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1500."
  },
  {
    "id": "usg_9",
    "name": "Ultrasound Guided F.C. Puncture",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 2500.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 2500."
  },
  {
    "id": "usg_10",
    "name": "Ultrasound Swelling",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_11",
    "name": "ULTRASOUND EARLY PREGNANCY",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_12",
    "name": "ULTRASOUND OF BREAST",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_13",
    "name": "ULTRASOUND ANTENANTAL",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1300.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1300."
  },
  {
    "id": "usg_14",
    "name": "ULTRASOUND WHOLE ABDOMEN",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_15",
    "name": "ULTRASOUND-TRANS VAGINAL SCAN",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_16",
    "name": "ULTRASOUND SOFT PARTS",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_17",
    "name": "ULTRASOUND TRANSRECTAL",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1500.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1500."
  },
  {
    "id": "usg_18",
    "name": "ULTRASOUND SCROTUM",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1800.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1800."
  },
  {
    "id": "usg_19",
    "name": "ULTRASOUND HRUS( High resolution Ultrasound)",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1500.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1500."
  },
  {
    "id": "usg_20",
    "name": "ULTRASOUND NEURO SONOGRAPHY",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 2000.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 2000."
  },
  {
    "id": "usg_21",
    "name": "ULTRASOUND MARKING",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_22",
    "name": "ULTRASOUND BOTH BREAST",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1800.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1800."
  },
  {
    "id": "usg_23",
    "name": "ULTRASOUND GUIDED BIOPSY",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 4500.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 4500."
  },
  {
    "id": "usg_24",
    "name": "ULTRASOUND EMERGENCY",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1600.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1600."
  },
  {
    "id": "usg_25",
    "name": "ULTRASOUND TIFFA",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 2000.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 2000."
  },
  {
    "id": "usg_26",
    "name": "ULTRASOUND KUB",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_27",
    "name": "ULTRASOUND \u00a0CHEST",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_28",
    "name": "ULTRASOUNDSCANNING FOLICULAR STUDY-3 SITTINGS",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 3000.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 3000."
  },
  {
    "id": "usg_29",
    "name": "ULTRASOUND SCANNING \u00a0PELVIS",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_30",
    "name": "ULTRASOUND GUIDED ASCITIC FLUID ASPIRATION",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1500.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1500."
  },
  {
    "id": "usg_31",
    "name": "ULTRASOUND TRANS RECTAL (T.R.U.S)",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1500.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1500."
  },
  {
    "id": "usg_32",
    "name": "ULTRASOUND BOTH HIP JOINTS",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_33",
    "name": "ULTRASOUND ORBITS",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_34",
    "name": "ULTRASOUND OF LEFT LEG",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_35",
    "name": "ULTRASOUND PERIANAL",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_36",
    "name": "ULTRASOUND RIGHT THIGH",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_37",
    "name": "ULTRASOUND OF RIGHT FOOT",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_38",
    "name": "ULTRASOUND SHOULDER",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_39",
    "name": "Ultrasound Guided Diagnostic Plueral Fluid Aspiration",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1500.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1500."
  },
  {
    "id": "usg_40",
    "name": "ULTRASOUND EMERGENCY",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1600.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1600."
  },
  {
    "id": "usg_41",
    "name": "ULTRASOUNDSCANNING FOLICULAR STUDY-1 SITTINGS",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1250.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1250."
  },
  {
    "id": "usg_42",
    "name": "ULTRASOUND TRANS VAGINAL",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_43",
    "name": "ULTRASOUND PENIS",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_44",
    "name": "ULTRASOUND ABDOMEN & PELVIS",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_45",
    "name": "ULTRASOUND NECK",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_46",
    "name": "ULTRASOUND ANKLE",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_47",
    "name": "ULTRASOUND KUB (Male)",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_48",
    "name": "ULTRASOUND PELVIS",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_49",
    "name": "ULTRASOUND ANOMALY WITH PIH SCREENING",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 2600.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 2600."
  },
  {
    "id": "usg_50",
    "name": "ULTRASOUND OF RIGHT LEG",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_51",
    "name": "ULTRASOUND LEFT FINGER",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_52",
    "name": "ULTRASOUND LABIUM",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_53",
    "name": "ULTRASOUND ABDOMEN FOR MEN",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_54",
    "name": "ULTRASOUND ROUTINE PREGNANCY (TVS)",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_55",
    "name": "ULTRASOUND NT SCAN",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_56",
    "name": "ULTRASOUND ABDOMEN EMERGENCY",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_57",
    "name": "ULTRASOUND OF LEFT WRIST JOINT",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_58",
    "name": "ULTRASOUND ABDOMEN FOR WOMEN",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_59",
    "name": "ULTRASOUND OF RIGHT KNEE JOINT",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1500.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1500."
  },
  {
    "id": "usg_60",
    "name": "ULTRASOUND LEFT HIP JOINT",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_61",
    "name": "ULTRASOUND OF LEFT THIGH",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 1200.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 1200."
  },
  {
    "id": "usg_62",
    "name": "ULTRASOUND OF BOTH FOOT",
    "type": "imaging",
    "category": "Ultrasound Scans",
    "category_key": "scans",
    "price": 2500.0,
    "description": "CallMedex verified ultrasound study benchmarked at Rs. 2500."
  },
  {
    "id": "dop_1",
    "name": "DOPPLER RENAL",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2500.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2500."
  },
  {
    "id": "dop_2",
    "name": "DOPPLER PERIPHERAL ARTERIAL (UNILATERAL)",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_3",
    "name": "DOPPLER STUDY OF BOTH LIMBS ARTERIAL & VENOUS SYSTEMS",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 8000.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 8000."
  },
  {
    "id": "dop_4",
    "name": "Doppler Upper Left Limb Arterial",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_5",
    "name": "DOPPLER NECK VESSELS",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_6",
    "name": "Doppler Lower Limb Single Arterial",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_7",
    "name": "Doppler Uppler Limb Single Venous",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_8",
    "name": "DOPPLER PELVIS",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2000.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2000."
  },
  {
    "id": "dop_9",
    "name": "Doppler Upper Limb Single Arterial",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_10",
    "name": "Doppler Trans-Vaginal (TVS)",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_11",
    "name": "DOPPLER PERIPHERAL ARTERIAL (BILATERAL)",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 4400.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 4400."
  },
  {
    "id": "dop_12",
    "name": "DOPPLER ABDOMINAL (RENAL ILIAC)",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2500.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2500."
  },
  {
    "id": "dop_13",
    "name": "DOPPLER HEPATO PORTAL",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_14",
    "name": "DOPPLER TRANS-VAGINAL (TVS)",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_15",
    "name": "Doppler Renal Transplant",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2500.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2500."
  },
  {
    "id": "dop_16",
    "name": "DOPPLER PERIPHERAL VENOUS (BILATERAL)",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 4400.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 4400."
  },
  {
    "id": "dop_17",
    "name": "DOPPLER ANTENANTAL",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_18",
    "name": "DOPPLER CAROTID",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_19",
    "name": "Doppler Lower Limb Single Venous",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_20",
    "name": "DOPPLER PERIPHERAL VENOUS (UNLATERAL)",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_21",
    "name": "DOPPLER ANTENATAL",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_22",
    "name": "DOPPLER PENILE",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2500.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2500."
  },
  {
    "id": "dop_23",
    "name": "DOPPLER \u00a0SCROTAL",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_24",
    "name": "DOPPLER PERIPHERAL VENOUS (UNLATERAL)",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_25",
    "name": "ARTERIAL DOPPLER STUDY OF BOTH LOWER LIMBS",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 4000.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 4000."
  },
  {
    "id": "dop_26",
    "name": "ARTERIAL DOPPLER OF RIGHT UPPER LIMB",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_27",
    "name": "ARTERIAL DOPPLER STUDY OF LEFT LOWER LIMB",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "dop_28",
    "name": "ARTERIAL DOPPLER STUDY OF RIGHT LOWER LIMB",
    "type": "imaging",
    "category": "Doppler Studies",
    "category_key": "dopplers",
    "price": 2200.0,
    "description": "CallMedex verified vascular doppler study benchmarked at Rs. 2200."
  },
  {
    "id": "card_1",
    "name": "2D ECHO",
    "type": "imaging",
    "category": "Cardiology Diagnostics",
    "category_key": "cardiology",
    "price": 1600.0,
    "description": "CallMedex verified cardiology diagnostic study benchmarked at Rs. 1600."
  },
  {
    "id": "card_2",
    "name": "TMT",
    "type": "imaging",
    "category": "Cardiology Diagnostics",
    "category_key": "cardiology",
    "price": 1600.0,
    "description": "CallMedex verified cardiology diagnostic study benchmarked at Rs. 1600."
  },
  {
    "id": "card_3",
    "name": "ECG",
    "type": "imaging",
    "category": "Cardiology Diagnostics",
    "category_key": "cardiology",
    "price": 150.0,
    "description": "CallMedex verified cardiology diagnostic study benchmarked at Rs. 150."
  },
  {
    "id": "card_4",
    "name": "HOLTER 24 HRS",
    "type": "imaging",
    "category": "Cardiology Diagnostics",
    "category_key": "cardiology",
    "price": 4000.0,
    "description": "CallMedex verified cardiology diagnostic study benchmarked at Rs. 4000."
  },
  {
    "id": "card_5",
    "name": "HOLTER 48 HRS",
    "type": "imaging",
    "category": "Cardiology Diagnostics",
    "category_key": "cardiology",
    "price": 5000.0,
    "description": "CallMedex verified cardiology diagnostic study benchmarked at Rs. 5000."
  },
  {
    "id": "card_6",
    "name": "HOLTER 72 HRS",
    "type": "imaging",
    "category": "Cardiology Diagnostics",
    "category_key": "cardiology",
    "price": 6000.0,
    "description": "CallMedex verified cardiology diagnostic study benchmarked at Rs. 6000."
  },
  {
    "id": "card_7",
    "name": "HOLTER 5 DAYS",
    "type": "imaging",
    "category": "Cardiology Diagnostics",
    "category_key": "cardiology",
    "price": 8000.0,
    "description": "CallMedex verified cardiology diagnostic study benchmarked at Rs. 8000."
  },
  {
    "id": "card_8",
    "name": "HOLTER 7 DAYS",
    "type": "imaging",
    "category": "Cardiology Diagnostics",
    "category_key": "cardiology",
    "price": 10000.0,
    "description": "CallMedex verified cardiology diagnostic study benchmarked at Rs. 10000."
  },
  {
    "id": "lab_1",
    "name": "1,25 Dihydroxy Vitamin D",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3500."
  },
  {
    "id": "lab_2",
    "name": "17 Alpha Hydroxy Progesteron",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1500."
  },
  {
    "id": "lab_3",
    "name": "17 Hydroxy Corticosteroids, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1500."
  },
  {
    "id": "lab_4",
    "name": "17-Ketosteroids, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 10000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 10000."
  },
  {
    "id": "lab_5",
    "name": "25 Hydroxy Vitamin D",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1500."
  },
  {
    "id": "lab_6",
    "name": "5 Hydroxy Indole Acetic Acid, 24 Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3570.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3570."
  },
  {
    "id": "lab_7",
    "name": "Absolute Eosinophil Count (AEC)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_8",
    "name": "Absolute Lymphocyte Count",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 310.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 310."
  },
  {
    "id": "lab_9",
    "name": "Absolute Monocyte Count",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 310.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 310."
  },
  {
    "id": "lab_10",
    "name": "Absolute Neutrophil Count (ANC)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 310.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 310."
  },
  {
    "id": "lab_11",
    "name": "Acetone (Ketone), Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_12",
    "name": "Acetylcholine Receptor Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3270.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3270."
  },
  {
    "id": "lab_13",
    "name": "Activated Partial Thromboplastin Time (APTT)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 300."
  },
  {
    "id": "lab_14",
    "name": "Activated Protein C (APC) Resistance Test,Plasma",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4590.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4590."
  },
  {
    "id": "lab_15",
    "name": "Acute Leukemia Diagnostic Panel",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 12240.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 12240."
  },
  {
    "id": "lab_16",
    "name": "ADA, Ascitic fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_17",
    "name": "ADA, CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_18",
    "name": "ADA, cyst aspiration fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_19",
    "name": "ADA, Guided Aspirate",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_20",
    "name": "ADA, Pericardial Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_21",
    "name": "ADA, Peritoneal Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_22",
    "name": "ADA, Pleural fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_23",
    "name": "ADA, PUS",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_24",
    "name": "ADA, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_25",
    "name": "ADA, Synovial Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_26",
    "name": "Adrenaline (Epinephrine),urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3060.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3060."
  },
  {
    "id": "lab_27",
    "name": "Adreno Corticotrophic Horomone (ACTH)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1800."
  },
  {
    "id": "lab_28",
    "name": "AFB Culture- Biopsy",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_29",
    "name": "AFB Culture, Conventional Method",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1020.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1020."
  },
  {
    "id": "lab_30",
    "name": "AFB Stain, Sputum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 450.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 450."
  },
  {
    "id": "lab_31",
    "name": "AFB Stain, Sputum - 1st Sample",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 450.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 450."
  },
  {
    "id": "lab_32",
    "name": "Albumin, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_33",
    "name": "Albumin, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 410.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 410."
  },
  {
    "id": "lab_34",
    "name": "Albumin, Urine Spot",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 110.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 110."
  },
  {
    "id": "lab_35",
    "name": "Alkaline Phosphatase (ALP)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 170.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 170."
  },
  {
    "id": "lab_36",
    "name": "Alkaline Phosphatase with bone Fraction (Ostase)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_37",
    "name": "Alpha Feto Protein (AFP)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1050.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1050."
  },
  {
    "id": "lab_38",
    "name": "Alpha Feto Protein (AFP), CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_39",
    "name": "ALT (SGPT)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_40",
    "name": "Ammonia",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1020.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1020."
  },
  {
    "id": "lab_41",
    "name": "Amylase, Cyst Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 410.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 410."
  },
  {
    "id": "lab_42",
    "name": "Amylase, Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 410.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 410."
  },
  {
    "id": "lab_43",
    "name": "Amylase, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_44",
    "name": "ANA Profile",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3500."
  },
  {
    "id": "lab_45",
    "name": "ANA PROFILE",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3500."
  },
  {
    "id": "lab_46",
    "name": "Angiotensing Converting Enzyme (ACE)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2800."
  },
  {
    "id": "lab_47",
    "name": "Angiotensing Converting Enzyme (ACE),CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3500."
  },
  {
    "id": "lab_48",
    "name": "Anti DNase B, serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1840.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1840."
  },
  {
    "id": "lab_49",
    "name": "Anti ds DNA",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2200."
  },
  {
    "id": "lab_50",
    "name": "Anti Neutrophil Cytoplasmic Antibody (ANCA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2350.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2350."
  },
  {
    "id": "lab_51",
    "name": "Anti Nuclear Antibodies (ANA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 950.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 950."
  },
  {
    "id": "lab_52",
    "name": "Anti Streptolisin O (ASO)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_53",
    "name": "Anti Thrombin III Activity",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5100."
  },
  {
    "id": "lab_54",
    "name": "Anti Thrombin III Antigen",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5100."
  },
  {
    "id": "lab_55",
    "name": "Anti Thyroid Anti Bodies/TPO/2/ATG",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2700.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2700."
  },
  {
    "id": "lab_56",
    "name": "Anti Thyroid Peroxidase (Anti Tpo), Microsomal Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2800."
  },
  {
    "id": "lab_57",
    "name": "APLA PROFILE",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 6000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 6000."
  },
  {
    "id": "lab_58",
    "name": "Apolipoprotein - B",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_59",
    "name": "AST (SGOT)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_60",
    "name": "B Type Natriuretic Peptide (BNP)(NT-Pro)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3270.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3270."
  },
  {
    "id": "lab_61",
    "name": "Bence Jones Proteins, Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 300."
  },
  {
    "id": "lab_62",
    "name": "Beta 2 Microglobulin, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1800."
  },
  {
    "id": "lab_63",
    "name": "Beta HCG, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1300."
  },
  {
    "id": "lab_64",
    "name": "Beta-2-Glycoprotein I IgG Antibody Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2040.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2040."
  },
  {
    "id": "lab_65",
    "name": "Beta-2-Glycoprotein I IgM Antibody Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2040.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2040."
  },
  {
    "id": "lab_66",
    "name": "Bicarbonate",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_67",
    "name": "Bile Acids-Total, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2040.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2040."
  },
  {
    "id": "lab_68",
    "name": "Bile Salts and Bile Pigments , Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_69",
    "name": "Bilirubin, (Total,Direct,Indirect)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 410.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 410."
  },
  {
    "id": "lab_70",
    "name": "Bilirubin, Direct",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 250."
  },
  {
    "id": "lab_71",
    "name": "Bilirubin, Total",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 250."
  },
  {
    "id": "lab_72",
    "name": "Biochemical analysis, Ascitic fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_73",
    "name": "Biochemical analysis, Peritoneal fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_74",
    "name": "BIOPSY (Large)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_75",
    "name": "BIOPSY MEDIUM",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_76",
    "name": "Bleeding Time",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 30.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 30."
  },
  {
    "id": "lab_77",
    "name": "Blood Culture and Sensitivity - 1st Report",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1350.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1350."
  },
  {
    "id": "lab_78",
    "name": "Blood Culture and Sensitivity - 2nd Report",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1350.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1350."
  },
  {
    "id": "lab_79",
    "name": "Blood Culture and Sensitivity - Final Report",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1350.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1350."
  },
  {
    "id": "lab_80",
    "name": "Blood Grouping and Rh Typing",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_81",
    "name": "Blood Urea Nitrogen (BUN)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_82",
    "name": "Bun Creatinine Ratio",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 410.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 410."
  },
  {
    "id": "lab_83",
    "name": "C- Peptide",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1640.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1640."
  },
  {
    "id": "lab_84",
    "name": "C1 Esterase Inhibitor, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3570.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3570."
  },
  {
    "id": "lab_85",
    "name": "CA - 125",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1300."
  },
  {
    "id": "lab_86",
    "name": "CA 15.3",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_87",
    "name": "CA 19.9",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1500."
  },
  {
    "id": "lab_88",
    "name": "CA-125 Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_89",
    "name": "Calcitonin (Thyrocalcitonin),Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3570.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3570."
  },
  {
    "id": "lab_90",
    "name": "Calcium, Ionized",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 700.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 700."
  },
  {
    "id": "lab_91",
    "name": "Calcium, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_92",
    "name": "Calcium, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_93",
    "name": "Calcium/Creatinine Ratio, Urine spot",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 620.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 620."
  },
  {
    "id": "lab_94",
    "name": "C-ANCA",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2100."
  },
  {
    "id": "lab_95",
    "name": "Carbamezepine (Tegretol)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1530.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1530."
  },
  {
    "id": "lab_96",
    "name": "Carcino Embroynic Antigen (CEA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_97",
    "name": "Cardiolipin IgA Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1230.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1230."
  },
  {
    "id": "lab_98",
    "name": "Cardiolipin IgG Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1230.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1230."
  },
  {
    "id": "lab_99",
    "name": "Cardiolipin IgM Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1250."
  },
  {
    "id": "lab_100",
    "name": "Cardiolipin Profile",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3270.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3270."
  },
  {
    "id": "lab_101",
    "name": "Catecholamines, Urine 24Hrs",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 7900.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 7900."
  },
  {
    "id": "lab_102",
    "name": "CB NAAT Sputum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2500."
  },
  {
    "id": "lab_103",
    "name": "CBC",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 350.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 350."
  },
  {
    "id": "lab_104",
    "name": "CBP WITH ESR",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 650.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 650."
  },
  {
    "id": "lab_105",
    "name": "CD 4 & CD 8 Count",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1500."
  },
  {
    "id": "lab_106",
    "name": "CD 4 Count",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_107",
    "name": "CD3, CD 4 & CD 8 Count",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2700.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2700."
  },
  {
    "id": "lab_108",
    "name": "Cell count & cell type, Ascitic Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 300."
  },
  {
    "id": "lab_109",
    "name": "Cell count & cell type, Bronchial Wash",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 410.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 410."
  },
  {
    "id": "lab_110",
    "name": "Cell count & cell type, CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 410.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 410."
  },
  {
    "id": "lab_111",
    "name": "Cell count & cell type, fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_112",
    "name": "Cell count & cell type, Guided Aspirate Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_113",
    "name": "Cell count & cell type,Dialysis Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_114",
    "name": "Centromere Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_115",
    "name": "Ceruloplasmin(Copper Oxidase), Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1530.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1530."
  },
  {
    "id": "lab_116",
    "name": "Chikungunya IgM Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_117",
    "name": "Chlamydia Trachomatis IgA Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2040.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2040."
  },
  {
    "id": "lab_118",
    "name": "Chlorides, CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 300."
  },
  {
    "id": "lab_119",
    "name": "Chlorides, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_120",
    "name": "Chlorides, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 410.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 410."
  },
  {
    "id": "lab_121",
    "name": "Cholesterol,Total",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_122",
    "name": "Cholinesterase- Acetyl, Plasma",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1500."
  },
  {
    "id": "lab_123",
    "name": "Chyle, Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 300."
  },
  {
    "id": "lab_124",
    "name": "Citrate, Urine 24 H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2040.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2040."
  },
  {
    "id": "lab_125",
    "name": "Clotting Time",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 30.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 30."
  },
  {
    "id": "lab_126",
    "name": "Cobalt, Blood",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4080.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4080."
  },
  {
    "id": "lab_127",
    "name": "COLLAGEN PROFILE",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 6900.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 6900."
  },
  {
    "id": "lab_128",
    "name": "COLLAGEN PROFILE ADVANCED",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 6900.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 6900."
  },
  {
    "id": "lab_129",
    "name": "Complement-3",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1300."
  },
  {
    "id": "lab_130",
    "name": "Complement-4",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1300."
  },
  {
    "id": "lab_131",
    "name": "Complete Blood Picture (CBP)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 350.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 350."
  },
  {
    "id": "lab_132",
    "name": "Complete Urine Examination (CUE)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 160.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 160."
  },
  {
    "id": "lab_133",
    "name": "Coombs Test - Direct (DCT)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_134",
    "name": "Coombs Test - Indirect (ICT)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_135",
    "name": "Copper, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1840.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1840."
  },
  {
    "id": "lab_136",
    "name": "Copper, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2040.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2040."
  },
  {
    "id": "lab_137",
    "name": "Cortisol (4 PM)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 920.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 920."
  },
  {
    "id": "lab_138",
    "name": "Cortisol (8 AM)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 920.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 920."
  },
  {
    "id": "lab_139",
    "name": "Cortisol ,Free Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_140",
    "name": "CPK- MB",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_141",
    "name": "C-Reactive Proteins (CRP)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_142",
    "name": "Creatine Kinase (CPK)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 600.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 600."
  },
  {
    "id": "lab_143",
    "name": "Creatinine Clearance Test, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 620.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 620."
  },
  {
    "id": "lab_144",
    "name": "Creatinine, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 120.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 120."
  },
  {
    "id": "lab_145",
    "name": "Creatinine, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_146",
    "name": "Creatinine, Urine Spot",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_147",
    "name": "Creatinine-GFR by MDRD",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_148",
    "name": "Cryptococcus Antigen, CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3570.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3570."
  },
  {
    "id": "lab_149",
    "name": "CSF ANALYSIS ANURADHA NEURO",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 6020.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 6020."
  },
  {
    "id": "lab_150",
    "name": "CT BOTH TEMPORAL BONES",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 7000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 7000."
  },
  {
    "id": "lab_151",
    "name": "CT GUIDED BIOPSY",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 7500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 7500."
  },
  {
    "id": "lab_152",
    "name": "CT REPORT (SECOND OPINION)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_153",
    "name": "CT STRYKER PROTOCOL",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 9500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 9500."
  },
  {
    "id": "lab_154",
    "name": "Culture & Sensitivity , Tracheal secretion",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 570.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 570."
  },
  {
    "id": "lab_155",
    "name": "Culture and Sensitivity , Biopsy",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_156",
    "name": "Culture and Sensitivity, Ascitic Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_157",
    "name": "Culture and Sensitivity, Bronchial Wash",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_158",
    "name": "Culture and Sensitivity, CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_159",
    "name": "Culture and Sensitivity, cyst aspiration Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_160",
    "name": "Culture and Sensitivity, Ear/Eye Swab",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_161",
    "name": "Culture and Sensitivity, Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_162",
    "name": "Culture and Sensitivity, Guided Aspirate",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_163",
    "name": "Culture and Sensitivity, Nasal Swab",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_164",
    "name": "Culture and Sensitivity, Pleural Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_165",
    "name": "Culture and Sensitivity, Pus",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_166",
    "name": "Culture and Sensitivity, Pus Swab",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_167",
    "name": "Culture and Sensitivity, Sputum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_168",
    "name": "Culture and Sensitivity, Stool",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_169",
    "name": "Culture and Sensitivity, Synovial Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_170",
    "name": "Culture and Sensitivity, Throat Swab",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 700.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 700."
  },
  {
    "id": "lab_171",
    "name": "Culture and Sensitivity, Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_172",
    "name": "Culture and Sensitivity,Urethral Swab",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_173",
    "name": "Culture and Sensitivity,Vaginal Swab",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_174",
    "name": "Culture and Sensitivity,Wound Swab",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_175",
    "name": "Culture and Sensivity ,Cervical swab",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_176",
    "name": "Cyclic Citrullinated Peptide (CCP) Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1900.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1900."
  },
  {
    "id": "lab_177",
    "name": "Cytology, Ascitic Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_178",
    "name": "Cytology, Papsmear",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_179",
    "name": "Cytology, Papsmear",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_180",
    "name": "Cytology, Papsmear by LBC Method",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1230.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1230."
  },
  {
    "id": "lab_181",
    "name": "D-Dimer",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1500."
  },
  {
    "id": "lab_182",
    "name": "Dehydro Epiandrosterone Sulphate (DHEA-S)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1600.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1600."
  },
  {
    "id": "lab_183",
    "name": "Dengue Antigen NS1 (ELISA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 950.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 950."
  },
  {
    "id": "lab_184",
    "name": "Dengue Ig G & Ig M - Rapid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 950.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 950."
  },
  {
    "id": "lab_185",
    "name": "Dengue IgG IgM NS1 (Rapid)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 950.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 950."
  },
  {
    "id": "lab_186",
    "name": "Dengue Serology",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 950.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 950."
  },
  {
    "id": "lab_187",
    "name": "Di HydroTestosterone (DHT)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_188",
    "name": "Differential Count (DC)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 50.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 50."
  },
  {
    "id": "lab_189",
    "name": "Double Marker Test",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3060.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3060."
  },
  {
    "id": "lab_190",
    "name": "Double Marker Test Graph",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3060.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3060."
  },
  {
    "id": "lab_191",
    "name": "EEGUSG PACKAGE",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2400."
  },
  {
    "id": "lab_192",
    "name": "Electrolytes, 24H Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_193",
    "name": "Electrolytes, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 450.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 450."
  },
  {
    "id": "lab_194",
    "name": "Electrolytes, Urine spot",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 450.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 450."
  },
  {
    "id": "lab_195",
    "name": "Erythrocyte Sedimentation Rate (ESR)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_196",
    "name": "Erythropoitin, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3570.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3570."
  },
  {
    "id": "lab_197",
    "name": "Estradiol (E2)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_198",
    "name": "Estriol unconjugated (E3)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1530.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1530."
  },
  {
    "id": "lab_199",
    "name": "Factor-I (Fibrinogen) Activity",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1230.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1230."
  },
  {
    "id": "lab_200",
    "name": "Fat, Stool",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 210.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 210."
  },
  {
    "id": "lab_201",
    "name": "FBS AND PPBS",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_202",
    "name": "Ferritin, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_203",
    "name": "FNAC Blind Procedure & Report",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1500."
  },
  {
    "id": "lab_204",
    "name": "Folic Acid, serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_205",
    "name": "Follicular Stimulating Hormone (FSH)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 650.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 650."
  },
  {
    "id": "lab_206",
    "name": "Free Beta HCG,Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1130.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1130."
  },
  {
    "id": "lab_207",
    "name": "Fungal Culture, Sputum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 920.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 920."
  },
  {
    "id": "lab_208",
    "name": "Fungal Stain, CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_209",
    "name": "G6PD , Blood",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_210",
    "name": "GAD 65 (Glutamic Acid Decorboxilase) Antibodies",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 7550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 7550."
  },
  {
    "id": "lab_211",
    "name": "Gamma GT (GGTP)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_212",
    "name": "Ganglioside Antibody,Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4000."
  },
  {
    "id": "lab_213",
    "name": "Gene expert (xpert MTB)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3060.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3060."
  },
  {
    "id": "lab_214",
    "name": "Gene expert PUS",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3060.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3060."
  },
  {
    "id": "lab_215",
    "name": "Globulin Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_216",
    "name": "Glucose Challenge Test (GCT)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_217",
    "name": "GLUCOSE TOLERANCE TEST (3 Samples)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_218",
    "name": "Glucose, (RBS)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 50.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 50."
  },
  {
    "id": "lab_219",
    "name": "Glucose, Fasting (FBS)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 50.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 50."
  },
  {
    "id": "lab_220",
    "name": "Glucose, Post Lunch (PLBS)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 50.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 50."
  },
  {
    "id": "lab_221",
    "name": "Glycosylated Hb (HbA1C)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_222",
    "name": "Grams Stain, Ascitic Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_223",
    "name": "Grams Stain, Bronchial Wash",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_224",
    "name": "Grams Stain, CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_225",
    "name": "Grams Stain, Pericardial Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_226",
    "name": "Grams Stain, Pleural Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_227",
    "name": "Grams Stain, Pus",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_228",
    "name": "Grams Stain, Stool",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_229",
    "name": "Grams Stain, Wound Swab",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_230",
    "name": "GTT - 1st Hour Plasma Glucose",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 0.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 0."
  },
  {
    "id": "lab_231",
    "name": "GTT -Fasting Plasma Glucose( 3 Samples )",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_232",
    "name": "Haemogram",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_233",
    "name": "Haptoglobin",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3270.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3270."
  },
  {
    "id": "lab_234",
    "name": "HBV-DNA Detection (Qualitative)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4080.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4080."
  },
  {
    "id": "lab_235",
    "name": "HBV-DNA Quantification (Viral load)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5600.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5600."
  },
  {
    "id": "lab_236",
    "name": "HCV Genotyping",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 8160.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 8160."
  },
  {
    "id": "lab_237",
    "name": "HCV RNA Quantification (Viral load)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5100."
  },
  {
    "id": "lab_238",
    "name": "Hemoglobin (HB%)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_239",
    "name": "Hemoglobin Electrophoresis",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1400."
  },
  {
    "id": "lab_240",
    "name": "Hepatitis A Virus (HAV) IgM Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1500."
  },
  {
    "id": "lab_241",
    "name": "Hepatitis A Virus Antibody, (IgG) Total",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1300."
  },
  {
    "id": "lab_242",
    "name": "Hepatitis B Core Antibody Toatl(HBcAb - Total)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1530.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1530."
  },
  {
    "id": "lab_243",
    "name": "Hepatitis B Core Antigen (HBcAg), IgM Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_244",
    "name": "Hepatitis B Envelope Antibody (HBeAb)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_245",
    "name": "Hepatitis B Envelope Antigen (HBeAg )",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_246",
    "name": "Hepatitis B Surface Antibody,Total (Anti Hbs Titre)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_247",
    "name": "Hepatitis B surface Antigen (HBsAg)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_248",
    "name": "Hepatitis B surface Antigen (HBsAg) - Elisa",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_249",
    "name": "Hepatitis B Surface antigen (HBsAg) (CMIA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_250",
    "name": "Hepatitis B surface Antigen (HBsAg) Screening (Rapid)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 300."
  },
  {
    "id": "lab_251",
    "name": "Hepatitis C Virus (HCV) Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1700.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1700."
  },
  {
    "id": "lab_252",
    "name": "Hepatitis C Virus (HCV) Antibody - Elisa",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 720.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 720."
  },
  {
    "id": "lab_253",
    "name": "Hepatitis C Virus Antibody (Anti HCV) Screening (Rapid)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_254",
    "name": "Hepatitis C Virus(HCV Anitibody)  (CLIA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1500."
  },
  {
    "id": "lab_255",
    "name": "Hepatitis E Virus (HEV) IgG Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2500."
  },
  {
    "id": "lab_256",
    "name": "Hepatitis E Virus (HEV) IgM Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_257",
    "name": "Herpes Simplex Virus I & II - IgG",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_258",
    "name": "High Sensitivity - CRP (HS-CRP)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 980.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 980."
  },
  {
    "id": "lab_259",
    "name": "Histopathology ( Medium )",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_260",
    "name": "Histopathology (Extra Large)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1530.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1530."
  },
  {
    "id": "lab_261",
    "name": "Histopathology (Large)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1600.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1600."
  },
  {
    "id": "lab_262",
    "name": "Histopathology (Small)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_263",
    "name": "HIV 1& 2 Ag/Ab (4th generation)  (CMIA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_264",
    "name": "HIV ELISA",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_265",
    "name": "HIV I & II Antibody Screening (Rapid)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 250."
  },
  {
    "id": "lab_266",
    "name": "HIV P-24 Antigen",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2040.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2040."
  },
  {
    "id": "lab_267",
    "name": "HIV-1-RNA Quantification (Viral Load)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5100."
  },
  {
    "id": "lab_268",
    "name": "HLA - B27",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3300."
  },
  {
    "id": "lab_269",
    "name": "HLA - B27 By PCR",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4080.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4080."
  },
  {
    "id": "lab_270",
    "name": "HLA - Cross Match",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 6120.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 6120."
  },
  {
    "id": "lab_271",
    "name": "Homocysteine-Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 950.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 950."
  },
  {
    "id": "lab_272",
    "name": "Homogentisic Acid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1230.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1230."
  },
  {
    "id": "lab_273",
    "name": "HPV-DNA detection (Qualitative)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3800."
  },
  {
    "id": "lab_274",
    "name": "HSV I & II IgG & IgM antibodies",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2500."
  },
  {
    "id": "lab_275",
    "name": "Immunoglobulin IgA",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_276",
    "name": "Immunoglobulin IgG",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_277",
    "name": "Immunoglobulin IgM",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_278",
    "name": "Immunoglobulin Profile, CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4080.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4080."
  },
  {
    "id": "lab_279",
    "name": "Insulin - Fasting serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 900.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 900."
  },
  {
    "id": "lab_280",
    "name": "Insulin - Post ,Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 900.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 900."
  },
  {
    "id": "lab_281",
    "name": "Insulin Antibody, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_282",
    "name": "Insulin like Growth factor(IGF)-1(Somatomedin C)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4400."
  },
  {
    "id": "lab_283",
    "name": "Intact Parathyroid Hormone (iPTH)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2250."
  },
  {
    "id": "lab_284",
    "name": "INTERLEUKIN 6",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2500."
  },
  {
    "id": "lab_285",
    "name": "Iron",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 410.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 410."
  },
  {
    "id": "lab_286",
    "name": "Iron with TIBC",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 720.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 720."
  },
  {
    "id": "lab_287",
    "name": "JAK-2 Mutation,Blood",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 7140.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 7140."
  },
  {
    "id": "lab_288",
    "name": "Kappa & Lambda Light Chains- Free, Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5610.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5610."
  },
  {
    "id": "lab_289",
    "name": "Kappa Light Chains- Free, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3060.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3060."
  },
  {
    "id": "lab_290",
    "name": "Karyotyping Whole Blood",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4590.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4590."
  },
  {
    "id": "lab_291",
    "name": "KOH Examination, Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 310.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 310."
  },
  {
    "id": "lab_292",
    "name": "KOH Examination, Nasal swab",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 310.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 310."
  },
  {
    "id": "lab_293",
    "name": "KOH Examination, Sputum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 310.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 310."
  },
  {
    "id": "lab_294",
    "name": "KOH Examination, Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 350.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 350."
  },
  {
    "id": "lab_295",
    "name": "Lactate",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1530.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1530."
  },
  {
    "id": "lab_296",
    "name": "Lactate Dehydrogenase (LDH), Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_297",
    "name": "Lactate Dehydrogenase (LDH), Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_298",
    "name": "LC-1 (Liver Cytosolic Antigen type-1)Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3060.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3060."
  },
  {
    "id": "lab_299",
    "name": "Legionella Antigen Detection, Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2660.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2660."
  },
  {
    "id": "lab_300",
    "name": "Leishmania Antibody-IgG(Kala Azar)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_301",
    "name": "Leptin",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 6120.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 6120."
  },
  {
    "id": "lab_302",
    "name": "Leptospira Detection,Blood",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_303",
    "name": "Leptospira Detection,CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_304",
    "name": "Leptospira IgG Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_305",
    "name": "Leptospira IgM Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1530.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1530."
  },
  {
    "id": "lab_306",
    "name": "Levetiracetam, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4080.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4080."
  },
  {
    "id": "lab_307",
    "name": "Lipase serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 550."
  },
  {
    "id": "lab_308",
    "name": "Lipase,Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 800."
  },
  {
    "id": "lab_309",
    "name": "Lipase,Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 820.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 820."
  },
  {
    "id": "lab_310",
    "name": "Lipid Profile",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_311",
    "name": "Lipoprotein-(a)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_312",
    "name": "Lithium",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 820.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 820."
  },
  {
    "id": "lab_313",
    "name": "Liver Function Test (LFT)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_314",
    "name": "LKM I Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_315",
    "name": "Lupus Anticoagulants (LAC)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3270.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3270."
  },
  {
    "id": "lab_316",
    "name": "Luteinizing Hormone (LH)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_317",
    "name": "Lyme (Borrelia Burgdorferi) Antibody IgM",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_318",
    "name": "Lyme (Borrelia Burgdorferi)Antibody IgG",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_319",
    "name": "Magnesium",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 610.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 610."
  },
  {
    "id": "lab_320",
    "name": "Magnesium 24Hrs Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1530.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1530."
  },
  {
    "id": "lab_321",
    "name": "MCH",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_322",
    "name": "Measels (Rubeola) IgM Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_323",
    "name": "Metanephrine, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3300."
  },
  {
    "id": "lab_324",
    "name": "Metanephrine-Free,Plasma",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4080.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4080."
  },
  {
    "id": "lab_325",
    "name": "Meth haemoglobin",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 920.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 920."
  },
  {
    "id": "lab_326",
    "name": "Microalbumin, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_327",
    "name": "Microalbumin/Creatinine ratio, Urine Spot",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 620.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 620."
  },
  {
    "id": "lab_328",
    "name": "Mitochondrial Antibody (AMA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2250."
  },
  {
    "id": "lab_329",
    "name": "MRI CARDIAC WITH CONTRAST",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 12500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 12500."
  },
  {
    "id": "lab_330",
    "name": "MRI LEFT KNEE JOINT",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5000."
  },
  {
    "id": "lab_331",
    "name": "Mullerian Inhibiting Substance (AMH)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2100."
  },
  {
    "id": "lab_332",
    "name": "Mumps IgG Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_333",
    "name": "Mumps IgM Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2040.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2040."
  },
  {
    "id": "lab_334",
    "name": "Musk Antibody,Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 6630.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 6630."
  },
  {
    "id": "lab_335",
    "name": "Mycobacterium TB DNA Detection",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2250."
  },
  {
    "id": "lab_336",
    "name": "Mycoplasma Pneumoniae IgG Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3200."
  },
  {
    "id": "lab_337",
    "name": "Mycoplasma Pneumoniae IgM Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3200."
  },
  {
    "id": "lab_338",
    "name": "Nasal Smear for Eosinophil Count",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 310.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 310."
  },
  {
    "id": "lab_339",
    "name": "Natural Killer Cells (NKC), Blood",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5100."
  },
  {
    "id": "lab_340",
    "name": "Neuronal Antibody Profile",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 11220.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 11220."
  },
  {
    "id": "lab_341",
    "name": "NIPT",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 40000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 40000."
  },
  {
    "id": "lab_342",
    "name": "Occult Blood, Stool",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_343",
    "name": "Oligoclonal band By IEF, CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5100."
  },
  {
    "id": "lab_344",
    "name": "ORTHOPANTOMOGRAM (OPG)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 480.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 480."
  },
  {
    "id": "lab_345",
    "name": "Osmolality, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 820.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 820."
  },
  {
    "id": "lab_346",
    "name": "Osmolality, Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 820.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 820."
  },
  {
    "id": "lab_347",
    "name": "Osmotic Fragility Test",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 920.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 920."
  },
  {
    "id": "lab_348",
    "name": "Ova Cyst, Stool",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_349",
    "name": "P-ANCA",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2100."
  },
  {
    "id": "lab_350",
    "name": "PAPP - A",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1840.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1840."
  },
  {
    "id": "lab_351",
    "name": "Parathyroid Hormone (PTH)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2040.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2040."
  },
  {
    "id": "lab_352",
    "name": "Peripheral Smear for Abnormal Cells",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 300."
  },
  {
    "id": "lab_353",
    "name": "Peripheral Smear For Malarial Parasites",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 250."
  },
  {
    "id": "lab_354",
    "name": "Peripheral Smear Study",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 300."
  },
  {
    "id": "lab_355",
    "name": "Phenytoin (Eptoin)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1530.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1530."
  },
  {
    "id": "lab_356",
    "name": "Phospholipid Antibody (IgG)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1230.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1230."
  },
  {
    "id": "lab_357",
    "name": "Phospholipid Antibody (IgM)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1230.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1230."
  },
  {
    "id": "lab_358",
    "name": "Phosphorous, 24Hrs Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_359",
    "name": "Phosphorous, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_360",
    "name": "Phosphorous, Urine Spot",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_361",
    "name": "Platelet Count",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_362",
    "name": "Pneumocystis Carinii Detection, Fluid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4080.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4080."
  },
  {
    "id": "lab_363",
    "name": "PNH- Confirmation test, Blood",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 8160.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 8160."
  },
  {
    "id": "lab_364",
    "name": "Porphobilinogen (PBG), Quantitative Urine 24 H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4080.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4080."
  },
  {
    "id": "lab_365",
    "name": "POST PRANDIAL BLOOD SUGAR (PPBS)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 50.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 50."
  },
  {
    "id": "lab_366",
    "name": "Potassium Urine Spot",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 410.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 410."
  },
  {
    "id": "lab_367",
    "name": "Potassium, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_368",
    "name": "Potassium, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_369",
    "name": "Potassium/Creatinine ratio, Urine spot",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_370",
    "name": "Pregnancy Test, Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_371",
    "name": "Procalcitonin, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3460.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3460."
  },
  {
    "id": "lab_372",
    "name": "Progesterone",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 900.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 900."
  },
  {
    "id": "lab_373",
    "name": "Prolactin",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 600.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 600."
  },
  {
    "id": "lab_374",
    "name": "Prostate Specific Antigen, Free",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_375",
    "name": "Prostate Specific Antigen, Total (PSA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 900.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 900."
  },
  {
    "id": "lab_376",
    "name": "Protein Electrophoresis",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1600.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1600."
  },
  {
    "id": "lab_377",
    "name": "Protein Electrophoresis (Oligoclonal Bands), CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5610.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5610."
  },
  {
    "id": "lab_378",
    "name": "Protein Electrophoresis, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_379",
    "name": "Protein Total with Albumin",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 300."
  },
  {
    "id": "lab_380",
    "name": "Protein/Creatinine ratio, Urine 24 Hours",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_381",
    "name": "Protein/Creatinine ratio, Urine Spot",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_382",
    "name": "Protein/Creatinine ratio, Urine Spot",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_383",
    "name": "Proteins Total, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_384",
    "name": "Proteins, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_385",
    "name": "Proteins, Urine Spot",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_386",
    "name": "Prothrombin Time (PT)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 450.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 450."
  },
  {
    "id": "lab_387",
    "name": "Prothrombin Time With INR",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 300."
  },
  {
    "id": "lab_388",
    "name": "Pulmonary Function Test",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_389",
    "name": "QBC for MP",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 250."
  },
  {
    "id": "lab_390",
    "name": "Quadraple marker",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3050.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3050."
  },
  {
    "id": "lab_391",
    "name": "Quadruple Markar Graph",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3300."
  },
  {
    "id": "lab_392",
    "name": "Rapid Malaria Test (PF)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 250."
  },
  {
    "id": "lab_393",
    "name": "Red Blood Cells Count (RBC)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_394",
    "name": "Reducing Substances, Stool",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_395",
    "name": "RENAL FUNCTION TESTS",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1190.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1190."
  },
  {
    "id": "lab_396",
    "name": "Reticulocyte Count",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_397",
    "name": "Rheumatoid Factor (RA Factor)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 480.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 480."
  },
  {
    "id": "lab_398",
    "name": "Rheumatoid Factor IgM, Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1640.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1640."
  },
  {
    "id": "lab_399",
    "name": "RT PCR FOR COVID 19",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_400",
    "name": "Rubella Antibodies (IgG & IgM)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1530.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1530."
  },
  {
    "id": "lab_401",
    "name": "Rubella IgG Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 920.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 920."
  },
  {
    "id": "lab_402",
    "name": "Rubella IgM Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 920.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 920."
  },
  {
    "id": "lab_403",
    "name": "SAR2 (COVID 19) IG G ANTIBODIES",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_404",
    "name": "SARS 2 (COVID19) ANTIBODIES IG G, IG M QUANTITATIVE",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1600.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1600."
  },
  {
    "id": "lab_405",
    "name": "Scrub Typhus Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_406",
    "name": "Second Opinion, Slide",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_407",
    "name": "Selenium, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5100."
  },
  {
    "id": "lab_408",
    "name": "Selenium, Urine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5100."
  },
  {
    "id": "lab_409",
    "name": "Semen  Analysis (CASA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_410",
    "name": "Semen Analysis",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 300."
  },
  {
    "id": "lab_411",
    "name": "Semen Analysis (Casa Method)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_412",
    "name": "Sex Hormone Binding Globulin (SHBG)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2550.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2550."
  },
  {
    "id": "lab_413",
    "name": "Sickle Cell Test",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 250."
  },
  {
    "id": "lab_414",
    "name": "Small Bowel Enema",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2500."
  },
  {
    "id": "lab_415",
    "name": "Smear of Microfilaria Detection ,Blood",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 250."
  },
  {
    "id": "lab_416",
    "name": "Smith IgG Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2250."
  },
  {
    "id": "lab_417",
    "name": "Smooth Muscle Antibody (ASMA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1640.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1640."
  },
  {
    "id": "lab_418",
    "name": "Sodium, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_419",
    "name": "Sodium, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_420",
    "name": "Sodium, Urine Spot",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_421",
    "name": "Soluble Liver Antigen (SLA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3640.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3640."
  },
  {
    "id": "lab_422",
    "name": "Sono Mammography",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1500."
  },
  {
    "id": "lab_423",
    "name": "Stool Routine Examination",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_424",
    "name": "SURGICAL PROFILE 1 Padmasri Ivf",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2429.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2429."
  },
  {
    "id": "lab_425",
    "name": "TB -PCR",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2200."
  },
  {
    "id": "lab_426",
    "name": "TB Quantiferon",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3680.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3680."
  },
  {
    "id": "lab_427",
    "name": "TB-Gold",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2900.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2900."
  },
  {
    "id": "lab_428",
    "name": "Testosterone, Free",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1800.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1800."
  },
  {
    "id": "lab_429",
    "name": "Testosterone, Total",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 920.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 920."
  },
  {
    "id": "lab_430",
    "name": "Thyroglobulin,Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2300."
  },
  {
    "id": "lab_431",
    "name": "Thyroid Antibodies (TG,TPO)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2700.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2700."
  },
  {
    "id": "lab_432",
    "name": "Thyroid Peroxidase Antibodies (TPO, Microsomal)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_433",
    "name": "Thyroid Profile (T3,T4,TSH)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_434",
    "name": "Thyroid Stimulating Hormone (TSH)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 250."
  },
  {
    "id": "lab_435",
    "name": "Thyroxine, Free (F-T4)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 350.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 350."
  },
  {
    "id": "lab_436",
    "name": "Thyroxine, Total (T4)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_437",
    "name": "Tissue Transglutaminase Antibody IgA, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3570.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3570."
  },
  {
    "id": "lab_438",
    "name": "Tissue Transglutaminase IgG Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3570.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3570."
  },
  {
    "id": "lab_439",
    "name": "Torch Profile - 10",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3200."
  },
  {
    "id": "lab_440",
    "name": "Torch Profile - 4 IgM",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2040.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2040."
  },
  {
    "id": "lab_441",
    "name": "Total IGE",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1200."
  },
  {
    "id": "lab_442",
    "name": "Total Iron Binding Capacity (TIBC)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 510.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 510."
  },
  {
    "id": "lab_443",
    "name": "TOTAL LFT",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 750.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 750."
  },
  {
    "id": "lab_444",
    "name": "Toxoplasma IgG Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 920.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 920."
  },
  {
    "id": "lab_445",
    "name": "Toxoplasma IgM Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 700.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 700."
  },
  {
    "id": "lab_446",
    "name": "Transferrin",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1300."
  },
  {
    "id": "lab_447",
    "name": "Transferrin Saturation",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 720.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 720."
  },
  {
    "id": "lab_448",
    "name": "Treponema Pallidum Haemagglutination Assay (TPHA)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_449",
    "name": "TRIDOT",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 250.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 250."
  },
  {
    "id": "lab_450",
    "name": "Triglycerides",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 350.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 350."
  },
  {
    "id": "lab_451",
    "name": "Triidothyronine, Free (F-T3)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 350.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 350."
  },
  {
    "id": "lab_452",
    "name": "Triidothyronine, Total (T3)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 150.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 150."
  },
  {
    "id": "lab_453",
    "name": "Triple Marker",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3060.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3060."
  },
  {
    "id": "lab_454",
    "name": "Triple Marker Graph",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2900.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2900."
  },
  {
    "id": "lab_455",
    "name": "Troponin-I",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1300."
  },
  {
    "id": "lab_456",
    "name": "Troponin-T",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1500."
  },
  {
    "id": "lab_457",
    "name": "Trus Guided Prostate Biopsy",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 7000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 7000."
  },
  {
    "id": "lab_458",
    "name": "TSH Receptor Antibodies (LATS-TSI), Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 5100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 5100."
  },
  {
    "id": "lab_459",
    "name": "Tuberculin Skin Test (Mantoux)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_460",
    "name": "Typhi. IgM Antibody",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_461",
    "name": "Urea, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 120.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 120."
  },
  {
    "id": "lab_462",
    "name": "Urea, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 400.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 400."
  },
  {
    "id": "lab_463",
    "name": "Uric Acid, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_464",
    "name": "Urine Cotinine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 500.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 500."
  },
  {
    "id": "lab_465",
    "name": "Urine Routine",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 100.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 100."
  },
  {
    "id": "lab_466",
    "name": "US THYROID",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_467",
    "name": "USG THYROID",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_468",
    "name": "Valproic Acid",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1230.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1230."
  },
  {
    "id": "lab_469",
    "name": "Vanillyl Mandelic Acid (VMA), Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3900.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3900."
  },
  {
    "id": "lab_470",
    "name": "VDRL (RPR), CSF",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 310.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 310."
  },
  {
    "id": "lab_471",
    "name": "VDRL (RPR), Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_472",
    "name": "Vitamin -A (Retinol), Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4590.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4590."
  },
  {
    "id": "lab_473",
    "name": "Vitamin B1 (Thaimine),Blood",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3570.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3570."
  },
  {
    "id": "lab_474",
    "name": "Vitamin B12 (Cyanocobalamine),Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1000."
  },
  {
    "id": "lab_475",
    "name": "Vitamin B2 (Riboflavin), Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4080.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4080."
  },
  {
    "id": "lab_476",
    "name": "Vitamin B6 (Pyridoxin), Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3570.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3570."
  },
  {
    "id": "lab_477",
    "name": "Vitamin C (Ascorbic Acid)",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4080.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4080."
  },
  {
    "id": "lab_478",
    "name": "Vitamin E (Tocopherol), Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 4590.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 4590."
  },
  {
    "id": "lab_479",
    "name": "Vitamin K1",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 6000.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 6000."
  },
  {
    "id": "lab_480",
    "name": "Weil Feilx Test",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 1530.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 1530."
  },
  {
    "id": "lab_481",
    "name": "Western Blot Test For HIV- 1",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3700.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3700."
  },
  {
    "id": "lab_482",
    "name": "Widal Test, Slide Method",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 200.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 200."
  },
  {
    "id": "lab_483",
    "name": "Zinc, Serum",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 3300.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 3300."
  },
  {
    "id": "lab_484",
    "name": "Zinc, Urine 24H",
    "type": "lab_test",
    "category": "Blood & Clinical Pathology",
    "category_key": "blood_tests",
    "price": 2570.0,
    "description": "CallMedex NABL-calibrated lab test benchmarked at Rs. 2570."
  }
];
