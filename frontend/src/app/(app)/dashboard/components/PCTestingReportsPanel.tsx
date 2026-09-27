"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { pcAPI } from "@/lib/api";
import {
  FlaskConical,
  FileCheck2,
  ExternalLink,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Barcode,
  Calendar,
  X,
  Play,
  Check,
} from "lucide-react";

const TUBE_COLOURS: Record<string, string> = {
  lavender: "#9b59b6",
  gold: "#f39c12",
  blue: "#3498db",
  grey: "#95a5a6",
  red: "#e74c3c",
  green: "#2ecc71",
  yellow: "#f1c40f",
};

function capToHex(cap: string): string {
  return TUBE_COLOURS[(cap || "").toLowerCase().trim()] || "#64748b";
}

export default function PCTestingReportsPanel() {
  const [filter, setFilter] = useState<"verified" | "processing" | "report_ready">("verified");
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Delivery modal
  const [deliverySample, setDeliverySample] = useState<any | null>(null);
  const [reportUrl, setReportUrl] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [delivering, setDelivering] = useState(false);

  const fetchSamples = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pcAPI.getSamples(filter);
      setSamples(res.samples || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load samples");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchSamples();
  }, [fetchSamples]);

  const handleStartProcessing = async (sampleId: string, barcode: string) => {
    setActionLoading(sampleId);
    try {
      await pcAPI.startProcessingSample(sampleId);
      toast.success(`Lab analysis started for tube [${barcode || sampleId.slice(0, 8)}]`);
      fetchSamples();
    } catch (e: any) {
      toast.error(e.message || "Failed to start processing");
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenDeliverModal = (sample: any) => {
    setDeliverySample(sample);
    setReportUrl(sample.report_url || "");
    setReportNotes(sample.notes || "");
  };

  const handleDeliverReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliverySample) return;
    if (!reportUrl.trim()) {
      toast.error("Please enter a valid report URL or PDF link");
      return;
    }

    setDelivering(true);
    try {
      await pcAPI.deliverReport(deliverySample.id, {
        report_url: reportUrl.trim(),
        notes: reportNotes.trim() || undefined,
      });
      toast.success(
        `Diagnostic report delivered for sample [${deliverySample.barcode || deliverySample.id.slice(0, 8)}]!`
      );
      setDeliverySample(null);
      setReportUrl("");
      setReportNotes("");
      fetchSamples();
    } catch (e: any) {
      toast.error(e.message || "Failed to deliver report");
    } finally {
      setDelivering(false);
    }
  };

  const filtered = samples.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.barcode || "").toLowerCase().includes(q) ||
      (s.tube_type_code || "").toLowerCase().includes(q) ||
      (s.patient_name || "").toLowerCase().includes(q) ||
      (s.id || "").toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #f0fdf4 0%, #f0f9ff 100%)",
          border: "1px solid #bbf7d0",
          borderRadius: "14px",
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <FlaskConical size={20} color="#059669" />
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#065f46" }}>
              Lab Testing &amp; Diagnostic Report Delivery
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "#475569" }}>
            End-to-end sample testing pipeline: intake verification &rarr; laboratory analysis &rarr; report delivery with patient notification.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSamples}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#475569",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setFilter("verified")}
            style={{
              padding: "7px 16px",
              borderRadius: "999px",
              border: filter === "verified" ? "2px solid #0284c7" : "1px solid #cbd5e1",
              background: filter === "verified" ? "#e0f2fe" : "#ffffff",
              color: filter === "verified" ? "#0369a1" : "#475569",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Clock size={14} /> Ready for Testing
          </button>

          <button
            type="button"
            onClick={() => setFilter("processing")}
            style={{
              padding: "7px 16px",
              borderRadius: "999px",
              border: filter === "processing" ? "2px solid #d97706" : "1px solid #cbd5e1",
              background: filter === "processing" ? "#fef3c7" : "#ffffff",
              color: filter === "processing" ? "#b45309" : "#475569",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FlaskConical size={14} /> In Lab Analysis
          </button>

          <button
            type="button"
            onClick={() => setFilter("report_ready")}
            style={{
              padding: "7px 16px",
              borderRadius: "999px",
              border: filter === "report_ready" ? "2px solid #059669" : "1px solid #cbd5e1",
              background: filter === "report_ready" ? "#d1fae5" : "#ffffff",
              color: filter === "report_ready" ? "#065f46" : "#475569",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CheckCircle2 size={14} /> Completed &amp; Delivered
          </button>
        </div>

        <div style={{ position: "relative", minWidth: "240px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Search barcode or tube..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px 7px 32px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "0.82rem",
            }}
          />
        </div>
      </div>

      {/* Samples List */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
            Loading samples...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
            <FlaskConical size={32} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No samples found for this filter.</p>
            <p style={{ fontSize: "0.82rem", marginTop: 4 }}>
              {filter === "verified"
                ? "Samples verified at intake will appear here ready for lab analysis."
                : filter === "processing"
                ? "No samples currently under testing."
                : "No completed reports in this period."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "12px 18px", fontWeight: 700 }}>Barcode &amp; Tube</th>
                  <th style={{ padding: "12px 18px", fontWeight: 700 }}>Patient &amp; Subject</th>
                  <th style={{ padding: "12px 18px", fontWeight: 700 }}>Status</th>
                  <th style={{ padding: "12px 18px", fontWeight: 700 }}>Intake Time</th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const cap = s.tube_type_code || "grey";
                  const capColor = capToHex(cap);
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              background: capColor,
                              flexShrink: 0,
                              boxShadow: `0 0 6px ${capColor}66`,
                            }}
                            title={`Cap: ${cap}`}
                          />
                          <div>
                            <div style={{ fontFamily: "monospace", fontWeight: 800, color: "#0f172a", fontSize: "0.9rem" }}>
                              {s.barcode || "NO-BARCODE"}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                              Type: {s.tube_type_code || "Unknown"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, color: "#334155" }}>
                          {s.patient_name || s.subject_name || "Patient Sample"}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                          Booking: {s.booking_id ? s.booking_id.slice(0, 8) : "N/A"}
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        {s.status === "verified" && (
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: "999px",
                              background: "#e0f2fe",
                              color: "#0369a1",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Clock size={12} /> Verified &amp; Queued
                          </span>
                        )}
                        {s.status === "processing" && (
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: "999px",
                              background: "#fef3c7",
                              color: "#b45309",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <FlaskConical size={12} /> In Analysis
                          </span>
                        )}
                        {s.status === "report_ready" && (
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: "999px",
                              background: "#d1fae5",
                              color: "#065f46",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <CheckCircle2 size={12} /> Report Delivered
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "14px 18px", color: "#64748b", fontSize: "0.8rem" }}>
                        {s.created_at ? new Date(s.created_at).toLocaleTimeString() : "—"}
                      </td>

                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        {s.status === "verified" && (
                          <button
                            type="button"
                            disabled={actionLoading === s.id}
                            onClick={() => handleStartProcessing(s.id, s.barcode)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              border: "none",
                              background: "#0284c7",
                              color: "#ffffff",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: actionLoading === s.id ? "not-allowed" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Play size={12} /> Start Testing
                          </button>
                        )}

                        {s.status === "processing" && (
                          <button
                            type="button"
                            onClick={() => handleOpenDeliverModal(s)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "8px",
                              border: "none",
                              background: "#059669",
                              color: "#ffffff",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <FileCheck2 size={13} /> Deliver Report
                          </button>
                        )}

                        {s.status === "report_ready" && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            {s.report_url && (
                              <a
                                href={s.report_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  background: "#ffffff",
                                  color: "#0284c7",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <ExternalLink size={12} /> View Report
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenDeliverModal(s)}
                              title="Update Report"
                              style={{
                                padding: "5px 8px",
                                borderRadius: "6px",
                                border: "1px solid #cbd5e1",
                                background: "#f8fafc",
                                color: "#475569",
                                fontSize: "0.75rem",
                                cursor: "pointer",
                              }}
                            >
                              Update
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deliver Report Modal */}
      {deliverySample && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    padding: "6px",
                    borderRadius: "8px",
                    background: "#d1fae5",
                    color: "#059669",
                  }}
                >
                  <FileCheck2 size={18} />
                </div>
                <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                  Deliver Diagnostic Test Report
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setDeliverySample(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "12px 14px",
                marginBottom: "16px",
                fontSize: "0.82rem",
                color: "#334155",
              }}
            >
              <div>
                <strong>Sample Barcode:</strong>{" "}
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0284c7" }}>
                  {deliverySample.barcode || deliverySample.id}
                </span>
              </div>
              <div style={{ marginTop: 2 }}>
                <strong>Tube Type:</strong> {deliverySample.tube_type_code || "Standard Tube"}
              </div>
            </div>

            <form onSubmit={handleDeliverReport} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Report Document / PDF URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://.../diagnostic-report.pdf"
                  value={reportUrl}
                  onChange={(e) => setReportUrl(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.85rem",
                  }}
                />
                <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                  Link to signed diagnostic PDF or lab information management system (LIMS) report.
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                  Clinical Findings &amp; Observations (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. All test values within normal clinical reference ranges. Verified by Senior Pathologist."
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.85rem",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setDeliverySample(null)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={delivering}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#059669",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: delivering ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Check size={14} /> {delivering ? "Delivering..." : "Deliver Report to Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
