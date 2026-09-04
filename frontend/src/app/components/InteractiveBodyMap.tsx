"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Stethoscope, FlaskConical, Video, Building2, Star, MapPin, Search,
  CheckCircle2, ArrowLeft, ClipboardList, Activity, Layers, Box,
  Sparkles, Smile, Eye, Ear, Brain, Heart, Wind, Droplet, Bone,
  type LucideIcon,
} from "lucide-react";
import AnatomicalTwin3D from "./AnatomicalTwin3D";

interface TestDetail {
  name: string;
  turnaround: string;
  price: number;
  marketPrice: number;
  parameters: string;
}

interface OrganInfo {
  id: string;
  name: string;
  Icon: LucideIcon;
  specialization: string;
  color: string;
  vitalSummary: string;
  tests: string[];
  testDetails: TestDetail[];
  description: string;
}

const ORGANS: Record<string, OrganInfo> = {
  skin: {
    id: "skin",
    name: "Skin & Hair (Dermatology)",
    Icon: Sparkles,
    specialization: "Dermatology",
    color: "var(--cm-magenta, #db2777)",
    vitalSummary: "Epidermal Barrier: Intact · Allergen Sensitivity: Low",
    tests: ["Skin Biopsy", "Allergy Comprehensive Panel", "Dermatology Teleconsult", "Fungal Culture"],
    testDetails: [
      { name: "Comprehensive Allergy Profile", turnaround: "24-48 Hours", price: 1499, marketPrice: 2800, parameters: "42 Inhalant & Food Allergens" },
      { name: "Fungal & Bacterial Culture", turnaround: "72 Hours", price: 650, marketPrice: 1200, parameters: "Targeted Pathogen Resistance" },
    ],
    description: "Complete skin barrier, acne, eczema, and hair health evaluation.",
  },
  dental: {
    id: "dental",
    name: "Teeth & Oral Care (Dentistry)",
    Icon: Smile,
    specialization: "Dentistry",
    color: "var(--cm-teal, #0d9488)",
    vitalSummary: "Gingival Index: Grade 0 · Decay Risk: Minimal",
    tests: ["Dental X-Ray (OPG)", "Scaling & Polishing", "Cavity & Gum Inspection"],
    testDetails: [
      { name: "Oral Hygiene & Cavity Screen", turnaround: "Instant Physical", price: 399, marketPrice: 800, parameters: "32-Tooth Digital Mapping" },
      { name: "Digital Dental OPG X-Ray", turnaround: "Same Day", price: 550, marketPrice: 1100, parameters: "Full Panoramic Jaw View" },
    ],
    description: "Comprehensive oral hygiene, tooth decay check, and gum disease screening.",
  },
  eyes: {
    id: "eyes",
    name: "Eyes & Vision (Ophthalmology)",
    Icon: Eye,
    specialization: "Ophthalmology",
    color: "var(--cm-active, #0369a1)",
    vitalSummary: "Visual Acuity: 20/20 · Intraocular Pressure: 14 mmHg (Normal)",
    tests: ["Refraction Vision Test", "Fundus Examination", "Tonometry (Eye Pressure)", "Dry Eye Screening"],
    testDetails: [
      { name: "Digital Glaucoma Pressure Screen", turnaround: "Instant", price: 450, marketPrice: 900, parameters: "Non-Contact Tonometry (IOP)" },
      { name: "Retinal Fundus Photography", turnaround: "Same Day", price: 799, marketPrice: 1600, parameters: "Diabetic Retinopathy & Macular Check" },
    ],
    description: "Vision clarity, cataract screening, glaucoma pressure, and retina check.",
  },
  ent: {
    id: "ent",
    name: "Ears, Nose & Throat (ENT)",
    Icon: Ear,
    specialization: "ENT",
    color: "var(--cm-waiting, #b45309)",
    vitalSummary: "Audiometry Threshold: 15 dB · Nasal Airway: Clear",
    tests: ["Audiometry Hearing Test", "Nasal Endoscopy", "Throat Swab Culture", "Sinus Evaluation"],
    testDetails: [
      { name: "Pure Tone Audiometry (PTA)", turnaround: "Instant Report", price: 600, marketPrice: 1200, parameters: "Air & Bone Conduction Testing" },
      { name: "Throat Culture & Sensitivity", turnaround: "48 Hours", price: 550, marketPrice: 1000, parameters: "Streptococcal & Viral Screening" },
    ],
    description: "Ear hearing clarity, nasal blockage check, and throat infection diagnosis.",
  },
  head: {
    id: "head",
    name: "Brain & Nervous System (Neurology)",
    Icon: Brain,
    specialization: "Neurology",
    color: "#4338ca",
    vitalSummary: "Cognitive Load: Balanced · Migraine Triggers: Low",
    tests: ["Brain MRI / CT Scan", "EEG (Electroencephalogram)", "Migraine Risk Panel"],
    testDetails: [
      { name: "Migraine & Neuro Biomarker Panel", turnaround: "Same Day", price: 899, marketPrice: 1800, parameters: "Electrolytes, Vitamin B12, Magnesium" },
      { name: "Digital EEG Brain Mapping", turnaround: "24 Hours", price: 1800, marketPrice: 3500, parameters: "32-Channel Cortical Activity" },
    ],
    description: "Headache evaluation, stroke prevention, and nerve reflex mapping.",
  },
  heart: {
    id: "heart",
    name: "Heart & Cardiovascular System",
    Icon: Heart,
    specialization: "Cardiology",
    color: "var(--cm-urgent, #d92020)",
    vitalSummary: "Resting HR: 72 bpm · Blood Pressure: 118/78 mmHg · Cardiac Risk: Low",
    tests: ["ECG (12-Lead)", "Echocardiogram (2D Echo)", "Lipid Profile", "Cardiac Troponin T"],
    testDetails: [
      { name: "Lipid Profile Comprehensive", turnaround: "6-8 Hours", price: 499, marketPrice: 1100, parameters: "8 Parameters (Cholesterol, HDL, LDL, VLDL, Trigs)" },
      { name: "Cardiac Troponin I High-Sensitivity", turnaround: "3 Hours", price: 699, marketPrice: 1500, parameters: "Early Myocardial Stress Detection" },
      { name: "Digital 12-Lead ECG Home Tracing", turnaround: "Instant Tracing", price: 299, marketPrice: 600, parameters: "Cardiologist Certified Interpretation" },
    ],
    description: "Coronary health, blood pressure control, and cardiac risk score.",
  },
  lungs: {
    id: "lungs",
    name: "Lungs & Respiratory System",
    Icon: Wind,
    specialization: "Pulmonology",
    color: "var(--cm-active, #0369a1)",
    vitalSummary: "SpO2: 98% Room Air · Peak Expiratory Flow: 460 L/min",
    tests: ["Chest X-Ray (PA View)", "Spirometry (Pulmonary Function)", "SpO2 & ABG Test"],
    testDetails: [
      { name: "Pulmonary Function Spirometry", turnaround: "Same Day", price: 750, marketPrice: 1500, parameters: "FVC, FEV1, FEF25-75% Vital Capacity" },
      { name: "Digital High-Res Chest X-Ray", turnaround: "4 Hours", price: 450, marketPrice: 900, parameters: "AI-Assisted Lung Field Analysis" },
    ],
    description: "Asthma, bronchitis, oxygen saturation, and respiratory capacity check.",
  },
  abdomen: {
    id: "abdomen",
    name: "Abdomen & Digestive System",
    Icon: Droplet,
    specialization: "Gastroenterology",
    color: "var(--cm-done, #15803d)",
    vitalSummary: "Liver Enzymes: Balanced · Renal Clearance (eGFR): >90 mL/min",
    tests: ["Ultrasound Abdomen & Pelvis", "Liver Function Test (LFT)", "Kidney Function Test (KFT)"],
    testDetails: [
      { name: "Liver Function Test (LFT 12-Param)", turnaround: "6-8 Hours", price: 449, marketPrice: 950, parameters: "SGOT, SGPT, Bilirubin, Protein, Albumin" },
      { name: "Kidney Function Test (KFT / RFT)", turnaround: "6-8 Hours", price: 449, marketPrice: 950, parameters: "Creatinine, Urea, Uric Acid, BUN" },
    ],
    description: "Liver health, stomach digestion, kidney filtration, and gut microbiome.",
  },
  joints: {
    id: "joints",
    name: "Joints, Bones & Spine (Orthopedics)",
    Icon: Bone,
    specialization: "Orthopedics",
    color: "var(--cm-waiting, #b45309)",
    vitalSummary: "Bone Mineral Density: Normal · Uric Acid: 4.8 mg/dL",
    tests: ["Bone Mineral Density (DEXA)", "Joint X-Ray", "Uric Acid Test", "RA Factor"],
    testDetails: [
      { name: "Bone Health Duo (Calcium + Vit D3)", turnaround: "Same Day", price: 799, marketPrice: 1800, parameters: "Total 25-OH Vitamin D & Serum Calcium" },
      { name: "Arthritis & Uric Acid Profile", turnaround: "6 Hours", price: 599, marketPrice: 1300, parameters: "RA Quantitative Factor & Serum Uric Acid" },
    ],
    description: "Arthritis screening, bone density, cartilage strength, and spinal alignment.",
  },
};

// Callout geometry for the 2D anatomy plate (viewBox 0 0 240 460).
// cx/cy = callout node position outside the body; ax/ay = the anatomical site it points at.
const HOTSPOTS: { id: string; cx: number; cy: number; ax: number; ay: number }[] = [
  { id: "head", cx: 38, cy: 30, ax: 120, ay: 34 },
  { id: "eyes", cx: 34, cy: 72, ax: 111, ay: 55 },
  { id: "ent", cx: 202, cy: 30, ax: 143, ay: 52 },
  { id: "dental", cx: 206, cy: 72, ax: 128, ay: 67 },
  { id: "lungs", cx: 30, cy: 140, ax: 98, ay: 154 },
  { id: "heart", cx: 210, cy: 134, ax: 134, ay: 143 },
  { id: "abdomen", cx: 208, cy: 194, ax: 136, ay: 184 },
  { id: "skin", cx: 30, cy: 210, ax: 72, ay: 210 },
  { id: "joints", cx: 44, cy: 324, ax: 102, ay: 324 },
];

// Static plate geometry — hoisted so the SVG stays declarative.
const VERTEBRAE = [96, 107, 118, 129, 140, 151, 162, 173, 184, 195, 206, 217, 228];
const RIB_LEVELS = [118, 132, 146, 160];
const JOINT_NODES: [number, number][] = [
  [86, 112], [154, 112], [75, 180], [165, 180],
  [102, 324], [138, 324], [100, 386], [140, 386],
];
const DENTITION: [number, number][] = [[112, 0], [116, 1.0], [120, 1.4], [124, 1.0], [128, 0]];

export default function InteractiveBodyMap() {
  const router = useRouter();
  const [selectedOrgan, setSelectedOrgan] = useState<string>("heart");
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [consultMode, setConsultMode] = useState<null | "choosing" | "offline_list">(null);
  const [realClinics, setRealClinics] = useState<any[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState<boolean>(false);
  const current = ORGANS[selectedOrgan] || ORGANS["heart"];

  useEffect(() => {
    if (consultMode === "offline_list") {
      setClinicsLoading(true);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      fetch(`${apiBase}/api/providers/search/doctors?specialization=${encodeURIComponent(current.specialization)}&consultation_mode=in_person`)
        .then(r => r.json())
        .then(data => {
          setRealClinics(data.doctors || []);
        })
        .catch(() => {
          setRealClinics([]);
        })
        .finally(() => {
          setClinicsLoading(false);
        });
    }
  }, [consultMode, current.specialization]);

  const handleOnlineConsult = () => {
    router.push(`/consultation?spec=${encodeURIComponent(current.specialization)}&mode=online`);
  };

  return (
    <div className="cm-panel" style={{ background: "var(--cm-surface)", border: "1px solid var(--cm-line)", boxShadow: "var(--cm-shadow-1)" }}>
      {/* Header Bar with clinical telemetry badge */}
      <div className="cm-row-between" style={{ marginBottom: "var(--cm-4)", flexWrap: "wrap", gap: "var(--cm-3)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--cm-2)" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: "var(--cm-radius)", background: "var(--cm-surface-2)", color: "var(--cm-navy)",
              border: "1px solid var(--cm-line)"
            }}>
              <Activity size={18} />
            </span>
            <h3 className="cm-panel__title" style={{ margin: 0, fontSize: "var(--cm-text-lg)", color: "var(--cm-ink)", fontWeight: 800 }}>
              Interactive Anatomical Twin
            </h3>
            <span className="cm-pill cm-pill--done" style={{ fontWeight: 700, fontSize: "var(--cm-text-xs)" }}>
              Clinical Telemetry
            </span>
          </div>
          <p className="cm-panel__note" style={{ margin: "var(--cm-1) 0 0 0", color: "var(--cm-ink-3)", fontSize: "var(--cm-text-sm)" }}>
            Select an anatomical region to review vital benchmarks, certified NABL diagnostic panels, and consult verified specialists.
          </p>
        </div>

        {/* 3D / 2D View Switcher */}
        <div style={{ display: "inline-flex", background: "var(--cm-surface-2)", padding: 3, borderRadius: "var(--cm-radius)", border: "1px solid var(--cm-line)" }}>
          <button
            type="button"
            onClick={() => setViewMode("3d")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: "calc(var(--cm-radius) - 2px)",
              fontSize: "var(--cm-text-xs)", fontWeight: 700,
              background: viewMode === "3d" ? "var(--cm-surface)" : "transparent",
              color: viewMode === "3d" ? "var(--cm-navy)" : "var(--cm-ink-3)",
              border: viewMode === "3d" ? "1px solid var(--cm-line-strong)" : "1px solid transparent",
              boxShadow: viewMode === "3d" ? "var(--cm-shadow-1)" : "none",
              cursor: "pointer",
            }}
          >
            <Box size={14} /> 3D Anatomical Twin
          </button>
          <button
            type="button"
            onClick={() => setViewMode("2d")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: "calc(var(--cm-radius) - 2px)",
              fontSize: "var(--cm-text-xs)", fontWeight: 700,
              background: viewMode === "2d" ? "var(--cm-surface)" : "transparent",
              color: viewMode === "2d" ? "var(--cm-navy)" : "var(--cm-ink-3)",
              border: viewMode === "2d" ? "1px solid var(--cm-line-strong)" : "1px solid transparent",
              boxShadow: viewMode === "2d" ? "var(--cm-shadow-1)" : "none",
              cursor: "pointer",
            }}
          >
            <Layers size={14} /> 2D Anatomy Map
          </button>
        </div>
      </div>

      {/* Main Grid: Anatomical Twin + Organ Clinical Dossier */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr", gap: "var(--cm-5)", alignItems: "start" }}>

        {/* Left Column: 3D Twin OR 2D Fallback */}
        {viewMode === "3d" ? (
          <AnatomicalTwin3D
            selectedOrgan={selectedOrgan}
            onSelectOrgan={(id) => { setSelectedOrgan(id); setConsultMode(null); }}
          />
        ) : (
          <div style={{
            background: "var(--cm-surface)",
            border: "1px solid var(--cm-line)",
            borderRadius: "var(--cm-radius-lg)",
            padding: "var(--cm-4)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxShadow: "var(--cm-shadow-1)",
          }}>
            <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--cm-line)", paddingBottom: 8, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
              <span style={{ fontWeight: 700, color: "var(--cm-navy)" }}>2D Clinical Anatomy Plate</span>
              <span>Projection: Anterior Coronal</span>
            </div>

            {/* Studio Anatomical Plate — layered systems with anatomical leader callouts */}
            <div style={{ width: "100%", maxWidth: 360, margin: "var(--cm-4) 0" }}>
              <svg viewBox="0 0 240 424" style={{ width: "100%", maxHeight: 420, display: "block" }} role="img" aria-label="Interactive 2D anatomy map">
                <defs>
                  {/* Clinical plate backdrop */}
                  <linearGradient id="bm-plate" x1="0" y1="0" x2="0" y2="424" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fbfdff" />
                    <stop offset="100%" stopColor="#eaf0f7" />
                  </linearGradient>
                  <pattern id="bm-grid" width="15" height="15" patternUnits="userSpaceOnUse">
                    <path d="M15 0H0V15" fill="none" stroke="#0f172a" strokeOpacity="0.05" strokeWidth="0.7" />
                  </pattern>
                  <radialGradient id="bm-vignette" cx="120" cy="196" r="205" gradientUnits="userSpaceOnUse">
                    <stop offset="52%" stopColor="#ffffff" stopOpacity="0" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0.08" />
                  </radialGradient>

                  {/* Dermal / soft-tissue shell */}
                  <linearGradient id="bm-skin" x1="70" y1="16" x2="180" y2="410" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#eaf2fb" />
                    <stop offset="45%" stopColor="#d5e4f3" />
                    <stop offset="100%" stopColor="#b3cae1" />
                  </linearGradient>
                  <linearGradient id="bm-limb" x1="55" y1="90" x2="190" y2="410" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#e3edf8" />
                    <stop offset="100%" stopColor="#b0c7de" />
                  </linearGradient>

                  {/* Organ system palettes */}
                  <linearGradient id="bm-brain" x1="100" y1="20" x2="142" y2="52" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a5b4fc" />
                    <stop offset="60%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#3730a3" />
                  </linearGradient>
                  <linearGradient id="bm-lung" x1="88" y1="112" x2="154" y2="186" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a5dff9" />
                    <stop offset="55%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#0369a1" />
                  </linearGradient>
                  <linearGradient id="bm-heart" x1="112" y1="130" x2="142" y2="160" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fb7185" />
                    <stop offset="55%" stopColor="#e11d48" />
                    <stop offset="100%" stopColor="#881337" />
                  </linearGradient>
                  <linearGradient id="bm-liver" x1="86" y1="164" x2="122" y2="196" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="60%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#4c1d95" />
                  </linearGradient>
                  <linearGradient id="bm-gut" x1="94" y1="196" x2="150" y2="238" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fcd34d" />
                    <stop offset="100%" stopColor="#c2751a" />
                  </linearGradient>
                  <linearGradient id="bm-bone" x1="84" y1="90" x2="160" y2="400" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#a9b7c6" />
                  </linearGradient>
                  <linearGradient id="bm-derm" x1="58" y1="194" x2="88" y2="226" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fbcfe8" />
                    <stop offset="100%" stopColor="#be185d" />
                  </linearGradient>

                  {/* Depth + focus filters */}
                  <filter id="bm-soft" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.16" />
                  </filter>
                  <filter id="bm-focus" x="-70%" y="-70%" width="240%" height="240%">
                    <feGaussianBlur stdDeviation="3" result="bmBlur" />
                    <feMerge>
                      <feMergeNode in="bmBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* ── Plate backdrop ── */}
                <rect x="0" y="0" width="240" height="424" rx="16" fill="url(#bm-plate)" />
                <rect x="0" y="0" width="240" height="424" rx="16" fill="url(#bm-grid)" />
                <rect x="0" y="0" width="240" height="424" rx="16" fill="url(#bm-vignette)" />
                <rect x="0.6" y="0.6" width="238.8" height="422.8" rx="16" fill="none" stroke="var(--cm-line)" strokeWidth="1.2" />

                {/* ── Layer 1: soft-tissue body shell ── */}
                <g filter="url(#bm-soft)">
                  {/* Limbs as tapered round-capped strokes */}
                  <g stroke="#9db4cc" strokeOpacity="0.55" strokeLinecap="round" fill="none">
                    <path d="M86 112L75 180" strokeWidth="22" />
                    <path d="M154 112L165 180" strokeWidth="22" />
                    <path d="M75 180L69 238" strokeWidth="18" />
                    <path d="M165 180L171 238" strokeWidth="18" />
                    <path d="M69 238L67 257" strokeWidth="15" />
                    <path d="M171 238L173 257" strokeWidth="15" />
                    <path d="M106 256L102 324" strokeWidth="31" />
                    <path d="M134 256L138 324" strokeWidth="31" />
                    <path d="M102 324L100 386" strokeWidth="22" />
                    <path d="M138 324L140 386" strokeWidth="22" />
                  </g>
                  <g stroke="url(#bm-limb)" strokeLinecap="round" fill="none">
                    <path d="M86 112L75 180" strokeWidth="20" />
                    <path d="M154 112L165 180" strokeWidth="20" />
                    <path d="M75 180L69 238" strokeWidth="16" />
                    <path d="M165 180L171 238" strokeWidth="16" />
                    <path d="M69 238L67 257" strokeWidth="13" />
                    <path d="M171 238L173 257" strokeWidth="13" />
                    <path d="M106 256L102 324" strokeWidth="29" />
                    <path d="M134 256L138 324" strokeWidth="29" />
                    <path d="M102 324L100 386" strokeWidth="20" />
                    <path d="M138 324L140 386" strokeWidth="20" />
                  </g>
                  {/* Feet */}
                  <path d="M91 394C91 389 95 386 100 386C105 386 109 389 109 394L111 403C111 407 107 409 101 409H94C90 409 88 406 89 402L91 394Z" fill="url(#bm-limb)" />
                  <path d="M149 394C149 389 145 386 140 386C135 386 131 389 131 394L129 403C129 407 133 409 139 409H146C150 409 152 406 151 402L149 394Z" fill="url(#bm-limb)" />

                  {/* Torso: sloped trapezius, tapered ribcage, defined waist */}
                  <path
                    d="M104 88C90 92 82 101 80 115C78 131 82 150 88 168C92 180 92 190 90 200C88 213 88 227 92 241C94 250 96 255 98 259H142C144 255 146 250 148 241C152 227 152 213 150 200C148 190 148 180 152 168C158 150 162 131 160 115C158 101 150 92 136 88H104Z"
                    fill="url(#bm-skin)"
                    stroke="#9db4cc"
                    strokeOpacity="0.55"
                    strokeWidth="1.2"
                  />
                  {/* Neck */}
                  <path d="M110 70H130V88C130 91 126 93 120 93C114 93 110 91 110 88V70Z" fill="url(#bm-skin)" />
                  {/* Cranium + mandible */}
                  <path d="M120 16C136 16 146 27 146 43C146 53 142 62 135 70C131 75 126 78 120 78C114 78 109 75 105 70C98 62 94 53 94 43C94 27 104 16 120 16Z" fill="url(#bm-skin)" stroke="#9db4cc" strokeOpacity="0.55" strokeWidth="1.2" />
                </g>

                {/* Anatomical midline + transverse reference planes */}
                <g stroke="#0f172a" strokeOpacity="0.14" strokeWidth="0.9" strokeDasharray="4 5">
                  <path d="M120 96V250" />
                  <path d="M80 145H160" />
                  <path d="M88 196H152" />
                  <path d="M92 248H148" />
                </g>

                {/* ── Layer 2: skeletal frame ── */}
                <g opacity={selectedOrgan === "joints" ? 1 : 0.42} filter={selectedOrgan === "joints" ? "url(#bm-focus)" : undefined}>
                  {/* Costal arches, drawn before the column so the spine reads on top */}
                  {RIB_LEVELS.map((y, i) => (
                    <g key={"rib-" + y} fill="none" stroke="url(#bm-bone)" strokeWidth={3 - i * 0.25} strokeLinecap="round" opacity="0.95">
                      <path d={"M115 " + y + "C105 " + (y + 3) + " 96 " + (y + 10) + " 93 " + (y + 20)} />
                      <path d={"M125 " + y + "C135 " + (y + 3) + " 144 " + (y + 10) + " 147 " + (y + 20)} />
                    </g>
                  ))}
                  {/* Vertebral column */}
                  {VERTEBRAE.map((y) => (
                    <rect key={"vert-" + y} x="116" y={y} width="8" height="7" rx="2.6" fill="url(#bm-bone)" stroke="#8fa1b4" strokeOpacity="0.5" strokeWidth="0.6" />
                  ))}
                  {/* Pelvic girdle — outline weight only, a filled basin read as clothing */}
                  <path d="M94 232C94 246 101 256 112 257L120 244L128 257C139 256 146 246 146 232C138 228 128 226 120 226C112 226 102 228 94 232Z" fill="url(#bm-bone)" fillOpacity="0.4" stroke="#9aa9b8" strokeWidth="0.9" />
                  {/* Long bones of the appendicular skeleton */}
                  <g stroke="#8ea3b8" strokeLinecap="round" fill="none" opacity="0.5">
                    <path d="M86 114L76 178" strokeWidth="6" />
                    <path d="M154 114L164 178" strokeWidth="6" />
                    <path d="M76 182L70 236" strokeWidth="4.6" />
                    <path d="M164 182L170 236" strokeWidth="4.6" />
                    <path d="M104 258L102 320" strokeWidth="8" />
                    <path d="M136 258L138 320" strokeWidth="8" />
                    <path d="M102 328L100 382" strokeWidth="6" />
                    <path d="M138 328L140 382" strokeWidth="6" />
                  </g>
                  {/* Articular joint capsules */}
                  {JOINT_NODES.map(([cx, cy]) => (
                    <circle key={"joint-" + cx + "-" + cy} cx={cx} cy={cy} r="5" fill="#ffffff" fillOpacity="0.9" stroke="#7c8da0" strokeWidth="1.3" />
                  ))}
                </g>

                {/* ── Layer 3: respiratory system ── */}
                <g opacity={selectedOrgan === "lungs" ? 1 : 0.6} filter={selectedOrgan === "lungs" ? "url(#bm-focus)" : undefined}>
                  {/* Trachea + primary bronchi */}
                  <path d="M120 93V114" stroke="#0369a1" strokeWidth="4.6" strokeLinecap="round" />
                  <path d="M120 114L108 124M120 114L132 124" stroke="#0369a1" strokeWidth="3.2" strokeLinecap="round" />
                  {/* Right lung, three lobes (patient right = viewer left) */}
                  <path d="M112 121C98 124 88 140 88 160C88 177 95 188 105 188C111 188 114 181 114 170L112 121Z" fill="url(#bm-lung)" />
                  {/* Left lung, two lobes with a cardiac notch on the medial border */}
                  <path d="M128 121C142 124 152 140 152 160C152 177 145 188 135 188C129 188 126 181 126 170L131 156L126 141L128 121Z" fill="url(#bm-lung)" />
                  {/* Segmental bronchial tree */}
                  <g stroke="#eff9ff" strokeOpacity="0.7" strokeWidth="1.2" fill="none" strokeLinecap="round">
                    <path d="M108 126L102 143M108 126L105 156M102 143L96 156" />
                    <path d="M132 126L138 143M132 126L135 156M138 143L144 156" />
                  </g>
                </g>

                {/* ── Layer 4: cardiovascular system ── */}
                <g opacity={selectedOrgan === "heart" ? 1 : 0.78} filter={selectedOrgan === "heart" ? "url(#bm-focus)" : undefined}>
                  {/* Aortic arch + superior vena cava */}
                  <path d="M128 122C134 125 137 130 136 136" stroke="#dc2626" strokeWidth="2.8" fill="none" strokeLinecap="round" />
                  <path d="M120 122C116 125 114 129 115 135" stroke="#2563eb" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                  {/* Myocardium — seated left of midline, apex pointing down-left */}
                  <path d="M131 137C135 132 141 134 141 140C141 147 136 154 128 160C126.5 161 125.5 161 124 160C117 154 112 147 112 140C112 134 118 132 122 137L126.5 140L131 137Z" fill="url(#bm-heart)" />
                  <path d="M119 143C121 146 123 148 126 150" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  {/* Interventricular groove */}
                  <path d="M126.5 141V158" stroke="#7f1d1d" strokeOpacity="0.45" strokeWidth="1.2" />
                </g>

                {/* ── Layer 5: digestive / abdominal system ── */}
                <g opacity={selectedOrgan === "abdomen" ? 1 : 0.58} filter={selectedOrgan === "abdomen" ? "url(#bm-focus)" : undefined}>
                  {/* Hepatic wedge — right upper quadrant (patient right, viewer left) */}
                  <path d="M119 172C104 169 91 173 88 182C85 191 93 198 106 198C114 198 119 194 119 187V172Z" fill="url(#bm-liver)" />
                  <path d="M117 175C109 174 100 176 94 181" stroke="#ffffff" strokeOpacity="0.26" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  {/* Gastric body — left upper quadrant (patient left, viewer right) */}
                  <path d="M124 173C133 174 140 180 139 188C138 195 131 199 126 195C122 192 123 187 122 182C121.4 179 122 176 124 173Z" fill="#f472b6" />
                  {/* Colonic frame + small-bowel coil */}
                  <path d="M102 203C102 198 138 198 138 205C138 212 102 211 102 218C102 225 138 224 138 231" stroke="url(#bm-gut)" strokeWidth="6" fill="none" strokeLinecap="round" strokeOpacity="0.78" />
                </g>

                {/* ── Layer 6: cranial & sensory systems ──
                    Drawn as clinical annotation (vault, orbits, occlusal chart,
                    auricles) rather than facial features, which read cartoonish. */}
                <g opacity={selectedOrgan === "head" ? 1 : 0.7} filter={selectedOrgan === "head" ? "url(#bm-focus)" : undefined}>
                  <path d="M120 21C132 21 139 29 139 38C139 43 137 46 134 48H106C103 46 101 43 101 38C101 29 108 21 120 21Z" fill="url(#bm-brain)" />
                  <g stroke="#e0e7ff" strokeOpacity="0.72" strokeWidth="1.3" fill="none" strokeLinecap="round">
                    <path d="M108 30C112 27 115 31 112 34C109 37 113 40 116 38" />
                    <path d="M131 29C127 32 130 36 133 33" />
                    <path d="M120 22V47" strokeOpacity="0.4" />
                  </g>
                </g>

                {selectedOrgan === "eyes" && (
                  <g filter="url(#bm-focus)">
                    <ellipse cx="111" cy="55" rx="5.6" ry="4.6" fill="#ffffff" fillOpacity="0.75" stroke="#0369a1" strokeWidth="1.3" />
                    <ellipse cx="129" cy="55" rx="5.6" ry="4.6" fill="#ffffff" fillOpacity="0.75" stroke="#0369a1" strokeWidth="1.3" />
                    <circle cx="111" cy="55" r="2" fill="none" stroke="#0369a1" strokeWidth="1.1" />
                    <circle cx="129" cy="55" r="2" fill="none" stroke="#0369a1" strokeWidth="1.1" />
                  </g>
                )}

                {selectedOrgan === "dental" && (
                  <g filter="url(#bm-focus)">
                    <path d="M110 66.5C113 70.5 127 70.5 130 66.5" stroke="#0d9488" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                    {DENTITION.map(([x, dy]) => (
                      <rect key={"tooth-" + x} x={x - 1.4} y={63 + dy} width="2.8" height="3.2" rx="1" fill="#ffffff" stroke="#0d9488" strokeWidth="0.8" />
                    ))}
                  </g>
                )}

                {selectedOrgan === "ent" && (
                  <g filter="url(#bm-focus)">
                    {/* Auricles overlapping the temporal contour, not floating beside it */}
                    <path d="M100 46C96 47 95 53 97 58C98 60 100 60 101 58" fill="#fde9c8" stroke="#b45309" strokeWidth="1.4" strokeLinejoin="round" />
                    <path d="M140 46C144 47 145 53 143 58C142 60 140 60 139 58" fill="#fde9c8" stroke="#b45309" strokeWidth="1.4" strokeLinejoin="round" />
                    {/* Nasal airway and pharynx */}
                    <path d="M120 56V62" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M120 74V92" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />
                  </g>
                )}

                {/* ── Layer 7: integumentary sample field ── */}
                <g opacity={selectedOrgan === "skin" ? 1 : 0.62} filter={selectedOrgan === "skin" ? "url(#bm-focus)" : undefined}>
                  <circle cx="72" cy="210" r="10" fill="url(#bm-derm)" fillOpacity="0.5" stroke="#be185d" strokeWidth="1.3" />
                  <circle cx="72" cy="210" r="4.6" fill="none" stroke="#fce7f3" strokeWidth="1.1" />
                </g>

                {/* ── Layer 8: interactive clinical callouts ── */}
                {HOTSPOTS.map((spot) => {
                  const isSelected = spot.id === selectedOrgan;
                  const org = ORGANS[spot.id];
                  const SpotIcon = org.Icon;
                  const spotColor = org.color;
                  const r = isSelected ? 14.5 : 12.5;

                  return (
                    <g
                      key={spot.id}
                      onClick={() => { setSelectedOrgan(spot.id); setConsultMode(null); }}
                      style={{ cursor: "pointer" }}
                      role="button"
                      aria-label={org.name}
                    >
                      {/* Leader line back to the anatomical site */}
                      <path
                        d={"M" + spot.cx + " " + spot.cy + "L" + spot.ax + " " + spot.ay}
                        stroke={isSelected ? spotColor : "#94a3b8"}
                        strokeWidth={isSelected ? 1.5 : 0.9}
                        strokeDasharray={isSelected ? undefined : "3 4"}
                        strokeOpacity={isSelected ? 0.85 : 0.5}
                      />
                      <circle cx={spot.ax} cy={spot.ay} r={isSelected ? 3.4 : 2.2} fill={isSelected ? spotColor : "#94a3b8"} />
                      {isSelected && <circle cx={spot.ax} cy={spot.ay} r="8" fill="none" stroke={spotColor} strokeWidth="1.3" strokeOpacity="0.5" />}

                      {/* Callout node */}
                      {isSelected && <circle cx={spot.cx} cy={spot.cy} r={r + 6} fill={spotColor} fillOpacity="0.12" />}
                      <circle
                        cx={spot.cx}
                        cy={spot.cy}
                        r={r}
                        fill={isSelected ? spotColor : "#ffffff"}
                        stroke={isSelected ? spotColor : "var(--cm-line-strong)"}
                        strokeWidth={isSelected ? 2 : 1.3}
                        filter="url(#bm-soft)"
                      />
                      <svg
                        x={spot.cx - r * 0.56}
                        y={spot.cy - r * 0.56}
                        width={r * 1.12}
                        height={r * 1.12}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={isSelected ? "#ffffff" : "var(--cm-ink-2)"}
                        strokeWidth={2.2}
                        pointerEvents="none"
                      >
                        <SpotIcon width={24} height={24} />
                      </svg>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div style={{ width: "100%", background: "var(--cm-surface-2)", padding: "8px 12px", borderRadius: "var(--cm-radius)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Selected System</span>
              <span style={{ fontSize: "var(--cm-text-xs)", fontWeight: 800, color: "var(--cm-navy)" }}>{current.name.split(" ")[0]}</span>
            </div>
          </div>
        )}

        {/* Right Column: Selected Organ Clinical Dossier */}
        <div className="cm-card" style={{ border: `1px solid var(--cm-line)`, borderTop: `4px solid ${current.color}`, borderRadius: "var(--cm-radius-lg)", boxShadow: "var(--cm-shadow-1)" }}>
          {/* Dossier Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--cm-3)", marginBottom: "var(--cm-3)" }}>
            <span style={{
              display: "grid", placeItems: "center", width: 46, height: 46, borderRadius: "var(--cm-radius)",
              background: "var(--cm-surface-2)", color: current.color, flex: "none", border: `1px solid var(--cm-line)`
            }}>
              <current.Icon size={24} />
            </span>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, fontSize: "var(--cm-text-base)", color: "var(--cm-ink)", fontWeight: 800 }}>{current.name}</h4>
              <span className="cm-pill cm-pill--active" style={{ marginTop: 4, background: "var(--cm-surface-2)", color: "var(--cm-ink)", border: "1px solid var(--cm-line-strong)" }}>
                {current.specialization} Specialist Care
              </span>
            </div>
          </div>

          <p style={{ fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)", margin: "0 0 var(--cm-4) 0", lineHeight: 1.5 }}>
            {current.description}
          </p>

          {/* Vitals Benchmark Card */}
          <div style={{ background: "var(--cm-surface-2)", padding: "12px 14px", borderRadius: "var(--cm-radius)", marginBottom: "var(--cm-4)", border: "1px solid var(--cm-line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--cm-2)", marginBottom: 4 }}>
              <ClipboardList size={16} style={{ color: current.color }} />
              <strong style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Clinical Benchmark Target
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-2)", fontWeight: 600 }}>
              {current.vitalSummary}
            </p>
          </div>

          {/* Recommended Diagnostic Test Cards */}
          <div style={{ marginBottom: "var(--cm-5)" }}>
            <strong style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink)", textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 8 }}>
              Certified NABL Diagnostic Panels
            </strong>
            <div style={{ display: "grid", gap: 8 }}>
              {current.testDetails.map((t, i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--cm-surface)", border: "1px solid var(--cm-line)",
                    borderRadius: "var(--cm-radius)", padding: "10px 14px",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle2 size={14} style={{ color: "var(--cm-done)" }} />
                      {t.name}
                    </div>
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2 }}>
                      {t.parameters} · <span style={{ color: "var(--cm-active)", fontWeight: 600 }}>{t.turnaround}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: "var(--cm-text-base)", color: "var(--cm-ink)", fontVariantNumeric: "tabular-nums" }}>₹{t.price}</div>
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", textDecoration: "line-through", fontVariantNumeric: "tabular-nums" }}>₹{t.marketPrice}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Consultation Actions — Online / Offline choice */}
          {consultMode === null && (
            <div style={{ display: "flex", gap: "var(--cm-2)", flexWrap: "wrap" }}>
              <button
                type="button"
                className="cm-btn cm-btn--primary"
                style={{ flex: 1, padding: "10px 16px", fontWeight: 700 }}
                onClick={() => setConsultMode("choosing")}
              >
                <Stethoscope size={16} /> Consult {current.specialization}
              </button>
              <button
                type="button"
                className="cm-btn cm-btn--secondary"
                style={{ flex: 1, padding: "10px 16px", fontWeight: 700 }}
                onClick={() => router.push(`/diagnostics?search=${encodeURIComponent(current.name)}`)}
              >
                <FlaskConical size={16} /> Book Lab Package
              </button>
            </div>
          )}

          {/* Online vs Offline Choice */}
          {consultMode === "choosing" && (
            <div style={{ background: "var(--cm-surface-2)", borderRadius: "var(--cm-radius)", padding: "var(--cm-4)", border: "1px solid var(--cm-line)" }}>
              <div className="cm-row-between" style={{ marginBottom: "var(--cm-3)" }}>
                <strong style={{ color: "var(--cm-navy)", fontSize: "var(--cm-text-sm)" }}>
                  Select Consultation Channel
                </strong>
                <button type="button" onClick={() => setConsultMode(null)} className="cm-btn cm-btn--ghost cm-btn--sm">
                  <ArrowLeft size={14} /> Back
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--cm-3)" }}>
                <button
                  type="button"
                  onClick={handleOnlineConsult}
                  className="cm-card cm-card--interactive"
                  style={{ textAlign: "center", border: "2px solid var(--cm-navy)", background: "var(--cm-surface)" }}
                >
                  <Video size={22} style={{ color: "var(--cm-navy)", marginBottom: 6 }} />
                  <div style={{ fontWeight: 700, color: "var(--cm-navy)", fontSize: "var(--cm-text-sm)" }}>
                    Teleconsultation
                  </div>
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 4 }}>
                    HD video call with verified specialist.
                  </div>
                  <span className="cm-pill cm-pill--done" style={{ marginTop: 8 }}>Available Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConsultMode("offline_list")}
                  className="cm-card cm-card--interactive"
                  style={{ textAlign: "center", border: "1px solid var(--cm-line)", background: "var(--cm-surface)" }}
                >
                  <Building2 size={22} style={{ color: "var(--cm-ink)", marginBottom: 6 }} />
                  <div style={{ fontWeight: 700, color: "var(--cm-ink)", fontSize: "var(--cm-text-sm)" }}>
                    Clinic Visit
                  </div>
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 4 }}>
                    In-person physical examination.
                  </div>
                  <span className="cm-pill cm-pill--active" style={{ marginTop: 8 }}>Partner Clinic</span>
                </button>
              </div>
            </div>
          )}

          {/* Offline Clinic List */}
          {consultMode === "offline_list" && (
            <div style={{ background: "var(--cm-surface-2)", borderRadius: "var(--cm-radius)", padding: "var(--cm-4)", border: "1px solid var(--cm-line)" }}>
              <div className="cm-row-between" style={{ marginBottom: "var(--cm-3)" }}>
                <strong style={{ color: "var(--cm-ink)", fontSize: "var(--cm-text-sm)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Building2 size={14} /> Walk-in {current.specialization} Clinics
                </strong>
                <button type="button" onClick={() => setConsultMode("choosing")} className="cm-btn cm-btn--ghost cm-btn--sm">
                  <ArrowLeft size={14} /> Back
                </button>
              </div>

              {clinicsLoading ? (
                <div style={{ textAlign: "center", padding: "var(--cm-5)", color: "var(--cm-ink-3)", fontSize: "var(--cm-text-sm)" }}>
                  Searching verified clinics…
                </div>
              ) : realClinics.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-2)", maxHeight: 240, overflowY: "auto" }}>
                  {realClinics.map((clinic, idx) => {
                    const cName = clinic.hospital_clinic_name || clinic.full_name || clinic.name || "CallMedex Partner Clinic";
                    const cAddr = clinic.city || clinic.address || "Registered Clinic";
                    const cRating = clinic.rating || 4.8;
                    const cId = clinic.user_id || clinic.id;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => router.push(`/booking?type=doctor&doctor=${cId}&spec=${encodeURIComponent(current.specialization)}`)}
                        className="cm-card cm-card--interactive"
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", gap: "var(--cm-3)", padding: "var(--cm-3) var(--cm-4)", background: "var(--cm-surface)" }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: "var(--cm-ink)", fontSize: "var(--cm-text-sm)" }}>
                            {cName}
                          </div>
                          <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                            <MapPin size={12} /> {cAddr}
                          </div>
                          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                            <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-waiting)", display: "flex", alignItems: "center", gap: 3 }}>
                              <Star size={11} /> {cRating}
                            </span>
                            <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                              <CheckCircle2 size={11} /> Verified
                            </span>
                          </div>
                        </div>
                        <span className="cm-pill cm-pill--active">Book Visit</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="cm-empty">
                  <span className="cm-empty__icon">
                    <Building2 size={20} />
                  </span>
                  <p className="cm-empty__title" style={{ fontSize: "var(--cm-text-base)" }}>
                    No Walk-in Clinics for {current.specialization}
                  </p>
                  <p className="cm-empty__body">
                    No partner clinics are currently registered for this specialty in your area.
                  </p>
                  <div style={{ display: "flex", gap: "var(--cm-2)", justifyContent: "center", flexWrap: "wrap", marginTop: "var(--cm-4)" }}>
                    <button type="button" onClick={handleOnlineConsult} className="cm-btn cm-btn--primary cm-btn--sm">
                      <Video size={14} /> Book Video Call Instead
                    </button>
                    <button type="button" onClick={() => router.push("/consultation?mode=walkin")} className="cm-btn cm-btn--secondary cm-btn--sm">
                      <Search size={14} /> Browse All Clinics
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
