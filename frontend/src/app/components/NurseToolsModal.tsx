"use client";

import { useState } from "react";

interface NurseToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NurseToolsModal({ isOpen, onClose }: NurseToolsModalProps) {
  const [ivVolume, setIvVolume] = useState("500");
  const [ivHours, setIvHours] = useState("4");
  const [dropFactor, setDropFactor] = useState("20");
  const [calculatedRate, setCalculatedRate] = useState<number | null>(null);

  // Vitals Logger
  const [bpSystolic, setBpSystolic] = useState("120");
  const [bpDiastolic, setBpDiastolic] = useState("80");
  const [spo2, setSpo2] = useState("98");
  const [pulse, setPulse] = useState("72");
  const [vitalsSaved, setVitalsSaved] = useState(false);

  if (!isOpen) return null;

  const calculateIvRate = () => {
    const vol = parseFloat(ivVolume);
    const hrs = parseFloat(ivHours);
    const df = parseFloat(dropFactor);
    if (vol > 0 && hrs > 0) {
      const minutes = hrs * 60;
      const rate = (vol * df) / minutes;
      setCalculatedRate(Math.round(rate));
    }
  };

  const handleSaveVitals = () => {
    setVitalsSaved(true);
    setTimeout(() => setVitalsSaved(false), 3000);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="glass-card" style={{ maxWidth: 640, width: "100%", padding: 28, background: "white", borderRadius: 20, maxHeight: "90vh", overflowY: "auto" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>
            👩‍⚕️ Nurse Clinical Assistant <span className="badge-ai">Field Care Engine</span>
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* IV Drip Rate Calculator */}
        <div style={{ background: "#f8fafc", padding: 20, borderRadius: 16, border: "1px solid #e2e8f0", marginBottom: 20 }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#0f172a", fontSize: "1rem" }}>💧 IV Infusion Drip Rate Calculator</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>Volume (mL)</label>
              <input type="number" className="form-input" value={ivVolume} onChange={e => setIvVolume(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>Time (Hours)</label>
              <input type="number" className="form-input" value={ivHours} onChange={e => setIvHours(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>Drop Factor (gtt/mL)</label>
              <select className="form-input" value={dropFactor} onChange={e => setDropFactor(e.target.value)}>
                <option value="20">20 (Standard Adult)</option>
                <option value="15">15 (Blood Set)</option>
                <option value="60">60 (Micro Drip)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button className="btn btn-teal btn-sm" onClick={calculateIvRate}>⚡ Calculate Rate</button>
            {calculatedRate !== null && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "6px 14px", borderRadius: 10, color: "#166534", fontWeight: 800, fontSize: "0.9rem" }}>
                💧 Required Drip Rate: {calculatedRate} drops/min (gtt/min)
              </div>
            )}
          </div>
        </div>

        {/* Patient Vitals Entry Box */}
        <div style={{ background: "white", padding: 20, borderRadius: 16, border: "1px solid #cbd5e1" }}>
          <h4 style={{ margin: "0 0 12px 0", color: "#0f172a", fontSize: "1rem" }}>📊 Record Visit Vitals & Triage</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>Systolic BP</label>
              <input type="number" className="form-input" value={bpSystolic} onChange={e => setBpSystolic(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>Diastolic BP</label>
              <input type="number" className="form-input" value={bpDiastolic} onChange={e => setBpDiastolic(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>SpO2 (%)</label>
              <input type="number" className="form-input" value={spo2} onChange={e => setSpo2(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700 }}>Pulse (bpm)</label>
              <input type="number" className="form-input" value={pulse} onChange={e => setPulse(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button className="btn btn-teal" onClick={handleSaveVitals}>📋 Log Patient Vitals</button>
            {vitalsSaved && <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "0.85rem" }}>✅ Vitals Logged & Sent to Doctor!</span>}
          </div>
        </div>

      </div>
    </div>
  );
}
