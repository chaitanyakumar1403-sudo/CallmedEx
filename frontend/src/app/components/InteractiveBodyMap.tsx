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
}

const ORGANS: Record<string, OrganInfo> = {
  head: {
    id: "head",
    name: "Head, Brain & ENT",
    icon: "🧠",
    specialization: "Neurology & General Medicine",
    tests: ["Brain MRI / CT Scan", "Sinus Evaluation", "Thyroid Profile"],
    vitals: "Neuro-Reflex: Normal · Temp: 98.6°F",
  },
  heart: {
    id: "heart",
    name: "Heart & Cardiovascular System",
    icon: "🫀",
    specialization: "Cardiology",
    tests: ["ECG (12-Lead)", "Lipid Profile", "Cardiac Troponin"],
    vitals: "BP: 120/80 mmHg · Heart Rate: 72 bpm",
  },
  lungs: {
    id: "lungs",
    name: "Lungs & Respiratory System",
    icon: "🫁",
    specialization: "Pulmonology",
    tests: ["Chest X-Ray (PA View)", "Spirometry", "Complete Blood Count (CBC)"],
    vitals: "SpO2: 99% · Respiratory Rate: 16/min",
  },
  abdomen: {
    id: "abdomen",
    name: "Abdomen & Digestive System",
    icon: "🩸",
    specialization: "Gastroenterology",
    tests: ["Ultrasound Abdomen & Pelvis", "Liver Function Test (LFT)", "Kidney Function Test (KFT)"],
    vitals: "Fasting Blood Glucose: 95 mg/dL",
  },
  joints: {
    id: "joints",
    name: "Joints & Musculoskeletal System",
    icon: "🦴",
    specialization: "Orthopedics & Rheumatology",
    tests: ["Bone Mineral Density (DEXA)", "Uric Acid Test", "X-Ray Joint"],
    vitals: "Mobility Score: 9/10 · Inflammation Index: Normal",
  },
};

export default function InteractiveBodyMap() {
  const router = useRouter();
  const [selectedOrgan, setSelectedOrgan] = useState<string>("heart");
  const current = ORGANS[selectedOrgan] || ORGANS["heart"];

  return (
    <div className="glass-card" style={{ padding: 24, marginBottom: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
            🧍 Interactive Body Map & Health Twin <span className="badge-ai">AI Organ Twin</span>
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
            Tap any organ region on the anatomical map below to inspect health vitals, active records, or book targeted care.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 24, alignItems: "center" }}>
        {/* SVG Interactive Anatomical Vector Silhouette */}
        <div style={{ position: "relative", textAlign: "center", background: "#f8fafc", padding: 24, borderRadius: 16, border: "1px solid #e2e8f0" }}>
          <svg viewBox="0 0 200 420" style={{ width: "100%", maxHeight: 320, cursor: "pointer" }}>
            {/* Body Silhouette Outline */}
            <path
              d="M100 20 C120 20 135 35 135 55 C135 70 125 80 115 85 L145 105 L165 180 L145 190 L135 130 L135 230 L150 380 L125 380 L110 260 L90 260 L75 380 L50 380 L65 230 L65 130 L55 190 L35 180 L55 105 L85 85 C75 80 65 70 65 55 C65 35 80 20 100 20 Z"
              fill="#e2e8f0"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* Head / Brain Hotspot */}
            <circle
              cx="100"
              cy="52"
              r="22"
              className={`organ-path ${selectedOrgan === "head" ? "organ-path--selected" : ""}`}
              onClick={() => setSelectedOrgan("head")}
            />
            <text x="100" y="56" textAnchor="middle" fontSize="16" pointerEvents="none">🧠</text>

            {/* Lungs Hotspot */}
            <ellipse
              cx="100"
              cy="125"
              rx="24"
              ry="18"
              className={`organ-path ${selectedOrgan === "lungs" ? "organ-path--selected" : ""}`}
              onClick={() => setSelectedOrgan("lungs")}
            />
            <text x="100" y="130" textAnchor="middle" fontSize="16" pointerEvents="none">🫁</text>

            {/* Heart Hotspot */}
            <circle
              cx="112"
              cy="140"
              r="14"
              className={`organ-path ${selectedOrgan === "heart" ? "organ-path--selected" : ""}`}
              onClick={() => setSelectedOrgan("heart")}
            />
            <text x="112" y="144" textAnchor="middle" fontSize="13" pointerEvents="none">🫀</text>

            {/* Abdomen Hotspot */}
            <ellipse
              cx="100"
              cy="185"
              rx="26"
              ry="22"
              className={`organ-path ${selectedOrgan === "abdomen" ? "organ-path--selected" : ""}`}
              onClick={() => setSelectedOrgan("abdomen")}
            />
            <text x="100" y="190" textAnchor="middle" fontSize="16" pointerEvents="none">🩸</text>

            {/* Joints Hotspot */}
            <circle
              cx="110"
              cy="255"
              r="14"
              className={`organ-path ${selectedOrgan === "joints" ? "organ-path--selected" : ""}`}
              onClick={() => setSelectedOrgan("joints")}
            />
            <text x="110" y="259" textAnchor="middle" fontSize="13" pointerEvents="none">🦴</text>
          </svg>
        </div>

        {/* Contextual Organ Care Drawer */}
        <div style={{ background: "white", padding: 20, borderRadius: 16, border: "1px solid #cbd5e1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: "2rem" }}>{current.icon}</span>
            <div>
              <h4 style={{ margin: 0, fontSize: "1.1rem", color: "#0f172a" }}>{current.name}</h4>
              <span className="badge badge-info" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                Specialty: {current.specialization}
              </span>
            </div>
          </div>

          <div style={{ background: "#f1f5f9", padding: 12, borderRadius: 10, marginBottom: 14, fontSize: "0.85rem" }}>
            <strong>📊 Health Twin Vitals:</strong>
            <p style={{ margin: "4px 0 0 0", color: "#0f766e", fontWeight: 600 }}>{current.vitals}</p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <strong style={{ fontSize: "0.85rem", color: "#475569" }}>🔬 Recommended Diagnostic Packages:</strong>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {current.tests.map((t, i) => (
                <span key={i} style={{ background: "#e0f2fe", color: "#0369a1", padding: "4px 10px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 600 }}>
                  ✓ {t}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="btn btn-teal btn-sm"
              onClick={() => router.push(`/consultation?spec=${encodeURIComponent(current.specialization)}`)}
            >
              🩺 Consult {current.specialization}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => router.push(`/diagnostics?search=${encodeURIComponent(current.name)}`)}
            >
              🧪 Book Organ Lab Package
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
