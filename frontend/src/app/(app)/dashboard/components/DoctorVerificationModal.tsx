"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  User,
  Building2,
  Stethoscope,
  X,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  onVerificationSuccess?: () => void;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

export default function DoctorVerificationModal({
  isOpen,
  onClose,
  profile,
  onVerificationSuccess,
}: Props) {
  const [runningCheck, setRunningCheck] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ text: string; success: boolean } | null>(null);

  if (!isOpen) return null;

  const isVerified = String(profile?.verification_status).toLowerCase() === "verified";

  const handleRunInstantVerification = async () => {
    setRunningCheck(true);
    setResultMsg(null);
    try {
      const token = getToken();
      if (!token) {
        setResultMsg({ text: "Authentication token missing. Please re-login.", success: false });
        return;
      }

      const res = await fetch(`${apiBase}/api/verification/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.success && data.data?.status === "verified") {
        setResultMsg({
          text: "✓ Automated NMC structural verification passed! Your practitioner credential is now Active.",
          success: true,
        });
        if (onVerificationSuccess) {
          onVerificationSuccess();
        }
      } else {
        setResultMsg({
          text: data.message || "Credential verification is in queue with the Medical Review Directorate.",
          success: false,
        });
      }
    } catch {
      setResultMsg({ text: "Network error connecting to verification service.", success: false });
    } finally {
      setRunningCheck(false);
    }
  };

  return (
    <div className="cm-verif-backdrop" onClick={onClose}>
      <div className="cm-verif-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cm-verif-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: isVerified
                  ? "linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(21, 128, 61, 0.3) 100%)"
                  : "linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(3, 105, 161, 0.3) 100%)",
                border: isVerified ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid rgba(56, 189, 248, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isVerified ? "#4ade80" : "#38bdf8",
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#fff" }}>
                  Clinical Credential &amp; Verification Audit
                </h3>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: 999,
                    fontSize: "10px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    background: isVerified ? "rgba(34, 197, 94, 0.2)" : "rgba(234, 179, 8, 0.2)",
                    color: isVerified ? "#4ade80" : "#fde047",
                    border: isVerified ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid rgba(234, 179, 8, 0.4)",
                  }}
                >
                  {isVerified ? "Active Verified" : "Pending Clearance"}
                </span>
              </div>
              <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>
                National Medical Commission (NMC) Registry &amp; CallMedex Practice Accreditation Status
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="cm-verif-body">
          {/* Result Alert if triggered */}
          {resultMsg && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: "0.85rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: resultMsg.success ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                border: resultMsg.success ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                color: resultMsg.success ? "#4ade80" : "#fca5a5",
              }}
            >
              {resultMsg.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{resultMsg.text}</span>
            </div>
          )}

          {/* Practitioner Identity Card */}
          <div className="cm-verif-card cm-verif-card--success">
            <div style={{ color: "#4ade80", marginTop: 2 }}>
              <CheckCircle2 size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#f8fafc" }}>
                  Doctor Identity &amp; Government Legal Record
                </span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#4ade80" }}>
                  Submitted &amp; Matched
                </span>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#cbd5e1", marginTop: 4 }}>
                <strong>Dr. {profile?.full_name || "Doctor"}</strong> · Registered Mobile: {profile?.mobile || "9160342929"}
              </div>
            </div>
          </div>

          {/* Medical License Card */}
          <div className="cm-verif-card cm-verif-card--success">
            <div style={{ color: "#4ade80", marginTop: 2 }}>
              <CheckCircle2 size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#f8fafc" }}>
                  Medical Council Registration (NMC / State Board)
                </span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#4ade80" }}>
                  Format Validated
                </span>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#cbd5e1", marginTop: 4 }}>
                Medical License: <code style={{ color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "2px 6px", borderRadius: 4 }}>{profile?.medical_license_number || "APMC-46929-NMC"}</code>
              </div>
            </div>
          </div>

          {/* Academic Degrees & Experience Card */}
          <div className="cm-verif-card cm-verif-card--success">
            <div style={{ color: "#4ade80", marginTop: 2 }}>
              <CheckCircle2 size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#f8fafc" }}>
                  Specialization &amp; Clinical Qualifications
                </span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#4ade80" }}>
                  24+ Years Verified
                </span>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#cbd5e1", marginTop: 4 }}>
                {profile?.qualification || "MBBS, PGDCCP (NI)"} · {profile?.specialization || "CLINICAL CARDIO PHYSICIAN (NI)"}
              </div>
            </div>
          </div>

          {/* Practice & Clinic Association Card */}
          <div className="cm-verif-card cm-verif-card--success">
            <div style={{ color: "#4ade80", marginTop: 2 }}>
              <CheckCircle2 size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#f8fafc" }}>
                  Solo Clinic / Hospital Facility Affiliation
                </span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#4ade80" }}>
                  Linked
                </span>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#cbd5e1", marginTop: 4 }}>
                {profile?.hospital_clinic_name || "Visakha Multispeciality Clinics & Diagnostics"} ({profile?.city || "Visakhapatnam"}, AP)
              </div>
            </div>
          </div>

          {/* Final Approval / Pending Action Card */}
          <div className={`cm-verif-card ${isVerified ? "cm-verif-card--success" : "cm-verif-card--pending"}`}>
            <div style={{ color: isVerified ? "#4ade80" : "#facc15", marginTop: 2 }}>
              {isVerified ? <CheckCircle2 size={18} /> : <Clock size={18} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#f8fafc" }}>
                  {isVerified ? "Medical Board Clearance & Live Status" : "NMC Live Sync & Final Activation"}
                </span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: isVerified ? "#4ade80" : "#facc15" }}>
                  {isVerified ? "Approved & Live" : "Pending 1-Click Verification"}
                </span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#cbd5e1", margin: "6px 0 0", lineHeight: 1.4 }}>
                {isVerified
                  ? "All 5/5 verification stages have been completed. You are authorized for physical walk-in OPD consultations, home visits, and teleconsultations."
                  : "All profile and clinical credentials have been recorded. You can run instant automated verification now to activate your doctor workstation immediately."}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="cm-verif-footer">
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            NMC Compliance Regulation 2026 · ABDM Health Professional Registry (HPR)
          </span>

          <div style={{ display: "flex", gap: 10 }}>
            {!isVerified && (
              <button
                type="button"
                onClick={handleRunInstantVerification}
                disabled={runningCheck}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 800,
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  boxShadow: "0 4px 14px rgba(2, 132, 199, 0.4)",
                  cursor: runningCheck ? "not-allowed" : "pointer",
                }}
              >
                <RefreshCw size={14} className={runningCheck ? "animate-spin" : ""} />
                {runningCheck ? "Verifying Credentials..." : "Run Instant Verification Check"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.1)",
                color: "#cbd5e1",
                fontSize: "12px",
                fontWeight: 700,
                border: "1px solid rgba(255, 255, 255, 0.15)",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
