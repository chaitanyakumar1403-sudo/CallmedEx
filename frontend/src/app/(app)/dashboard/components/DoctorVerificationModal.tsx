"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  RefreshCw,
} from "lucide-react";
import { formatDoctorName, prescriberRegNumber } from "@/lib/prescriber";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  onVerificationSuccess?: () => void;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const getToken = () => typeof window !== "undefined" ? localStorage.getItem("token") : null;

/**
 * Credential status for the signed-in doctor. Every row reflects what is
 * actually on the profile — a missing value is shown as missing, never filled
 * with a sample name, number or clinic.
 */
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
  const regNumber = prescriberRegNumber(profile);
  const years = Number(profile?.years_of_experience) || 0;

  const rows: { title: string; ok: boolean; value: string; missing: string }[] = [
    {
      title: "Identity",
      ok: Boolean(profile?.full_name && profile?.mobile),
      value: [profile?.full_name ? formatDoctorName(profile.full_name) : "", profile?.mobile ? `Mobile ${profile.mobile}` : ""]
        .filter(Boolean)
        .join(" · "),
      missing: "Name or mobile number missing",
    },
    {
      title: "Medical council registration (NMC / state board)",
      ok: Boolean(regNumber),
      value: regNumber,
      missing: "Registration number not on file — add it in Doctor Profile",
    },
    {
      title: "Qualifications",
      ok: Boolean(profile?.qualification),
      value: [profile?.qualification, profile?.specialization, years > 0 ? `${years} years' experience` : ""]
        .filter(Boolean)
        .join(" · "),
      missing: "Qualification not on file",
    },
    {
      title: "Clinic or hospital",
      ok: Boolean(profile?.hospital_clinic_name),
      value: [profile?.hospital_clinic_name, profile?.city].filter(Boolean).join(", "),
      missing: "Practice location not on file",
    },
  ];

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
          text: "Verification passed. Your practitioner account is now active.",
          success: true,
        });
        if (onVerificationSuccess) {
          onVerificationSuccess();
        }
      } else {
        setResultMsg({
          text: data.message || "Your credentials are queued for manual review.",
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
      <div className="cm-verif-modal" role="dialog" aria-modal="true" aria-labelledby="cm-verif-title" onClick={(e) => e.stopPropagation()}>
        <div className="cm-verif-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: isVerified ? "rgba(34, 197, 94, 0.16)" : "rgba(234, 179, 8, 0.16)",
                border: isVerified ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid rgba(234, 179, 8, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isVerified ? "#4ade80" : "#fde047",
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3 id="cm-verif-title" style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                  Credentials &amp; verification
                </h3>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: 999,
                    fontSize: "11px",
                    fontWeight: 600,
                    background: isVerified ? "rgba(34, 197, 94, 0.2)" : "rgba(234, 179, 8, 0.2)",
                    color: isVerified ? "#4ade80" : "#fde047",
                    border: isVerified ? "1px solid rgba(34, 197, 94, 0.4)" : "1px solid rgba(234, 179, 8, 0.4)",
                  }}
                >
                  {isVerified ? "Verified" : "Pending verification"}
                </span>
              </div>
              <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                What CallMedex has on file for your practitioner account
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4, borderRadius: 6 }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="cm-verif-body">
          {resultMsg && (
            <div
              role="status"
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: "0.85rem",
                fontWeight: 600,
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

          {rows.map((r) => (
            <div key={r.title} className={`cm-verif-card ${r.ok ? "cm-verif-card--success" : "cm-verif-card--pending"}`}>
              <div style={{ color: r.ok ? "#4ade80" : "#facc15", marginTop: 2 }}>
                {r.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#f8fafc" }}>{r.title}</span>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: r.ok ? "#4ade80" : "#facc15", whiteSpace: "nowrap" }}>
                    {r.ok ? "On file" : "Missing"}
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#cbd5e1", marginTop: 4, overflowWrap: "anywhere" }}>
                  {r.ok ? r.value : r.missing}
                </div>
              </div>
            </div>
          ))}

          <div className={`cm-verif-card ${isVerified ? "cm-verif-card--success" : "cm-verif-card--pending"}`}>
            <div style={{ color: isVerified ? "#4ade80" : "#facc15", marginTop: 2 }}>
              {isVerified ? <CheckCircle2 size={18} /> : <Clock size={18} />}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "#f8fafc" }}>
                {isVerified ? "Verified by CallMedex" : "Awaiting verification"}
              </span>
              <p style={{ fontSize: "0.8rem", color: "#cbd5e1", margin: "6px 0 0", lineHeight: 1.45 }}>
                {isVerified
                  ? "Your credentials have been verified. You can accept walk-in, home-visit and online consultations."
                  : rows.every((r) => r.ok)
                  ? "Your details are complete. Run the verification check, or wait for manual review."
                  : "Complete the missing details in Doctor Profile, then run the verification check."}
              </p>
            </div>
          </div>
        </div>

        <div className="cm-verif-footer">
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            NMC registry · ABDM Health Professional Registry (HPR)
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
                  background: "#ffffff",
                  color: "var(--cm-navy)",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  cursor: runningCheck ? "not-allowed" : "pointer",
                }}
              >
                <RefreshCw size={14} className={runningCheck ? "animate-spin" : ""} />
                {runningCheck ? "Checking…" : "Run verification check"}
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
                fontSize: "13px",
                fontWeight: 600,
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
