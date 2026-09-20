"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  ShieldAlert,
  AlertTriangle,
  X,
  Mail,
  KeyRound,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Info,
} from "lucide-react";
import { authAPI } from "@/lib/api";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  userEmail?: string;
  userName?: string;
}

export default function DeleteAccountModal({
  isOpen,
  onClose,
  userRole = "User",
  userEmail = "",
  userName = "",
}: DeleteAccountModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"warning" | "otp" | "success">("warning");
  const [loading, setLoading] = useState(false);
  const [activeBookingError, setActiveBookingError] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [reason, setReason] = useState("");

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cooldown timer for OTP resend
  useEffect(() => {
    let interval: any;
    if (step === "otp" && resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendCooldown]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setStep("warning");
      setLoading(false);
      setActiveBookingError(null);
      setOtpDigits(["", "", "", "", "", ""]);
      setResendCooldown(60);
      setCanResend(false);
      setReason("");
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleRequestOTP = async () => {
    setLoading(true);
    setActiveBookingError(null);
    try {
      const res = await authAPI.requestAccountDeletionOTP();
      if (res.success) {
        setMaskedEmail(res.masked_email || userEmail || "your registered email");
        setStep("otp");
        setResendCooldown(60);
        setCanResend(false);
        toast.success("Security verification code sent to your registered email.");
        setTimeout(() => {
          otpInputsRef.current[0]?.focus();
        }, 150);
      }
    } catch (err: any) {
      const detail = err?.data?.detail || err?.message || "Failed to process request.";
      if (detail.toLowerCase().includes("active clinical") || detail.toLowerCase().includes("ongoing appointments")) {
        setActiveBookingError(detail);
      } else {
        toast.error(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const digit = val.slice(-1);
    if (!/^\d*$/.test(digit)) return;

    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);

    // Auto-advance to next input
    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasted)) {
      const chars = pasted.split("");
      setOtpDigits(chars);
      otpInputsRef.current[5]?.focus();
    }
  };

  const handleVerifyAndDelete = async () => {
    const fullOtp = otpDigits.join("");
    if (fullOtp.length !== 6) {
      toast.error("Please enter the complete 6-digit security code.");
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.verifyAccountDeletion(fullOtp, reason || undefined);
      if (res.success) {
        setStep("success");
        // Clear local storage & session state
        try {
          if (typeof window !== "undefined") {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            localStorage.removeItem("callmedex_auth");
            localStorage.removeItem("callmedex_patient_lang");
            sessionStorage.clear();
          }
        } catch {
          // ignore
        }

        toast.success("Account and associated clinical records successfully deleted.");

        // Clean redirect to public landing page
        setTimeout(() => {
          window.location.href = "/";
        }, 2200);
      }
    } catch (err: any) {
      const detail = err?.data?.detail || err?.message || "Invalid or expired verification code.";
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(5, 10, 25, 0.82)",
        backdropFilter: "blur(20px) saturate(190%)",
        WebkitBackdropFilter: "blur(20px) saturate(190%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading && step !== "success") {
          onClose();
        }
      }}
    >
      <style>{`
        @keyframes cmModalFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "linear-gradient(145deg, #090e1a 0%, #172554 45%, #1e3a8a 80%, #090e1a 100%)",
          borderRadius: 20,
          border: "1px solid rgba(59, 130, 246, 0.38)",
          boxShadow:
            "0 25px 60px -12px rgba(0, 0, 0, 0.85), 0 0 50px rgba(37, 99, 235, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.15)",
          color: "#f8fafc",
          overflow: "hidden",
          position: "relative",
          animation: "cmModalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* Subtle royal blue glow orb */}
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 180,
            height: 180,
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%)",
            filter: "blur(30px)",
            pointerEvents: "none",
          }}
        />

        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px 16px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(15, 23, 42, 0.45)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f87171",
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2
                id="delete-account-title"
                style={{
                  margin: 0,
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  color: "#ffffff",
                  letterSpacing: "-0.3px",
                }}
              >
                Delete CallMedex Account
              </h2>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#93c5fd",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  marginTop: 2,
                }}
              >
                {userRole.replace("_", " ")} Workspace · Permanent Action
              </div>
            </div>
          </div>

          {step !== "success" && (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
              }}
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24 }}>
          {/* ── STEP 1: WARNING & PRE-FLIGHT ── */}
          {step === "warning" && (
            <div>
              {/* Active booking block alert */}
              {activeBookingError && (
                <div
                  style={{
                    padding: 14,
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #ef4444",
                    borderRadius: 12,
                    marginBottom: 16,
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <AlertTriangle size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: "0.82rem", color: "#fca5a5", lineHeight: 1.4 }}>
                    <strong style={{ color: "#ffffff", display: "block", marginBottom: 3 }}>
                      Account Deletion Blocked
                    </strong>
                    {activeBookingError}
                  </div>
                </div>
              )}

              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#60a5fa",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Info size={15} />
                  What happens when you delete your account:
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    fontSize: "0.82rem",
                    color: "#cbd5e1",
                    lineHeight: 1.6,
                  }}
                >
                  <li>Your user profile, contact details, and login credentials will be permanently erased.</li>
                  <li>Medical history, prescriptions, diagnostic reports, and family circle links will be wiped.</li>
                  <li>Provider registrations, license documents, and verified badges will be irrevocably revoked.</li>
                  <li>You will immediately lose access to all CallMedex clinical tools and dashboards.</li>
                </ul>
              </div>

              {/* Safety notice pill */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  background: "rgba(30, 58, 138, 0.3)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  borderRadius: 10,
                  marginBottom: 22,
                }}
              >
                <KeyRound size={15} style={{ color: "#93c5fd" }} />
                <span style={{ fontSize: "0.78rem", color: "#bfdbfe" }}>
                  A 6-digit security code will be sent to your registered email to authenticate this action.
                </span>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 10,
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "transparent",
                    color: "#cbd5e1",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRequestOTP}
                  disabled={loading}
                  style={{
                    padding: "10px 22px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading ? "Verifying..." : "Send Verification Code"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: OTP VERIFICATION ── */}
          {step === "otp" && (
            <div>
              <div
                style={{
                  textAlign: "center",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(59, 130, 246, 0.2)",
                    border: "1px solid rgba(59, 130, 246, 0.4)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#60a5fa",
                    marginBottom: 10,
                  }}
                >
                  <Mail size={22} />
                </div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "1rem", fontWeight: 700, color: "#ffffff" }}>
                  Enter Security Verification Code
                </h3>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#94a3b8" }}>
                  A 6-digit code was sent to{" "}
                  <strong style={{ color: "#60a5fa" }}>{maskedEmail}</strong>
                </p>
              </div>

              {/* 6 Digit Input Cells */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "center",
                  margin: "24px 0",
                }}
                onPaste={handleOtpPaste}
              >
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpInputsRef.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    style={{
                      width: 44,
                      height: 52,
                      textAlign: "center",
                      fontSize: "1.4rem",
                      fontWeight: 800,
                      fontFamily: "'Courier New', Courier, monospace",
                      borderRadius: 10,
                      background: "rgba(15, 23, 42, 0.75)",
                      border: digit
                        ? "2px solid #3b82f6"
                        : "1px solid rgba(255, 255, 255, 0.2)",
                      color: "#60a5fa",
                      outline: "none",
                      boxShadow: digit ? "0 0 12px rgba(59, 130, 246, 0.4)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  />
                ))}
              </div>

              {/* Resend Cooldown */}
              <div
                style={{
                  textAlign: "center",
                  marginBottom: 20,
                  fontSize: "0.8rem",
                  color: "#94a3b8",
                }}
              >
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleRequestOTP}
                    disabled={loading}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#60a5fa",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <RefreshCw size={13} /> Resend Code
                  </button>
                ) : (
                  <span>
                    Resend code in <strong style={{ color: "#cbd5e1" }}>{resendCooldown}s</strong>
                  </span>
                )}
              </div>

              {/* Optional Reason Selector */}
              <div style={{ marginBottom: 24 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "#cbd5e1",
                    marginBottom: 6,
                  }}
                >
                  Reason for deleting (optional):
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "rgba(15, 23, 42, 0.65)",
                    border: "1px solid rgba(255, 255, 255, 0.18)",
                    borderRadius: 8,
                    color: "#f8fafc",
                    fontSize: "0.82rem",
                    outline: "none",
                  }}
                >
                  <option value="" style={{ background: "#0f172a" }}>Select a reason...</option>
                  <option value="No longer need services" style={{ background: "#0f172a" }}>No longer need services</option>
                  <option value="Privacy & data concerns" style={{ background: "#0f172a" }}>Privacy &amp; data concerns</option>
                  <option value="Switching to another healthcare provider" style={{ background: "#0f172a" }}>Switching to another provider</option>
                  <option value="Temporary account cleanup" style={{ background: "#0f172a" }}>Temporary account cleanup</option>
                  <option value="Other" style={{ background: "#0f172a" }}>Other reason</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setStep("warning")}
                  disabled={loading}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "transparent",
                    color: "#cbd5e1",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleVerifyAndDelete}
                  disabled={loading || otpDigits.join("").length !== 6}
                  style={{
                    padding: "10px 22px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                    color: "#ffffff",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: loading || otpDigits.join("").length !== 6 ? "not-allowed" : "pointer",
                    opacity: otpDigits.join("").length === 6 ? 1 : 0.6,
                    boxShadow: "0 4px 14px rgba(220, 38, 38, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading ? "Deleting Account..." : "Permanently Delete My Account"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: SUCCESS ── */}
          {step === "success" && (
            <div style={{ textAlign: "center", padding: "16px 0 10px 0" }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background: "rgba(34, 197, 94, 0.15)",
                  border: "2px solid #22c55e",
                  color: "#22c55e",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <CheckCircle2 size={30} />
              </div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "1.15rem", fontWeight: 800, color: "#ffffff" }}>
                Account Successfully Deleted
              </h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5 }}>
                Your CallMedex account, active credentials, and associated health data have been permanently erased.
                Redirecting you to the home page...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
