"use client";

/**
 * SampleStatusRail & SampleTrackerModal — Clinical 2-Step Sample Progress
 *
 * Strict 2-Step Model:
 *   1. Sample Collected (Home collection completed by certified phlebotomist)
 *   2. Report Delivered to WhatsApp (Delivered via WhatsApp with direct view/download)
 *
 * All technical and intermediate steps (in transit, received at PC, verified,
 * batched, sent to lab) are strictly hidden from the patient interface.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  TestTube, CheckCircle2, Clock, X, Download, ExternalLink,
  Sparkles, RefreshCw, AlertTriangle, ShieldCheck
} from "@/components/ui/icons";
import { patientSamplesAPI } from "@/lib/api";
import { PATIENT_TRANSLATIONS, PatientLang } from "../patient/patientTranslations";

const TUBE_COLOURS: Record<string, { bg: string; border: string; text: string }> = {
  lavender: { bg: "rgba(168, 85, 247, 0.2)", border: "rgba(168, 85, 247, 0.5)", text: "#e9d5ff" },
  gold: { bg: "rgba(245, 158, 11, 0.2)", border: "rgba(245, 158, 11, 0.5)", text: "#fef3c7" },
  blue: { bg: "rgba(14, 165, 233, 0.2)", border: "rgba(14, 165, 233, 0.5)", text: "#bae6fd" },
  grey: { bg: "rgba(148, 163, 184, 0.2)", border: "rgba(148, 163, 184, 0.5)", text: "#f1f5f9" },
  red: { bg: "rgba(239, 68, 68, 0.2)", border: "rgba(239, 68, 68, 0.5)", text: "#fecaca" },
  green: { bg: "rgba(16, 185, 129, 0.2)", border: "rgba(16, 185, 129, 0.5)", text: "#a7f3d0" },
  yellow: { bg: "rgba(234, 179, 8, 0.2)", border: "rgba(234, 179, 8, 0.5)", text: "#fef08a" },
};

function getTubeStyle(cap: string) {
  const key = (cap || "").toLowerCase().trim();
  return TUBE_COLOURS[key] || { bg: "rgba(56, 189, 248, 0.15)", border: "rgba(56, 189, 248, 0.35)", text: "#e0f2fe" };
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return null;
  }
}

/**
 * 2-Step Sample Progress Card
 */
export function SampleProgressCard({ sample, lang = 'en' }: { sample: any; lang?: PatientLang }) {
  const t = PATIENT_TRANSLATIONS[lang] || PATIENT_TRANSLATIONS.en;
  const tubeStyle = getTubeStyle(sample.cap_colour);

  const isRejected = sample.status === "rejected" || sample.stage === "rejected";
  const isCancelled = sample.status === "cancelled" || sample.stage === "cancelled";

  // Step 1: Sample Collected
  // Reached if status is anything other than pending_collection and not cancelled
  const isStep1Done = !["pending_collection", "cancelled", "rejected"].includes(sample.status) &&
                      !["pending_collection", "cancelled", "rejected"].includes(sample.stage);
  const step1Time = formatDate(sample.collected_at);

  // Step 2: Report Delivered to WhatsApp
  // Reached if report is uploaded, delivered, completed, or report_url exists
  const isStep2Done = Boolean(
    sample.report_url ||
    sample.report_status === "delivered" ||
    sample.status === "delivered" ||
    sample.status === "completed" ||
    sample.status === "report_ready" ||
    sample.stage === "delivered" ||
    sample.stage === "completed"
  );
  const step2Time = formatDate(sample.report_uploaded_at || sample.verified_at);

  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(56, 189, 248, 0.22)",
        borderRadius: 18,
        padding: "18px 20px",
        boxShadow: "0 8px 32px -4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header Info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 999,
                background: tubeStyle.bg,
                border: `1px solid ${tubeStyle.border}`,
                fontSize: "0.78rem",
                fontWeight: 700,
                color: tubeStyle.text,
              }}
            >
              <TestTube size={13} />
              {sample.tube_name || sample.expected_tube_type_code || "Diagnostic Specimen"}
              {sample.cap_colour ? ` (${sample.cap_colour})` : ""}
            </span>

            {sample.subject_name && (
              <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600 }}>
                for <span style={{ color: "#f1f5f9" }}>{sample.subject_name}</span>
              </span>
            )}

            {sample.barcode && (
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "#64748b",
                  fontFamily: "monospace",
                  background: "rgba(255, 255, 255, 0.05)",
                  padding: "2px 6px",
                  borderRadius: 6,
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                #{sample.barcode}
              </span>
            )}
          </div>

          {/* Test names */}
          {sample.test_names && sample.test_names.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
              {sample.test_names.map((name: string, i: number) => (
                <span
                  key={i}
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: "rgba(56, 189, 248, 0.08)",
                    color: "#7dd3fc",
                    border: "1px solid rgba(56, 189, 248, 0.2)",
                    fontWeight: 600,
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status Chip */}
        <div>
          {isRejected ? (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(239, 68, 68, 0.2)",
                color: "#fca5a5",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <AlertTriangle size={12} /> Recollection Needed
            </span>
          ) : isCancelled ? (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(148, 163, 184, 0.15)",
                color: "#94a3b8",
                border: "1px solid rgba(148, 163, 184, 0.3)",
              }}
            >
              Order Cancelled
            </span>
          ) : isStep2Done ? (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "4px 12px",
                borderRadius: 999,
                background: "linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(16, 185, 129, 0.2) 100%)",
                color: "#4ade80",
                border: "1px solid rgba(34, 197, 94, 0.45)",
                boxShadow: "0 0 12px rgba(34, 197, 94, 0.2)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <CheckCircle2 size={13} /> WhatsApp Report Ready
            </span>
          ) : isStep1Done ? (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "4px 12px",
                borderRadius: 999,
                background: "rgba(56, 189, 248, 0.2)",
                color: "#38bdf8",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                boxShadow: "0 0 10px rgba(56, 189, 248, 0.2)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Sparkles size={12} /> Lab Analysis Active
            </span>
          ) : (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(245, 158, 11, 0.15)",
                color: "#fde047",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Clock size={12} /> Awaiting Collection
            </span>
          )}
        </div>
      </div>

      {/* ── Strict 2-Step Stepper Layout ── */}
      <div
        style={{
          background: "rgba(11, 19, 41, 0.7)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 14,
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Step 1: Sample Collected */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isStep1Done
                ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                : "rgba(245, 158, 11, 0.25)",
              color: isStep1Done ? "#ffffff" : "#fde047",
              border: isStep1Done ? "2px solid #4ade80" : "2px solid rgba(245, 158, 11, 0.5)",
              boxShadow: isStep1Done ? "0 0 12px rgba(34, 197, 94, 0.35)" : "none",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            {isStep1Done ? <CheckCircle2 size={17} /> : <Clock size={16} />}
          </div>

          {/* Vertical progress connector */}
          <div
            style={{
              position: "absolute",
              left: 15,
              top: 36,
              bottom: -16,
              width: 2,
              background: isStep1Done
                ? isStep2Done
                  ? "linear-gradient(180deg, #22c55e 0%, #10b981 100%)"
                  : "linear-gradient(180deg, #22c55e 0%, #38bdf8 100%)"
                : "rgba(255, 255, 255, 0.12)",
              transition: "background 0.3s ease",
            }}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
              <span style={{ fontSize: "0.88rem", fontWeight: 800, color: isStep1Done ? "#ffffff" : "#94a3b8" }}>
                Step 1: {t.sampleSteps?.step1_collected || "Sample Collected"}
              </span>
              {step1Time && (
                <span style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 600 }}>
                  {step1Time}
                </span>
              )}
            </div>
            <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: isStep1Done ? "#cbd5e1" : "#64748b", lineHeight: 1.4 }}>
              {isStep1Done
                ? "Doorstep collection completed by certified phlebotomist with temperature-monitored sterile kit."
                : "Certified phlebotomist dispatched for doorstep collection. Awaiting specimen draw."}
            </p>
          </div>
        </div>

        {/* Step 2: Report Delivered to WhatsApp */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingTop: 4 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isStep2Done
                ? "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)"
                : isStep1Done
                ? "linear-gradient(135deg, rgba(2, 132, 199, 0.3) 0%, rgba(37, 99, 235, 0.2) 100%)"
                : "rgba(255, 255, 255, 0.06)",
              color: isStep2Done ? "#ffffff" : isStep1Done ? "#38bdf8" : "#475569",
              border: isStep2Done
                ? "2px solid #4ade80"
                : isStep1Done
                ? "2px solid rgba(56, 189, 248, 0.6)"
                : "2px solid rgba(255, 255, 255, 0.12)",
              boxShadow: isStep2Done
                ? "0 0 14px rgba(34, 197, 94, 0.45)"
                : isStep1Done
                ? "0 0 10px rgba(56, 189, 248, 0.25)"
                : "none",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            {isStep2Done ? (
              <CheckCircle2 size={17} />
            ) : isStep1Done ? (
              <Sparkles size={16} />
            ) : (
              <Clock size={16} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
              <span style={{ fontSize: "0.88rem", fontWeight: 800, color: isStep2Done ? "#ffffff" : isStep1Done ? "#e2e8f0" : "#64748b" }}>
                Step 2: {t.sampleSteps?.step2_whatsapp || "Report Delivered to WhatsApp"}
              </span>
              {step2Time && isStep2Done && (
                <span style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 600 }}>
                  {step2Time}
                </span>
              )}
            </div>
            <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: isStep2Done ? "#cbd5e1" : "#64748b", lineHeight: 1.4 }}>
              {isStep2Done
                ? "Verified diagnostic report delivered directly to your registered WhatsApp phone number."
                : isStep1Done
                ? "Lab analysis active under certified clinical oversight. Your report will be automatically dispatched to WhatsApp upon validation."
                : "Pending lab analysis and WhatsApp dispatch following doorstep specimen collection."}
            </p>
          </div>
        </div>
      </div>

      {/* Action Footers: WhatsApp View / Download */}
      {isStep2Done && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, paddingTop: 4 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "#4ade80", fontWeight: 600 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 8px #22c55e",
              }}
            />
            Delivered via WhatsApp (+91 registered)
          </div>

          <a
            href={sample.report_url || `/dashboard/patient/reports`}
            target={sample.report_url ? "_blank" : "_self"}
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 18px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              color: "#ffffff",
              fontSize: "0.82rem",
              fontWeight: 700,
              textDecoration: "none",
              border: "1px solid rgba(74, 222, 128, 0.4)",
              boxShadow: "0 4px 14px rgba(22, 163, 74, 0.35)",
              transition: "all 0.2s ease",
            }}
          >
            <Download size={14} />
            View / Download WhatsApp Report
            <ExternalLink size={13} style={{ opacity: 0.8 }} />
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Interactive Glassmorphic Sample Tracker Modal
 */
export function SampleTrackerModal({
  isOpen,
  onClose,
  lang = 'en',
}: {
  isOpen: boolean;
  onClose: () => void;
  lang?: PatientLang;
}) {
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const t = PATIENT_TRANSLATIONS[lang] || PATIENT_TRANSLATIONS.en;

  const loadSamples = useCallback(async () => {
    setLoading(true);
    try {
      const data = await patientSamplesAPI.getMySamples();
      setSamples(data.samples || []);
    } catch {
      // Fallback empty
      setSamples([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSamples();
    }
  }, [isOpen, loadSamples]);

  if (!isOpen) return null;

  // Active samples: still in progress (not delivered, cancelled, completed)
  const activeSamples = samples.filter((s) => {
    const isFinished = ["delivered", "completed", "cancelled", "rejected", "failed"].includes(s.status) ||
                       Boolean(s.report_url);
    return s.is_active === true && !isFinished;
  });

  // History samples: delivered, completed, or previous
  const historySamples = samples.filter((s) => {
    const isFinished = ["delivered", "completed", "cancelled", "rejected", "failed"].includes(s.status) ||
                       Boolean(s.report_url) ||
                       s.is_active === false;
    return isFinished;
  });

  const displayList = activeTab === "active" ? activeSamples : historySamples;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sample-tracker-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(4, 9, 24, 0.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          background: "linear-gradient(165deg, rgba(11, 19, 41, 0.96) 0%, rgba(15, 23, 42, 0.94) 50%, rgba(30, 58, 138, 0.5) 100%)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          borderRadius: 24,
          boxShadow: "0 25px 70px -10px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, 0.15)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "radial-gradient(circle at 35% 30%, rgba(56, 189, 248, 0.3) 0%, rgba(15, 23, 42, 0.9) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#38bdf8",
                boxShadow: "0 0 16px rgba(56, 189, 248, 0.25)",
              }}
            >
              <TestTube size={22} />
            </div>
            <div>
              <h2
                id="sample-tracker-title"
                style={{
                  margin: 0,
                  fontSize: "1.15rem",
                  fontWeight: 800,
                  color: "#ffffff",
                  letterSpacing: "-0.01em",
                }}
              >
                Diagnostic Sample Tracker
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>
                Strict 2-Step Live Status: Collection → WhatsApp Report
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "50%",
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#cbd5e1",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            padding: "14px 24px 8px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: activeTab === "active"
                ? "linear-gradient(135deg, rgba(2, 132, 199, 0.45) 0%, rgba(37, 99, 235, 0.35) 100%)"
                : "transparent",
              color: activeTab === "active" ? "#ffffff" : "#94a3b8",
              border: activeTab === "active"
                ? "1px solid rgba(56, 189, 248, 0.6)"
                : "1px solid transparent",
              boxShadow: activeTab === "active"
                ? "0 0 14px rgba(56, 189, 248, 0.25)"
                : "none",
            }}
          >
            <span>Active Samples</span>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "2px 7px",
                borderRadius: 999,
                background: activeTab === "active" ? "rgba(56, 189, 248, 0.3)" : "rgba(255, 255, 255, 0.08)",
                color: activeTab === "active" ? "#38bdf8" : "#94a3b8",
                fontWeight: 800,
              }}
            >
              {activeSamples.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: activeTab === "history"
                ? "linear-gradient(135deg, rgba(2, 132, 199, 0.45) 0%, rgba(37, 99, 235, 0.35) 100%)"
                : "transparent",
              color: activeTab === "history" ? "#ffffff" : "#94a3b8",
              border: activeTab === "history"
                ? "1px solid rgba(56, 189, 248, 0.6)"
                : "1px solid transparent",
              boxShadow: activeTab === "history"
                ? "0 0 14px rgba(56, 189, 248, 0.25)"
                : "none",
            }}
          >
            <span>Sample History</span>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "2px 7px",
                borderRadius: 999,
                background: activeTab === "history" ? "rgba(56, 189, 248, 0.3)" : "rgba(255, 255, 255, 0.08)",
                color: activeTab === "history" ? "#38bdf8" : "#94a3b8",
                fontWeight: 800,
              }}
            >
              {historySamples.length}
            </span>
          </button>

          <button
            type="button"
            onClick={loadSamples}
            aria-label="Refresh samples"
            title="Refresh sample status"
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: "0.78rem",
            }}
          >
            <RefreshCw size={13} className={loading ? "cm-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Modal Body / Sample Cards */}
        <div
          style={{
            padding: 24,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {loading ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "3px solid rgba(56, 189, 248, 0.2)",
                  borderTopColor: "#38bdf8",
                  borderRadius: "50%",
                  animation: "cm-spin 1s linear infinite",
                  margin: "0 auto 12px",
                }}
              />
              Loading sample records…
            </div>
          ) : displayList.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "36px 20px",
                background: "rgba(15, 23, 42, 0.4)",
                borderRadius: 18,
                border: "1px dashed rgba(255, 255, 255, 0.12)",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "rgba(56, 189, 248, 0.1)",
                  border: "1px solid rgba(56, 189, 248, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#38bdf8",
                  margin: "0 auto 12px",
                }}
              >
                <TestTube size={24} />
              </div>
              <h3 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 700, color: "#f1f5f9" }}>
                {activeTab === "active" ? "No Samples Currently in Transit" : "No Past Sample History"}
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: "0.82rem", color: "#94a3b8", maxWidth: 360, marginInline: "auto" }}>
                {activeTab === "active"
                  ? "All previously collected samples have been analyzed and delivered. Check 'Sample History' to view past WhatsApp reports."
                  : "You do not have any past diagnostic reports or collected specimens on file."}
              </p>
              <a
                href="/booking"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 20px",
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                  color: "#ffffff",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  textDecoration: "none",
                  border: "1px solid rgba(56, 189, 248, 0.5)",
                }}
              >
                Book Doorstep Test Collection
              </a>
            </div>
          ) : (
            displayList.map((sample) => (
              <SampleProgressCard key={sample.id} sample={sample} lang={lang} />
            ))
          )}
        </div>

        {/* Modal Security Footer */}
        <div
          style={{
            padding: "14px 24px",
            background: "rgba(11, 19, 41, 0.9)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "#64748b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={14} style={{ color: "#4ade80" }} />
            <span>NABL &amp; ICMR Certified Pathology Network · ABDM Verified</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Default Export: SampleStatusRail
 * Backwards-compatible rail if mounted, but primarily renders the trigger or
 * compact preview without the clunky 5-step horizontal bar.
 */
export default function SampleStatusRail({ lang = 'en' }: { lang?: PatientLang }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCount, setActiveCount] = useState<number>(0);

  useEffect(() => {
    patientSamplesAPI
      .getMySamples()
      .then((data) => {
        const active = (data.samples || []).filter(
          (s: any) =>
            s.is_active === true &&
            !["cancelled", "completed", "delivered", "failed", "rejected"].includes(s.status) &&
            !s.report_url
        );
        setActiveCount(active.length);
      })
      .catch(() => {});
  }, []);

  // If no active samples, don't render inline rail
  if (activeCount === 0) return null;

  return (
    <>
      <div
        id="sample-tracking"
        onClick={() => setIsModalOpen(true)}
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 58, 138, 0.3) 100%)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: 16,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          boxShadow: "0 8px 24px -4px rgba(2, 132, 199, 0.15)",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(56, 189, 248, 0.15)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#38bdf8",
            }}
          >
            <TestTube size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "#ffffff" }}>
                Active Diagnostic Samples in Transit
              </span>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#4ade80",
                  boxShadow: "0 0 8px #4ade80",
                }}
              />
            </div>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
              {activeCount} specimen tube{activeCount === 1 ? "" : "s"} undergoing lab analysis · Click to view 2-step progress
            </span>
          </div>
        </div>

        <button
          type="button"
          style={{
            padding: "7px 16px",
            borderRadius: 999,
            background: "linear-gradient(135deg, rgba(2, 132, 199, 0.4) 0%, rgba(37, 99, 235, 0.3) 100%)",
            color: "#38bdf8",
            border: "1px solid rgba(56, 189, 248, 0.5)",
            fontSize: "0.8rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Track Progress
        </button>
      </div>

      <SampleTrackerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lang={lang}
      />
    </>
  );
}
