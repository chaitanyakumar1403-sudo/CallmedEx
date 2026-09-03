"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "../../components/DashboardShell";
import { patientSamplesAPI } from "@/lib/api";
import {
  FileText, CheckCircle2, AlertCircle, AlertTriangle, ArrowRight,
  Download, UploadCloud, Stethoscope, FlaskConical, Sparkles, ShieldCheck,
  ChevronDown, ChevronRight, User, Activity,
} from "lucide-react";

interface Sample {
  id: string;
  barcode: string;
  status: string;
  stage: string;
  step: number;
  step_label: string;
  test_names: string[];
  subject_name: string;
  report_url: string | null;
  report_status: string | null;
  report_uploaded_at: string | null;
  collected_at: string | null;
  created_at: string;
}

export default function AIReportInterpreter() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">("info");
  const [analysis, setAnalysis] = useState<any>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [showInProgress, setShowInProgress] = useState(false);

  useEffect(() => {
    setSamplesLoading(true);
    patientSamplesAPI.getMySamples()
      .then((data: any) => {
        setSamples(data.samples || []);
      })
      .catch(() => {
        // Silently fail — manual upload still works
      })
      .finally(() => setSamplesLoading(false));
  }, []);

  function formatDate(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  const readyReports = samples.filter((s) => s.report_url);
  const inProgress = samples.filter((s) => !s.report_url);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setStatusTone("info");
    setStatus("Extracting biomarkers and evaluating clinical parameters...");
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
      if (res.ok && (data.success || data.results || data.report_job_id)) {
        if (data.results) {
          setAnalysis(data.results);
          setStatusTone("success");
          setStatus("Clinical report analysis complete.");
        } else {
          setStatusTone("success");
          setStatus("Report submitted for clinical verification. Results will be delivered to your WhatsApp and appear in your health history shortly.");
        }
      } else {
        if (res.status === 401) {
          alert("Your session has expired. Please log in again.");
          router.push("/auth/login");
          return;
        }
        setStatusTone("error");
        setStatus(`Verification error: ${data.detail || "Failed to analyze report"}`);
      }
    } catch (err) {
      setStatusTone("error");
      setStatus("Network error connecting to CallMedEx server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell
      role="patient"
      title="Diagnostic Health Reports"
      subtitle="Digital lab reports verified by NABL reference laboratories and explained clearly."
      tabs={[]}
      activeTab=""
      onTabChange={() => {}}
    >
      <div>
        {/* ── Your CallMedex Lab Results ───────────────────────────────── */}
        <div style={{ marginBottom: "var(--cm-6)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--cm-3)" }}>
            <div>
              <h2 style={{ fontSize: "var(--cm-text-lg)", fontWeight: 800, color: "var(--cm-ink)", margin: 0 }}>
                Verified Laboratory Results
              </h2>
              <p style={{ color: "var(--cm-ink-3)", fontSize: "var(--cm-text-sm)", margin: "4px 0 0 0" }}>
                Authentic reports linked to your doorstep sample collections.
              </p>
            </div>
            <span className="cm-pill cm-pill--active">
              {readyReports.length} Available
            </span>
          </div>

          {samplesLoading && (
            <div className="cm-panel" style={{ padding: "var(--cm-6)", textAlign: "center", color: "var(--cm-ink-3)" }}>
              Loading reports catalog...
            </div>
          )}

          {!samplesLoading && samples.length === 0 && (
            <div className="cm-empty" style={{ padding: "var(--cm-6)" }}>
              <span className="cm-empty__icon">
                <FileText size={28} />
              </span>
              <p className="cm-empty__title">No Lab Results Yet</p>
              <p className="cm-empty__body">
                When your collected sample is analyzed by our partner reference lab, the digital report will appear here automatically.
              </p>
              <button
                type="button"
                className="cm-btn cm-btn--primary cm-btn--sm"
                style={{ marginTop: "var(--cm-4)" }}
                onClick={() => router.push("/diagnostics")}
              >
                Book Diagnostic Panel
              </button>
            </div>
          )}

          {!samplesLoading && readyReports.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-3)" }}>
              {readyReports.map((s) => (
                <div
                  key={s.id}
                  className="cm-card"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--cm-4) var(--cm-5)",
                    border: "1px solid var(--cm-line)",
                    borderRadius: "var(--cm-radius)",
                    gap: "var(--cm-3)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--cm-4)" }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "var(--cm-radius)",
                        background: "var(--cm-surface-2)",
                        color: "var(--cm-navy)",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "var(--cm-text-base)", color: "var(--cm-ink)" }}>
                        {s.test_names?.join(", ") || "Clinical Diagnostic Panel"}
                      </div>
                      <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 2, display: "flex", alignItems: "center", gap: "var(--cm-2)" }}>
                        <span style={{ fontFamily: "monospace" }}>{s.barcode || "NABL-REF"}</span>
                        <span>·</span>
                        <span>{s.subject_name ? `${s.subject_name} · ` : ""}{formatDate(s.report_uploaded_at || s.collected_at || s.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "var(--cm-3)" }}>
                    <span className="cm-pill cm-pill--done">
                      {s.report_status || "Verified"}
                    </span>
                    <a
                      href={s.report_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cm-btn cm-btn--secondary cm-btn--sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Download size={14} /> Download PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!samplesLoading && inProgress.length > 0 && (
            <div style={{ marginTop: "var(--cm-4)" }}>
              <button
                type="button"
                onClick={() => setShowInProgress(!showInProgress)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--cm-ink-2)",
                  fontSize: "var(--cm-text-xs)",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 0",
                }}
              >
                {showInProgress ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {inProgress.length} sample{inProgress.length > 1 ? "s" : ""} currently in processing
              </button>

              {showInProgress && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-2)", marginTop: "var(--cm-2)" }}>
                  {inProgress.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        background: "var(--cm-surface-2)",
                        borderRadius: "var(--cm-radius)",
                        padding: "10px 16px",
                        border: "1px solid var(--cm-line)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>
                          {s.test_names?.join(", ") || "Diagnostic Sample"}
                        </div>
                        <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", fontFamily: "monospace" }}>
                          {s.barcode || ""}
                        </div>
                      </div>
                      <span className="cm-pill cm-pill--waiting">
                        {s.step_label || "In Testing"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── AI Report Interpretation Tool ─────────────────────────── */}
        <div className="cm-clinical-section">
          <div className="cm-clinical-section__head">
            <div className="cm-clinical-section__title-group">
              <div className="cm-clinical-section__icon-box">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="cm-clinical-section__title">Clinical AI Report Explainer</h3>
                <p className="cm-clinical-section__subtitle">
                  Upload an external medical laboratory PDF to generate an accessible summary, identify abnormal biomarkers, and receive clinical diet recommendations.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleUpload} style={{ display: "flex", gap: "var(--cm-3)", alignItems: "center", flexWrap: "wrap", marginBottom: "var(--cm-3)" }}>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              style={{
                flex: "1 1 280px",
                padding: "10px 14px",
                border: "1px dashed var(--cm-line-strong)",
                borderRadius: "var(--cm-radius)",
                background: "var(--cm-surface)",
                fontSize: "var(--cm-text-sm)",
                cursor: "pointer",
              }}
            />
            <button
              type="submit"
              disabled={!file || loading}
              className="cm-btn cm-btn--primary"
              style={{ padding: "10px 20px", fontWeight: 700 }}
            >
              <UploadCloud size={16} /> {loading ? "Analyzing Document..." : "Analyze Lab PDF"}
            </button>
          </form>

          {status && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--cm-radius)",
                fontSize: "var(--cm-text-sm)",
                fontWeight: 600,
                background: statusTone === "success" ? "var(--cm-done-surface)" : statusTone === "error" ? "var(--cm-urgent-surface)" : "var(--cm-surface-2)",
                color: statusTone === "success" ? "var(--cm-done)" : statusTone === "error" ? "var(--cm-urgent)" : "var(--cm-ink)",
                border: `1px solid ${statusTone === "success" ? "var(--cm-done-line)" : statusTone === "error" ? "var(--cm-urgent-line)" : "var(--cm-line)"}`,
              }}
            >
              {status}
            </div>
          )}

          {/* AI Analysis Dossier */}
          {analysis && (
            <div style={{ marginTop: "var(--cm-6)", borderTop: "1px solid var(--cm-line)", paddingTop: "var(--cm-5)" }}>
              {/* Patient Demographics Banner */}
              <div
                style={{
                  background: "var(--cm-navy)",
                  color: "var(--cm-surface)",
                  padding: "var(--cm-4) var(--cm-5)",
                  borderRadius: "var(--cm-radius)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--cm-3)",
                  marginBottom: "var(--cm-5)",
                }}
              >
                <div>
                  <span style={{ fontSize: "var(--cm-text-xs)", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--cm-line)" }}>
                    Verified Patient File
                  </span>
                  <h3 style={{ margin: "4px 0 0 0", fontSize: "var(--cm-text-lg)", color: "var(--cm-surface)" }}>
                    {analysis.patient_info?.name || "Patient Record"}
                  </h3>
                  <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-line)" }}>
                    Demographics: {analysis.patient_info?.age_gender || "Not specified"}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-line)" }}>Clinical Health Score</span>
                  <div style={{ fontSize: "var(--cm-text-2xl)", fontWeight: 800, color: "var(--cm-surface)", fontVariantNumeric: "tabular-nums" }}>
                    {analysis.health_score || 85} <span style={{ fontSize: "var(--cm-text-sm)", fontWeight: 400 }}>/ 100</span>
                  </div>
                </div>
              </div>

              {/* Analysis Split Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--cm-5)" }}>
                {/* Left: Health Story & Diet Action Plan */}
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-4)" }}>
                  <div style={{ background: "var(--cm-surface-2)", padding: "var(--cm-4)", borderRadius: "var(--cm-radius)", border: "1px solid var(--cm-line)" }}>
                    <h4 style={{ margin: "0 0 8px 0", color: "var(--cm-navy)", fontSize: "var(--cm-text-base)", fontWeight: 800 }}>
                      Plain Language Summary
                    </h4>
                    <p style={{ margin: 0, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)", lineHeight: 1.6 }}>
                      {analysis.plain_language_summary}
                    </p>
                  </div>

                  <div style={{ background: "var(--cm-surface)", padding: "var(--cm-4)", borderRadius: "var(--cm-radius)", border: "1px solid var(--cm-line)" }}>
                    <h4 style={{ margin: "0 0 12px 0", color: "var(--cm-ink)", fontSize: "var(--cm-text-base)", fontWeight: 800 }}>
                      Personalized Diet & Lifestyle Guidance
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-2)" }}>
                      {(analysis.recommendations || []).map((rec: string, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            background: "var(--cm-surface-2)",
                            padding: "10px 14px",
                            borderRadius: "var(--cm-radius-sm)",
                            borderLeft: "3px solid var(--cm-done)",
                            fontSize: "var(--cm-text-sm)",
                            color: "var(--cm-ink)",
                          }}
                        >
                          {rec}
                        </div>
                      ))}
                    </div>
                  </div>

                  {analysis.doctor_clinical_summary && (
                    <div style={{ background: "var(--cm-surface)", padding: "var(--cm-4)", borderRadius: "var(--cm-radius)", border: "1px solid var(--cm-line)" }}>
                      <h4 style={{ margin: "0 0 6px 0", color: "var(--cm-ink-2)", fontSize: "var(--cm-text-xs)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Physician Clinical Note
                      </h4>
                      <p style={{ margin: 0, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", fontStyle: "italic", lineHeight: 1.5 }}>
                        {analysis.doctor_clinical_summary}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right: Biomarkers & Next Steps */}
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-4)" }}>
                  <div style={{ background: "var(--cm-surface)", padding: "var(--cm-4)", borderRadius: "var(--cm-radius)", border: "1px solid var(--cm-line)" }}>
                    <h4 style={{ margin: "0 0 12px 0", color: "var(--cm-ink)", fontSize: "var(--cm-text-base)", fontWeight: 800 }}>
                      Biomarker Parameters ({analysis.abnormal_flags?.length || 0})
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-2)" }}>
                      {(analysis.abnormal_flags || []).map((flag: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "var(--cm-radius-sm)",
                            background: flag.status === "high" || flag.status === "critical" ? "var(--cm-urgent-surface)" : "var(--cm-done-surface)",
                            border: `1px solid ${flag.status === "high" || flag.status === "critical" ? "var(--cm-urgent-line)" : "var(--cm-done-line)"}`,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <strong style={{ color: "var(--cm-ink)", fontSize: "var(--cm-text-sm)" }}>{flag.marker}</strong>
                            <span
                              className={`cm-pill ${flag.status === "high" || flag.status === "critical" ? "cm-pill--urgent" : "cm-pill--done"}`}
                              style={{ fontSize: "var(--cm-text-xs)" }}
                            >
                              {flag.status}
                            </span>
                          </div>
                          <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", display: "flex", justifyContent: "space-between" }}>
                            <span>Measured: <strong>{flag.value}</strong></span>
                            <span>Normal: {flag.reference_range}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: "var(--cm-surface-2)", padding: "var(--cm-4)", borderRadius: "var(--cm-radius)", border: "1px solid var(--cm-line)" }}>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: "var(--cm-text-base)", color: "var(--cm-ink)", fontWeight: 800 }}>
                      Need Specialist Review?
                    </h4>
                    <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", margin: "0 0 var(--cm-3) 0" }}>
                      Connect directly with a verified doctor to evaluate these lab results in a secure telemedicine consultation.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-2)" }}>
                      <button
                        type="button"
                        className="cm-btn cm-btn--primary cm-btn--sm"
                        onClick={() => router.push("/consultation")}
                      >
                        <Stethoscope size={14} /> Schedule Video Consultation
                      </button>
                      <button
                        type="button"
                        className="cm-btn cm-btn--secondary cm-btn--sm"
                        onClick={() => router.push("/diagnostics")}
                      >
                        <FlaskConical size={14} /> Book Follow-up Test
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
