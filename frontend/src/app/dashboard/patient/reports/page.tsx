"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AIReportInterpreter() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [analysis, setAnalysis] = useState<any>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setStatus("🔬 Extracting biomarkers & running clinical AI analysis...");
    setAnalysis(null);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/reports/analyze`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.results) {
        setAnalysis(data.results);
        setStatus("✅ Clinical Report Analysis Complete!");
      } else {
        if (res.status === 401) {
          alert("Your session has expired. Please log in again.");
          router.push("/auth/login");
          return;
        }
        setStatus(`Error: ${data.detail || "Failed to analyze report"}`);
      }
    } catch (err) {
      setStatus("❌ Network error connecting to CallMedex AI server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#f8fafc", minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <h1 style={{ color: "#0f172a", fontSize: "2.2rem", fontWeight: 800, margin: "0 0 10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            🔬 AI Medical Lab Report Interpreter <span className="badge-ai">NMC 2026 AI Engine</span>
          </h1>
          <p style={{ color: "#64748b", fontSize: "1.05rem", maxWidth: 700, margin: "0 auto" }}>
            Upload your raw medical lab PDF. CallMedex AI translates medical jargon into a plain-language health story, flags abnormal values, and provides tailored diet & doctor recommendations.
          </p>
        </div>

        {/* Upload Card */}
        <div className="glass-card" style={{ padding: 32, background: "white", borderRadius: 20, marginBottom: 36, boxShadow: "0 10px 30px rgba(0,0,0,0.04)" }}>
          <form onSubmit={handleUpload} style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              style={{ flex: 1, minWidth: 260, padding: 12, border: "2px dashed #cbd5e1", borderRadius: 12, background: "#f8fafc", cursor: "pointer" }}
            />
            <button
              type="submit"
              disabled={!file || loading}
              className="btn btn-teal"
              style={{ padding: "14px 28px", fontWeight: 800, fontSize: "1rem", borderRadius: 12 }}
            >
              {loading ? "⚡ Analyzing Report..." : "📑 Analyze Report Now"}
            </button>
          </form>

          {status && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "#f1f5f9", color: "#334155", fontWeight: 600, fontSize: "0.9rem" }}>
              {status}
            </div>
          )}
        </div>

        {/* ANALYSIS RESULTS PRESENTATION */}
        {analysis && (
          <div style={{ animation: "fadeIn 0.5s ease-out" }}>
            
            {/* Patient Header Banner */}
            <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "white", padding: 24, borderRadius: 20, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div>
                <span style={{ fontSize: "0.8rem", color: "#38bdf8", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Patient Report File</span>
                <h2 style={{ margin: "4px 0 0 0", fontSize: "1.4rem" }}>👤 {analysis.patient_info?.name || "MR. P GOPI"}</h2>
                <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Demographics: {analysis.patient_info?.age_gender || "53 Years / Male"}</span>
              </div>
              <div style={{ textAlign: "right", background: "rgba(255,255,255,0.1)", padding: "10px 20px", borderRadius: 14, backdropFilter: "blur(4px)" }}>
                <span style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>Health Index Score</span>
                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: analysis.health_score >= 80 ? "#4ade80" : "#facc15" }}>
                  {analysis.health_score || 85} <small style={{ fontSize: "1rem" }}>/ 100</small>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
              
              {/* Left Column: Patient Summary & Doctor View */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                {/* Plain Language Summary Card */}
                <div className="glass-card" style={{ padding: 28, background: "linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)", borderRadius: 20, border: "1px solid #bae6fd" }}>
                  <h3 style={{ margin: "0 0 12px 0", color: "#0369a1", fontSize: "1.2rem", display: "flex", alignItems: "center", gap: 8 }}>
                    💡 Reassuring Patient Health Summary
                  </h3>
                  <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "#0f172a", margin: 0, fontWeight: 500 }}>
                    {analysis.plain_language_summary}
                  </p>
                </div>

                {/* Targeted Diet & Lifestyle Guidance */}
                <div className="glass-card" style={{ padding: 28, background: "white", borderRadius: 20, border: "1px solid #e2e8f0" }}>
                  <h3 style={{ margin: "0 0 16px 0", color: "#0f172a", fontSize: "1.15rem", display: "flex", alignItems: "center", gap: 8 }}>
                    🥗 Personalized Diet & Lifestyle Action Plan
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {(analysis.recommendations || []).map((rec: string, idx: number) => (
                      <div key={idx} style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: 12, borderLeft: "4px solid #0d9488", fontSize: "0.92rem", color: "#334155", fontWeight: 600 }}>
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Doctor's Clinical View */}
                <div className="glass-card" style={{ padding: 24, background: "#f8fafc", borderRadius: 18, border: "1px solid #cbd5e1" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#475569", fontSize: "0.95rem" }}>👨‍⚕️ Physician Clinical View</h4>
                  <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>
                    {analysis.doctor_clinical_summary}
                  </p>
                </div>

              </div>

              {/* Right Column: Abnormal Biomarker Flags & 1-Click CTAs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                {/* Abnormal Biomarker Flags */}
                <div className="glass-card" style={{ padding: 24, background: "white", borderRadius: 20, border: "1px solid #e2e8f0" }}>
                  <h3 style={{ margin: "0 0 16px 0", color: "#e11d48", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8 }}>
                    ⚠️ Biomarker Analysis ({analysis.abnormal_flags?.length || 0})
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {(analysis.abnormal_flags || []).map((flag: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: 16,
                          borderRadius: 14,
                          background: flag.status === "high" || flag.status === "critical" ? "#fff1f2" : "#f0fdf4",
                          border: `1.5px solid ${flag.status === "high" || flag.status === "critical" ? "#fecdd3" : "#bbf7d0"}`,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>{flag.marker}</strong>
                          <span
                            className={`badge ${flag.status === "high" || flag.status === "critical" ? "badge-danger" : "badge-success"}`}
                            style={{ fontSize: "0.72rem", textTransform: "uppercase" }}
                          >
                            {flag.status}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#475569", display: "flex", justifyContent: "space-between" }}>
                          <span>Measured: <strong style={{ color: "#0f172a" }}>{flag.value}</strong></span>
                          <span>Normal: {flag.reference_range}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 1-Click Next Actions */}
                <div className="glass-card" style={{ padding: 24, background: "linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)", color: "white", borderRadius: 20, textAlign: "center" }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "1.1rem" }}>🩺 Need Specialist Consultation?</h4>
                  <p style={{ fontSize: "0.85rem", opacity: 0.9, margin: "0 0 16px 0" }}>
                    Connect with a verified specialist to review these results in HD video or request home visit.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ background: "white", color: "#0f766e", fontWeight: 800, width: "100%" }}
                      onClick={() => router.push("/consultation")}
                    >
                      📹 Consult Doctor Now
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "1px solid white", fontWeight: 700, width: "100%" }}
                      onClick={() => router.push("/diagnostics")}
                    >
                      🧪 Book Follow-up Test
                    </button>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
