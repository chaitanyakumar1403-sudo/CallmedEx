"use client";

import { useState } from "react";

interface PhlebotomistToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PhlebotomistToolsModal({ isOpen, onClose }: PhlebotomistToolsModalProps) {
  const [selectedTube, setSelectedTube] = useState<string | null>(null);

  if (!isOpen) return null;

  const tubes = [
    { color: "#8b5cf6", name: "EDTA Purple Tube", tests: "CBC, HbA1c, ESR, Blood Grouping", additive: "K2 EDTA Anticoagulant" },
    { color: "#ef4444", name: "Serum Red Top", tests: "Lipid Profile, LFT, KFT, Thyroid, Electrolytes", additive: "Clot Activator" },
    { color: "#64748b", name: "Sodium Fluoride Grey", tests: "Fasting Blood Glucose, PPBS, Oral Glucose Tolerance", additive: "Sodium Fluoride / Potassium Oxalate" },
    { color: "#0284c7", name: "Sodium Citrate Light Blue", tests: "PT / INR, APTT, D-Dimer, Fibrinogen", additive: "3.2% Sodium Citrate" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="glass-card" style={{ maxWidth: 620, width: "100%", padding: 28, background: "white", borderRadius: 20, maxHeight: "90vh", overflowY: "auto" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>
            🩸 Phlebotomist Clinical Assistant <span className="badge-ai">NMC Standard</span>
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Cold-Chain Status Card */}
        <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "white", padding: 20, borderRadius: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "0.75rem", color: "#38bdf8", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Cold-Chain Specimen Storage</span>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
              🌡️ 3.6°C <small style={{ fontSize: "0.8rem", color: "#4ade80" }}>(Safe Range: 2°C – 8°C)</small>
            </div>
          </div>
          <span style={{ background: "rgba(34, 197, 94, 0.2)", color: "#86efac", padding: "6px 12px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 700, border: "1px solid rgba(34,197,94,0.3)" }}>
            🟢 Temp Monitor Normal
          </span>
        </div>

        {/* The barcode "scanner" that lived here generated a throwaway VAM-###### and
            persisted nothing, sitting next to the real one in Samples & Handover.
            Two scanners where one is fake is worse than one: a collector could
            reasonably tag a tube here and believe it was recorded. Removed, with a
            pointer to the tab that actually registers a tube. */}
        <div style={{ background: "#eff6ff", padding: 16, borderRadius: 12, border: "1px solid #bfdbfe", marginBottom: 20 }}>
          <h4 style={{ margin: "0 0 6px 0", color: "#1e40af", fontSize: "0.95rem" }}>📷 Registering a tube?</h4>
          <p style={{ fontSize: "0.84rem", color: "#1e40af", margin: 0 }}>
            Use <strong>Samples &amp; Handover</strong> to scan or mint a barcode. That
            records the tube against the patient&apos;s run and starts its custody trail —
            this guide is reference only.
          </p>
        </div>

        {/* Blood Tube Color Guide */}
        <h4 style={{ margin: "0 0 12px 0", color: "#0f172a", fontSize: "1rem" }}>🧬 Phlebotomy Tube Guide & Additives</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {tubes.map((tube, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedTube(tube.name)}
              style={{
                padding: 14,
                borderRadius: 14,
                background: selectedTube === tube.name ? "#f0fdf4" : "white",
                border: `2px solid ${selectedTube === tube.name ? "#0d9488" : "#e2e8f0"}`,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: tube.color }}></div>
                <strong style={{ fontSize: "0.88rem", color: "#0f172a" }}>{tube.name}</strong>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#475569", marginBottom: 2 }}><strong>Tests:</strong> {tube.tests}</div>
              <div style={{ fontSize: "0.74rem", color: "#64748b" }}><strong>Additive:</strong> {tube.additive}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
