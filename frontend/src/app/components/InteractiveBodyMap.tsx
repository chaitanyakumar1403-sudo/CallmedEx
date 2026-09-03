"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Stethoscope, FlaskConical, Video, Building2, Star, MapPin, Search,
  CheckCircle2, ArrowLeft, ClipboardList, Activity,
  Sparkles, Smile, Eye, Ear, Brain, Heart, Wind, Droplet, Bone,
  type LucideIcon,
} from "lucide-react";

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
    color: "#ec4899",
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
    color: "#14b8a6",
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
    color: "#3b82f6",
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
    color: "#f97316",
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
    color: "#8b5cf6",
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
    color: "#ef4444",
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
    color: "#06b6d4",
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
    color: "#10b981",
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
    color: "#f59e0b",
    vitalSummary: "Bone Mineral Density: Normal · Uric Acid: 4.8 mg/dL",
    tests: ["Bone Mineral Density (DEXA)", "Joint X-Ray", "Uric Acid Test", "RA Factor"],
    testDetails: [
      { name: "Bone Health Duo (Calcium + Vit D3)", turnaround: "Same Day", price: 799, marketPrice: 1800, parameters: "Total 25-OH Vitamin D & Serum Calcium" },
      { name: "Arthritis & Uric Acid Profile", turnaround: "6 Hours", price: 599, marketPrice: 1300, parameters: "RA Quantitative Factor & Serum Uric Acid" },
    ],
    description: "Arthritis screening, bone density, cartilage strength, and spinal alignment.",
  },
};

const HOTSPOTS: { id: string; cx: number; cy: number; r: number; heart?: boolean }[] = [
  { id: "skin", cx: 65, cy: 165, r: 13 },
  { id: "eyes", cx: 92, cy: 45, r: 10 },
  { id: "dental", cx: 108, cy: 58, r: 10 },
  { id: "ent", cx: 122, cy: 45, r: 10 },
  { id: "head", cx: 100, cy: 34, r: 14 },
  { id: "lungs", cx: 100, cy: 125, r: 18 },
  { id: "heart", cx: 114, cy: 140, r: 15, heart: true },
  { id: "abdomen", cx: 100, cy: 190, r: 20 },
  { id: "joints", cx: 112, cy: 260, r: 14 },
];

export default function InteractiveBodyMap() {
  const router = useRouter();
  const [selectedOrgan, setSelectedOrgan] = useState<string>("heart");
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
    <div className="cm-panel" style={{ border: "1px solid var(--cm-line-strong)", boxShadow: "0 10px 30px -10px rgba(15, 23, 42, 0.08)" }}>
      {/* Header Bar with clinical telemetry badge */}
      <div className="cm-row-between" style={{ marginBottom: "var(--cm-4)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 8, background: "var(--cm-active-surface)", color: "var(--cm-active)"
            }}>
              <Activity size={18} />
            </span>
            <h3 className="cm-panel__title" style={{ margin: 0, fontSize: "1.25rem", color: "var(--cm-ink)", fontWeight: 800 }}>
              Interactive Anatomical Twin
            </h3>
            <span className="cm-pill cm-pill--done" style={{ fontWeight: 700, fontSize: "0.75rem" }}>
              Bio-Scan v3.2 Active
            </span>
          </div>
          <p className="cm-panel__note" style={{ margin: "4px 0 0 0", color: "var(--cm-ink-3)", fontSize: "0.88rem" }}>
            Select an organ region to inspect real-time clinical parameters, recommended diagnostic panels, and consult verified specialists.
          </p>
        </div>
      </div>

      {/* Segmented Organ Selector Chips Bar */}
      <div style={{
        display: "flex", gap: "var(--cm-2)", overflowX: "auto", paddingBottom: "var(--cm-2)",
        marginBottom: "var(--cm-5)", scrollbarWidth: "none"
      }}>
        {Object.values(ORGANS).map((org) => {
          const isSelected = org.id === selectedOrgan;
          const OrgIcon = org.Icon;
          return (
            <button
              key={org.id}
              type="button"
              onClick={() => { setSelectedOrgan(org.id); setConsultMode(null); }}
              style={{
                borderRadius: "9999px",
                border: isSelected ? `2px solid ${org.color}` : "1px solid var(--cm-line-strong)",
                background: isSelected ? "var(--cm-surface-2)" : "var(--cm-surface)",
                color: isSelected ? "var(--cm-ink)" : "var(--cm-ink-2)",
                padding: "8px 16px",
                fontSize: "0.85rem",
                fontWeight: isSelected ? 800 : 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: isSelected ? `0 0 12px ${org.color}33` : "none",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap"
              }}
            >
              <span style={{
                color: isSelected ? org.color : "var(--cm-ink-3)",
                display: "inline-flex"
              }}>
                <OrgIcon size={16} />
              </span>
              {org.name.split(" ")[0]}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Anatomical Bio-Scanner + Organ Dossier */}
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.35fr", gap: "var(--cm-5)", alignItems: "start" }}>

        {/* Anatomical Holographic Bio-Scanner */}
        <div className="cm-scanner-enclosure" style={{ minHeight: 460, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div className="cm-scanner-grid-bg" />
          <div className="cm-scanner-beam" />

          {/* Scanner Telemetry Header */}
          <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(56, 189, 248, 0.2)", paddingBottom: 8, fontSize: "0.72rem", color: "rgba(255,255,255,0.7)", letterSpacing: "1px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
              OPTICAL BODY SCANNER
            </span>
            <span style={{ fontFamily: "monospace", color: "#38bdf8" }}>LAT: 17.3850° N</span>
          </div>

          {/* SVG Vector Hologram */}
          <div style={{ position: "relative", zIndex: 2, textAlign: "center", margin: "16px 0" }}>
            <svg viewBox="0 0 200 420" style={{ width: "100%", maxHeight: 370, filter: "drop-shadow(0 0 16px rgba(56, 189, 248, 0.25))" }}>
              <defs>
                <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" stopOpacity="0.85" />
                  <stop offset="50%" stopColor="#0f172a" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#091428" stopOpacity="0.85" />
                </linearGradient>
                <radialGradient id="cardiacGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Anatomical Human Contour Silhouette */}
              <path
                d="M100 22 C118 22 132 36 132 54 C132 68 123 78 114 84 L142 104 L162 176 L144 186 L134 128 L134 225 L148 376 L124 376 L110 258 L90 258 L76 376 L52 376 L66 225 L66 128 L56 186 L38 176 L58 104 L86 84 C77 78 68 68 68 54 C68 36 82 22 100 22 Z"
                fill="url(#bodyGradient)"
                stroke="#38bdf8"
                strokeWidth="1.8"
                strokeOpacity="0.55"
              />

              {/* Anatomical Grid Coordinates & Contour Guides */}
              <line x1="78" y1="125" x2="122" y2="125" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3,3" strokeOpacity="0.4" />
              <line x1="82" y1="190" x2="118" y2="190" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3,3" strokeOpacity="0.4" />
              <line x1="88" y1="260" x2="112" y2="260" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3,3" strokeOpacity="0.4" />
              <circle cx="100" cy="54" r="28" stroke="#38bdf8" strokeWidth="0.5" strokeOpacity="0.3" fill="none" strokeDasharray="2,4" />

              {/* Interactive Organ Hotspots with Clinical Color Nodes */}
              {HOTSPOTS.map((spot) => {
                const isSelected = spot.id === selectedOrgan;
                const org = ORGANS[spot.id];
                const SpotIcon = org.Icon;
                const spotColor = org.color;
                const iconSize = spot.r * 1.1;

                return (
                  <g
                    key={spot.id}
                    onClick={() => { setSelectedOrgan(spot.id); setConsultMode(null); }}
                    className="cm-organ-node"
                    style={{ cursor: "pointer" }}
                  >
                    {/* Animated Pulsing Ring for Selected Hotspot or Heart */}
                    {(isSelected || spot.heart) && (
                      <circle
                        cx={spot.cx}
                        cy={spot.cy}
                        r={spot.r * 1.8}
                        fill="none"
                        stroke={spotColor}
                        strokeWidth="1.5"
                        strokeOpacity={isSelected ? 0.9 : 0.4}
                        style={{
                          transformOrigin: `${spot.cx}px ${spot.cy}px`,
                          animation: "cm-heartbeat-ring 1.8s infinite ease-out"
                        }}
                      />
                    )}

                    {/* HUD Target Brackets when selected */}
                    {isSelected && (
                      <g stroke={spotColor} strokeWidth="1.5" fill="none">
                        <path d={`M${spot.cx - spot.r - 4} ${spot.cy - 6} L${spot.cx - spot.r - 4} ${spot.cy - spot.r - 4} L${spot.cx - 6} ${spot.cy - spot.r - 4}`} />
                        <path d={`M${spot.cx + spot.r + 4} ${spot.cy - 6} L${spot.cx + spot.r + 4} ${spot.cy - spot.r - 4} L${spot.cx + 6} ${spot.cy - spot.r - 4}`} />
                        <path d={`M${spot.cx - spot.r - 4} ${spot.cy + 6} L${spot.cx - spot.r - 4} ${spot.cy + spot.r + 4} L${spot.cx - 6} ${spot.cy + spot.r + 4}`} />
                        <path d={`M${spot.cx + spot.r + 4} ${spot.cy + 6} L${spot.cx + spot.r + 4} ${spot.cy + spot.r + 4} L${spot.cx + 6} ${spot.cy + spot.r + 4}`} />
                      </g>
                    )}

                    {/* Node Circle Background */}
                    <circle
                      cx={spot.cx}
                      cy={spot.cy}
                      r={spot.r}
                      fill={isSelected ? spotColor : "#1e293b"}
                      stroke={isSelected ? "#ffffff" : spotColor}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      filter={isSelected ? `drop-shadow(0 0 8px ${spotColor})` : "none"}
                    />

                    {/* Node Icon */}
                    <svg
                      x={spot.cx - iconSize / 2}
                      y={spot.cy - iconSize / 2}
                      width={iconSize}
                      height={iconSize}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={isSelected ? "#ffffff" : spotColor}
                      strokeWidth={2.4}
                      pointerEvents="none"
                    >
                      <SpotIcon width={24} height={24} />
                    </svg>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Scanner Bottom Telemetry */}
          <div style={{ position: "relative", zIndex: 2, background: "rgba(15, 23, 42, 0.75)", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(56, 189, 248, 0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Selected Region</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: current.color }}>{current.name}</div>
            </div>
            <span style={{ fontSize: "0.75rem", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "4px 10px", borderRadius: 9999, border: "1px solid rgba(56, 189, 248, 0.3)", fontWeight: 700 }}>
              {current.specialization}
            </span>
          </div>
        </div>

        {/* Selected Organ Diagnostic Dossier */}
        <div className="cm-card" style={{ border: `1px solid var(--cm-line)`, borderTop: `4px solid ${current.color}`, borderRadius: "var(--cm-radius-lg)", boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)" }}>
          {/* Dossier Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--cm-3)", marginBottom: "var(--cm-3)" }}>
            <span style={{
              display: "grid", placeItems: "center", width: 50, height: 50, borderRadius: "var(--cm-radius)",
              background: `${current.color}18`, color: current.color, flex: "none", border: `1px solid ${current.color}33`
            }}>
              <current.Icon size={26} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h4 style={{ margin: 0, fontSize: "1.15rem", color: "var(--cm-ink)", fontWeight: 800 }}>{current.name}</h4>
              </div>
              <span className="cm-pill cm-pill--active" style={{ marginTop: 4, background: "var(--cm-surface-2)", color: "var(--cm-ink)", border: "1px solid var(--cm-line-strong)" }}>
                {current.specialization} Specialist Care
              </span>
            </div>
          </div>

          <p style={{ fontSize: "0.9rem", color: "var(--cm-ink-3)", margin: "0 0 var(--cm-4) 0", lineHeight: 1.5 }}>
            {current.description}
          </p>

          {/* Vitals Benchmark Card */}
          <div style={{ background: "var(--cm-surface-2)", padding: "12px 16px", borderRadius: "var(--cm-radius)", marginBottom: "var(--cm-4)", border: "1px solid var(--cm-line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--cm-2)", marginBottom: 4 }}>
              <ClipboardList size={16} style={{ color: current.color }} />
              <strong style={{ fontSize: "0.85rem", color: "var(--cm-ink)" }}>System Vitals & Clinical Target</strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--cm-ink-2)", fontWeight: 600 }}>
              {current.vitalSummary}
            </p>
          </div>

          {/* Recommended Diagnostic Test Cards */}
          <div style={{ marginBottom: "var(--cm-5)" }}>
            <strong style={{ fontSize: "0.88rem", color: "var(--cm-ink)", display: "block", marginBottom: 8 }}>
              Certified NABL Diagnostic Panels
            </strong>
            <div style={{ display: "grid", gap: 10 }}>
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
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--cm-ink)", display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle2 size={14} style={{ color: "var(--cm-done)" }} />
                      {t.name}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--cm-ink-3)", marginTop: 2 }}>
                      {t.parameters} · <span style={{ color: "var(--cm-active)", fontWeight: 600 }}>{t.turnaround}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--cm-ink)" }}>₹{t.price}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--cm-ink-3)", textDecoration: "line-through" }}>₹{t.marketPrice}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Consultation Actions — Online/Offline choice */}
          {consultMode === null && (
            <div style={{ display: "flex", gap: "var(--cm-2)", flexWrap: "wrap" }}>
              <button type="button" className="cm-btn cm-btn--primary" style={{ flex: 1, padding: "12px 18px", fontWeight: 700 }} onClick={() => setConsultMode("choosing")}>
                <Stethoscope size={16} /> Consult {current.specialization}
              </button>
              <button
                type="button"
                className="cm-btn"
                style={{ flex: 1, background: "var(--cm-navy-deep)", color: "#fff", padding: "12px 18px", fontWeight: 700 }}
                onClick={() => router.push(`/diagnostics?search=${encodeURIComponent(current.name)}`)}
              >
                <FlaskConical size={16} /> Book Lab Package
              </button>
            </div>
          )}

          {/* Online vs Offline Choice */}
          {consultMode === "choosing" && (
            <div style={{ background: "var(--cm-active-bg)", borderRadius: "var(--cm-radius-lg)", padding: "var(--cm-4)", border: "1px solid var(--cm-active-line)" }}>
              <div className="cm-row-between" style={{ marginBottom: "var(--cm-3)" }}>
                <strong style={{ color: "var(--cm-navy)", fontSize: "var(--cm-text-sm)" }}>
                  How would you like to consult?
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
                  style={{ textAlign: "center", border: "2px solid var(--cm-navy)" }}
                >
                  <Video size={26} style={{ color: "var(--cm-navy)", marginBottom: 6 }} />
                  <div style={{ fontWeight: 700, color: "var(--cm-navy)", fontSize: "var(--cm-text-sm)" }}>
                    Online
                  </div>
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 4 }}>
                    Video consultation from home. HD call with AI-drafted summary.
                  </div>
                  <span className="cm-pill cm-pill--done" style={{ marginTop: 8 }}>Available Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConsultMode("offline_list")}
                  className="cm-card cm-card--interactive"
                  style={{ textAlign: "center", border: "2px solid var(--cm-line-strong)" }}
                >
                  <Building2 size={26} style={{ color: "var(--cm-ink)", marginBottom: 6 }} />
                  <div style={{ fontWeight: 700, color: "var(--cm-ink)", fontSize: "var(--cm-text-sm)" }}>
                    Offline
                  </div>
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 4 }}>
                    Visit a partner clinic near you. In-person examination.
                  </div>
                  <span className="cm-pill cm-pill--active" style={{ marginTop: 8 }}>Walk-in</span>
                </button>
              </div>
            </div>
          )}

          {/* Offline Clinic List */}
          {consultMode === "offline_list" && (
            <div style={{ background: "var(--cm-surface-2)", borderRadius: "var(--cm-radius-lg)", padding: "var(--cm-4)", border: "1px solid var(--cm-line)" }}>
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
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", gap: "var(--cm-3)", padding: "var(--cm-3) var(--cm-4)" }}
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
