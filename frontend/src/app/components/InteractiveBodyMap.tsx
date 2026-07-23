"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OrganInfo {
  id: string;
  name: string;
  icon: string;
  specialization: string;
  tests: string[];
  vitals: string;
  description: string;
}

const ORGANS: Record<string, OrganInfo> = {
  skin: {
    id: "skin",
    name: "Skin & Hair (Dermatology)",
    icon: "🧴",
    specialization: "Dermatology",
    tests: ["Skin Biopsy", "Allergy Comprehensive Panel", "Dermatology Teleconsult", "Fungal Culture"],
    vitals: "Hydration: Optimal · Barrier Status: Normal · Sun Damage Score: Low",
    description: "Complete skin barrier, acne, eczema, and hair health evaluation.",
  },
  dental: {
    id: "dental",
    name: "Teeth & Oral Care (Dentistry)",
    icon: "🦷",
    specialization: "Dentistry",
    tests: ["Dental X-Ray (OPG)", "Scaling & Polishing", "Cavity & Gum Inspection"],
    vitals: "Gum Index: Healthy · Plaque Score: Low · Enamel Strength: Good",
    description: "Comprehensive oral hygiene, tooth decay check, and gum disease screening.",
  },
  eyes: {
    id: "eyes",
    name: "Eyes & Vision (Ophthalmology)",
    icon: "👁️",
    specialization: "Ophthalmology",
    tests: ["Refraction Vision Test", "Fundus Examination", "Tonometry (Eye Pressure)", "Dry Eye Screening"],
    vitals: "Vision: 6/6 Both Eyes · Intraocular Pressure: 15 mmHg (Normal)",
    description: "Vision clarity, cataract screening, glaucoma pressure, and retina check.",
  },
  ent: {
    id: "ent",
    name: "Ears, Nose & Throat (ENT)",
    icon: "👂",
    specialization: "ENT",
    tests: ["Audiometry Hearing Test", "Nasal Endoscopy", "Throat Swab Culture", "Sinus Evaluation"],
    vitals: "Hearing Sensitivity: 15 dB (Normal) · Sinus Passage: Clear",
    description: "Ear hearing clarity, nasal blockage check, and throat infection diagnosis.",
  },
  head: {
    id: "head",
    name: "Brain & Nervous System (Neurology)",
    icon: "🧠",
    specialization: "Neurology",
    tests: ["Brain MRI / CT Scan", "EEG (Electroencephalogram)", "Migraine Risk Panel"],
    vitals: "Neuro-Reflex: Normal · Cognitive Score: 10/10 · Intra-cranial Risk: Low",
    description: "Headache evaluation, stroke prevention, and nerve reflex mapping.",
  },
  heart: {
    id: "heart",
    name: "Heart & Cardiovascular System",
    icon: "🫀",
    specialization: "Cardiology",
    tests: ["ECG (12-Lead)", "Echocardiogram (2D Echo)", "Lipid Profile", "Cardiac Troponin T"],
    vitals: "BP: 120/80 mmHg · Heart Rate: 72 bpm · Rhythm: Normal Sinus",
    description: "Coronary health, blood pressure control, and cardiac risk score.",
  },
  lungs: {
    id: "lungs",
    name: "Lungs & Respiratory System",
    icon: "🫁",
    specialization: "Pulmonology",
    tests: ["Chest X-Ray (PA View)", "Spirometry (Pulmonary Function)", "SpO2 & ABG Test"],
    vitals: "SpO2: 99% · Respiratory Rate: 16/min · Lung Capacity: 100%",
    description: "Asthma, bronchitis, oxygen saturation, and respiratory capacity check.",
  },
  abdomen: {
    id: "abdomen",
    name: "Abdomen & Digestive System",
    icon: "🩸",
    specialization: "Gastroenterology",
    tests: ["Ultrasound Abdomen & Pelvis", "Liver Function Test (LFT)", "Kidney Function Test (KFT)"],
    vitals: "Fasting Glucose: 95 mg/dL · Liver Enzymes (ALT/AST): Normal",
    description: "Liver health, stomach digestion, kidney filtration, and gut microbiome.",
  },
  joints: {
    id: "joints",
    name: "Joints, Bones & Spine (Orthopedics)",
    icon: "🦴",
    specialization: "Orthopedics",
    tests: ["Bone Mineral Density (DEXA)", "Joint X-Ray", "Uric Acid Test", "RA Factor"],
    vitals: "Mobility Score: 9/10 · Calcium Level: 9.8 mg/dL · Inflammation: Low",
    description: "Arthritis screening, bone density, cartilage strength, and spinal alignment.",
  },
};

export default function InteractiveBodyMap() {
  const router = useRouter();
  const [selectedOrgan, setSelectedOrgan] = useState<string>("heart");
  const current = ORGANS[selectedOrgan] || ORGANS["heart"];

  return (
    <div className="glass-card" style={{
      padding: 28,
      marginBottom: 36,
      background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
      borderRadius: 20,
      border: "1px solid #e2e8f0",
      boxShadow: "0 10px 30px -5px rgba(15, 23, 42, 0.05)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.35rem", color: "#0f172a", fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
            🧍 Interactive Body Map & Health Twin <span className="badge-ai" style={{ backgroundColor: "#0284c7", color: "white", padding: "3px 10px", borderRadius: 12, fontSize: "0.75rem", fontWeight: 700 }}>AI Digital Twin</span>
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem", color: "#64748b" }}>
            Select any organ region or specialty tab to inspect vitals, recommended lab panels, and consult top specialists.
          </p>
        </div>
      </div>

      {/* Organ Selector Chips Bar */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 20 }}>
        {Object.values(ORGANS).map((org) => {
          const isSelected = org.id === selectedOrgan;
          return (
            <button
              key={org.id}
              onClick={() => setSelectedOrgan(org.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 20,
                border: isSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                backgroundColor: isSelected ? "#e0f2fe" : "white",
                color: isSelected ? "#0369a1" : "#475569",
                fontWeight: isSelected ? 700 : 500,
                fontSize: "0.82rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease-in-out",
                boxShadow: isSelected ? "0 2px 8px rgba(2, 132, 199, 0.2)" : "none",
              }}
            >
              <span>{org.icon}</span> {org.name.split(" ")[0]}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Body Vector + Organ Info Drawer */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr", gap: 24, alignItems: "center" }}>
        
        {/* Anatomical Body Map SVG */}
        <div style={{
          position: "relative",
          textAlign: "center",
          background: "linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)",
          padding: 24,
          borderRadius: 20,
          border: "1px solid #cbd5e1",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
        }}>
          <svg viewBox="0 0 200 420" style={{ width: "100%", maxHeight: 340, cursor: "pointer" }}>
            {/* Body Silhouette Outline */}
            <path
              d="M100 20 C120 20 135 35 135 55 C135 70 125 80 115 85 L145 105 L165 180 L145 190 L135 130 L135 230 L150 380 L125 380 L110 260 L90 260 L75 380 L50 380 L65 230 L65 130 L55 190 L35 180 L55 105 L85 85 C75 80 65 70 65 55 C65 35 80 20 100 20 Z"
              fill="#cbd5e1"
              stroke="#64748b"
              strokeWidth="2"
            />

            {/* Skin / Dermatology Outer Halo */}
            <circle
              cx="72"
              cy="160"
              r="14"
              fill={selectedOrgan === "skin" ? "#38bdf8" : "#94a3b8"}
              fillOpacity={selectedOrgan === "skin" ? "0.9" : "0.5"}
              stroke="#0284c7"
              strokeWidth={selectedOrgan === "skin" ? "3" : "1"}
              onClick={() => setSelectedOrgan("skin")}
            />
            <text x="72" y="164" textAnchor="middle" fontSize="11" pointerEvents="none">🧴</text>

            {/* Eyes Hotspot */}
            <circle
              cx="92"
              cy="45"
              r="10"
              fill={selectedOrgan === "eyes" ? "#38bdf8" : "#94a3b8"}
              fillOpacity={selectedOrgan === "eyes" ? "0.9" : "0.5"}
              stroke="#0284c7"
              strokeWidth={selectedOrgan === "eyes" ? "3" : "1"}
              onClick={() => setSelectedOrgan("eyes")}
            />
            <text x="92" y="48" textAnchor="middle" fontSize="9" pointerEvents="none">👁️</text>

            {/* Dental Hotspot */}
            <circle
              cx="108"
              cy="58"
              r="10"
              fill={selectedOrgan === "dental" ? "#38bdf8" : "#94a3b8"}
              fillOpacity={selectedOrgan === "dental" ? "0.9" : "0.5"}
              stroke="#0284c7"
              strokeWidth={selectedOrgan === "dental" ? "3" : "1"}
              onClick={() => setSelectedOrgan("dental")}
            />
            <text x="108" y="61" textAnchor="middle" fontSize="9" pointerEvents="none">🦷</text>

            {/* ENT / Ears Hotspot */}
            <circle
              cx="122"
              cy="45"
              r="10"
              fill={selectedOrgan === "ent" ? "#38bdf8" : "#94a3b8"}
              fillOpacity={selectedOrgan === "ent" ? "0.9" : "0.5"}
              stroke="#0284c7"
              strokeWidth={selectedOrgan === "ent" ? "3" : "1"}
              onClick={() => setSelectedOrgan("ent")}
            />
            <text x="122" y="48" textAnchor="middle" fontSize="9" pointerEvents="none">👂</text>

            {/* Brain Hotspot */}
            <circle
              cx="100"
              cy="34"
              r="14"
              fill={selectedOrgan === "head" ? "#38bdf8" : "#94a3b8"}
              fillOpacity={selectedOrgan === "head" ? "0.9" : "0.5"}
              stroke="#0284c7"
              strokeWidth={selectedOrgan === "head" ? "3" : "1"}
              onClick={() => setSelectedOrgan("head")}
            />
            <text x="100" y="38" textAnchor="middle" fontSize="11" pointerEvents="none">🧠</text>

            {/* Lungs Hotspot */}
            <ellipse
              cx="100"
              cy="125"
              rx="22"
              ry="16"
              fill={selectedOrgan === "lungs" ? "#38bdf8" : "#94a3b8"}
              fillOpacity={selectedOrgan === "lungs" ? "0.9" : "0.5"}
              stroke="#0284c7"
              strokeWidth={selectedOrgan === "lungs" ? "3" : "1"}
              onClick={() => setSelectedOrgan("lungs")}
            />
            <text x="100" y="130" textAnchor="middle" fontSize="13" pointerEvents="none">🫁</text>

            {/* Heart Hotspot */}
            <circle
              cx="112"
              cy="138"
              r="13"
              fill={selectedOrgan === "heart" ? "#ef4444" : "#94a3b8"}
              fillOpacity={selectedOrgan === "heart" ? "0.95" : "0.5"}
              stroke="#dc2626"
              strokeWidth={selectedOrgan === "heart" ? "3" : "1"}
              onClick={() => setSelectedOrgan("heart")}
            />
            <text x="112" y="142" textAnchor="middle" fontSize="11" pointerEvents="none">🫀</text>

            {/* Abdomen Hotspot */}
            <ellipse
              cx="100"
              cy="185"
              rx="24"
              ry="20"
              fill={selectedOrgan === "abdomen" ? "#38bdf8" : "#94a3b8"}
              fillOpacity={selectedOrgan === "abdomen" ? "0.9" : "0.5"}
              stroke="#0284c7"
              strokeWidth={selectedOrgan === "abdomen" ? "3" : "1"}
              onClick={() => setSelectedOrgan("abdomen")}
            />
            <text x="100" y="190" textAnchor="middle" fontSize="13" pointerEvents="none">🩸</text>

            {/* Joints Hotspot */}
            <circle
              cx="110"
              cy="255"
              r="13"
              fill={selectedOrgan === "joints" ? "#38bdf8" : "#94a3b8"}
              fillOpacity={selectedOrgan === "joints" ? "0.9" : "0.5"}
              stroke="#0284c7"
              strokeWidth={selectedOrgan === "joints" ? "3" : "1"}
              onClick={() => setSelectedOrgan("joints")}
            />
            <text x="110" y="259" textAnchor="middle" fontSize="11" pointerEvents="none">🦴</text>
          </svg>
        </div>

        {/* Selected Organ Drawer */}
        <div style={{
          background: "white",
          padding: 24,
          borderRadius: 20,
          border: "1px solid #cbd5e1",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: "2.2rem" }}>{current.icon}</span>
            <div>
              <h4 style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a", fontWeight: 800 }}>{current.name}</h4>
              <span style={{
                backgroundColor: "#e0f2fe", color: "#0369a1",
                padding: "2px 8px", borderRadius: 12, fontSize: "0.75rem", fontWeight: 700,
                display: "inline-block", marginTop: 4,
              }}>
                Specialty: {current.specialization}
              </span>
            </div>
          </div>

          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 14px 0" }}>
            {current.description}
          </p>

          <div style={{ background: "#f8fafc", padding: 14, borderRadius: 12, marginBottom: 16, border: "1px solid #e2e8f0", fontSize: "0.85rem" }}>
            <strong style={{ color: "#334155" }}>📊 AI Digital Twin Vitals:</strong>
            <p style={{ margin: "4px 0 0 0", color: "#059669", fontWeight: 700 }}>{current.vitals}</p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <strong style={{ fontSize: "0.85rem", color: "#475569" }}>🔬 Recommended Tests & Panels:</strong>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {current.tests.map((t, i) => (
                <span key={i} style={{ background: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd", padding: "4px 10px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 600 }}>
                  ✓ {t}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              style={{
                flex: 1, padding: "10px 16px", backgroundColor: "#0284c7", color: "white",
                border: "none", borderRadius: 10, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
                boxShadow: "0 2px 6px rgba(2, 132, 199, 0.3)",
              }}
              onClick={() => router.push(`/consultation?spec=${encodeURIComponent(current.specialization)}`)}
            >
              🩺 Consult {current.specialization}
            </button>
            <button
              style={{
                flex: 1, padding: "10px 16px", backgroundColor: "#0f172a", color: "white",
                border: "none", borderRadius: 10, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
              }}
              onClick={() => router.push(`/diagnostics?search=${encodeURIComponent(current.name)}`)}
            >
              🧪 Book Lab Package
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
