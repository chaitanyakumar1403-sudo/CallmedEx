"use client";

import { useState } from "react";

interface PhlebotomistToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PhlebotomistToolsModal({ isOpen, onClose }: PhlebotomistToolsModalProps) {
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [scanSuccess, setScanSuccess] = useState(false);
  const [selectedTube, setSelectedTube] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSimulateScan = () => {
    const randomBarcode = "VAM-" + Math.floor(100000 + Math.random() * 900000);
    setScannedBarcode(randomBarcode);
    setScanSuccess(true);
  };

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

        {/* Barcode Scanner Simulator */}
        <div style={{ background: "#f8fafc", padding: 20, borderRadius: 16, border: "1px solid #e2e8f0", marginBottom: 20 }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#0f172a", fontSize: "1rem" }}>📷 Specimen Tube Barcode Scanner</h4>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 14px 0" }}>
            Scan or generate barcode tag for collected blood sample tubes to attach directly to patient order.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input
              type="text"
              readOnly
              value={scannedBarcode || "No barcode scanned yet"}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "white", fontWeight: 700, color: scannedBarcode ? "#0f172a" : "#94a3b8" }}
            />
            <button className="btn btn-teal" onClick={handleSimulateScan}>
              ⚡ Scan Sample Tube
            </button>
          </div>
          {scanSuccess && (
            <div style={{ marginTop: 10, color: "#16a34a", fontSize: "0.82rem", fontWeight: 700 }}>
              ✅ Sample Tube Tagged & Verified: {scannedBarcode}
            </div>
          )}
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
