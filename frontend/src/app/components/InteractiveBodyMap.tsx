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
              <span style={{ fontWeight: 700, color: "var(--cm-navy)" }}>2D Clinical Contour</span>
              <span>Coordinates: Sagittal Plan</span>
            </div>

            {/* Clean SVG Vector Body Silhouette on White Canvas */}
            <div style={{ width: "100%", maxWidth: 260, margin: "var(--cm-4) 0", textAlign: "center" }}>
              <svg viewBox="0 0 200 420" style={{ width: "100%", maxHeight: 380 }}>
                {/* Anatomical Human Contour Silhouette */}
                <path
                  d="M100 22 C118 22 132 36 132 54 C132 68 123 78 114 84 L142 104 L162 176 L144 186 L134 128 L134 225 L148 376 L124 376 L110 258 L90 258 L76 376 L52 376 L66 225 L66 128 L56 186 L38 176 L58 104 L86 84 C77 78 68 68 68 54 C68 36 82 22 100 22 Z"
                  fill="var(--cm-surface-2)"
                  stroke="var(--cm-line-strong)"
                  strokeWidth="1.8"
                />

                {/* Medical Axis Guides */}
                <line x1="78" y1="125" x2="122" y2="125" stroke="var(--cm-line)" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="82" y1="190" x2="118" y2="190" stroke="var(--cm-line)" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="88" y1="260" x2="112" y2="260" stroke="var(--cm-line)" strokeWidth="1" strokeDasharray="3,3" />

                {/* Interactive Organ Hotspots */}
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
                      style={{ cursor: "pointer" }}
                    >
                      {/* Active Ring */}
                      {isSelected && (
                        <circle
                          cx={spot.cx}
                          cy={spot.cy}
                          r={spot.r * 1.5}
                          fill="none"
                          stroke={spotColor}
                          strokeWidth="2"
                        />
                      )}

                      {/* Node Circle */}
                      <circle
                        cx={spot.cx}
                        cy={spot.cy}
                        r={spot.r}
                        fill={isSelected ? "var(--cm-navy)" : "var(--cm-surface)"}
                        stroke={isSelected ? "var(--cm-navy)" : "var(--cm-line-strong)"}
                        strokeWidth={isSelected ? 2 : 1.5}
                      />

                      {/* Node Icon */}
                      <svg
                        x={spot.cx - iconSize / 2}
                        y={spot.cy - iconSize / 2}
                        width={iconSize}
                        height={iconSize}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={isSelected ? "#ffffff" : "var(--cm-ink-2)"}
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
