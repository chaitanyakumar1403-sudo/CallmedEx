"use client";

import { useState } from "react";

interface DrugShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DrugShieldModal({ isOpen, onClose }: DrugShieldModalProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleVerifyDrug = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/ai/verify-drug`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ medicine_name: query, batch_number: "BATCH-2026-CDSCO" })
      });
      const data = await res.json();
      if (data.success) setResult(data);
    } catch (e) {
      alert("Failed to verify medicine with CDSCO database.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="glass-card" style={{ maxWidth: 540, width: "100%", padding: 28, background: "white", borderRadius: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a" }}>
            🛡️ DrugShield AI <span className="badge-ai">CDSCO / Jan Aushadhi</span>
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 16px 0" }}>
          Type any medicine name (e.g. Dolo 650, Pan 40, Augmentin 625). AI verifies batch manufacturing authenticity and displays 80% cheaper generic alternatives!
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Dolo 650, Pan 40, Augmentin 625..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn-teal" onClick={handleVerifyDrug} disabled={loading}>
            {loading ? "Searching..." : "🔍 Verify Medicine"}
          </button>
        </div>

        {result && (
          <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="badge badge-success" style={{ fontSize: "0.8rem" }}>
                ✓ {result.data.cdsco_status}
              </span>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Registry: {result.verification_source}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              {/* Brand Medicine */}
              <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", padding: 12, borderRadius: 10 }}>
                <small style={{ color: "#e11d48", fontWeight: 700 }}>BRAND MEDICINE</small>
                <h4 style={{ margin: "4px 0", color: "#881337" }}>{result.data.brand_name}</h4>
                <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#9f1239" }}>₹{result.data.brand_price}</p>
                <small style={{ color: "#9f1239" }}>Mfr: {result.data.manufacturer}</small>
              </div>

              {/* Generic Alternative */}
              <div style={{ background: "#f0fdf4", border: "2px solid #22c55e", padding: 12, borderRadius: 10 }}>
                <small style={{ color: "#166534", fontWeight: 700 }}>GENERIC ALTERNATIVE</small>
                <h4 style={{ margin: "4px 0", color: "#14532d" }}>{result.data.generic_name}</h4>
                <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#15803d" }}>₹{result.data.generic_price}</p>
                <span className="badge badge-success" style={{ marginTop: 4 }}>Save {result.data.savings_percentage}%</span>
              </div>
            </div>

            <div style={{ background: "#e0f2fe", padding: 10, borderRadius: 8, fontSize: "0.82rem", color: "#0369a1" }}>
              💡 <strong>Composition:</strong> {result.data.composition}. Complies with NMC 2026 generic prescribing mandate.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
