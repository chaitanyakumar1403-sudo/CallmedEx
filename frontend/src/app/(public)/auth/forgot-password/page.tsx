"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, CheckCircle2, ArrowLeft, ShieldCheck, Lock, Eye, EyeOff, RotateCcw } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp" | "success">("email");
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  // Password strength calculation
  const getPasswordStrength = (pw: string) => {
    if (!pw) return { label: "", color: "#cbd5e1", percent: 0 };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: "Weak", color: "var(--cm-urgent, #ef4444)", percent: 20 };
    if (score === 2) return { label: "Fair", color: "#f59e0b", percent: 40 };
    if (score === 3) return { label: "Good", color: "var(--cm-active, #0284c7)", percent: 60 };
    if (score === 4) return { label: "Strong", color: "var(--cm-done, #10b981)", percent: 80 };
    return { label: "Very Strong", color: "#059669", percent: 100 };
  };

  const strength = getPasswordStrength(newPassword);

  // Step 1: Send OTP
  const handleRequestOTP = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    setError("");
    setInfoMsg("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to send verification code");
      }
      if (data.data?.user_name) {
        setUserName(data.data.user_name);
      }
      setStep("otp");
      setInfoMsg("Verification code dispatched! Please check your inbox (and spam folder).");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setResending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to resend code");
      }
      setInfoMsg("A fresh 6-digit verification code has been sent!");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  // Step 2: Verify OTP & Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError("Please enter the complete 6-digit verification code");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");
    setInfoMsg("");
    try {
      const res = await fetch("/api/auth/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp_code: otpCode.trim(),
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to reset password. Please check your OTP.");
      }
      setStep("success");
      setTimeout(() => {
        router.push("/auth/login");
      }, 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ background: "var(--cm-surface, #f8fafc)", minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="cm-card" style={{ maxWidth: 480, width: "100%", padding: 36, border: "1px solid var(--cm-line, #e2e8f0)", borderRadius: 16, background: "#ffffff", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}>
        
        {/* Step 1: Request Email */}
        {step === "email" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "#eff6ff", border: "1px solid #bfdbfe",
                color: "#1d4ed8",
                display: "grid", placeItems: "center",
                margin: "0 auto 16px",
              }}>
                <KeyRound size={28} />
              </div>
              <h2 style={{ color: "#0f172a", marginBottom: 6, fontSize: "1.35rem", fontWeight: 800 }}>Forgot Password?</h2>
              <p style={{ color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5, margin: 0 }}>
                Enter your registered CallMedex email address and we&apos;ll dispatch a secure verification code to reset your credentials.
              </p>
            </div>

            {error && (
              <div style={{
                marginBottom: 16, fontSize: "0.82rem", padding: 12,
                background: "#fef2f2", borderRadius: 8, color: "#b91c1c", border: "1px solid #fecaca", textAlign: "center"
              }}>
                {error}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: "0.82rem", color: "#1e293b", display: "block", marginBottom: 6 }}>
                Registered Email Address *
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. doctor@callmedex.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRequestOTP()}
                  style={{ fontSize: "0.9rem", padding: "12px 14px 12px 42px", width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  autoFocus
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestOTP}
              className="cm-btn cm-btn--primary cm-btn--lg"
              disabled={loading}
              style={{
                width: "100%", padding: "12px", borderRadius: 8, background: "#0284c7", color: "white", fontWeight: 700,
                border: "none", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontSize: "0.92rem", transition: "background 0.2s",
              }}
            >
              {loading ? "Dispatching Code..." : (
                <>
                  <Mail size={16} /> Send 6-Digit Reset Code
                </>
              )}
            </button>

            <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.82rem", color: "#64748b", margin: "24px 0 0" }}>
              Remember your password?{" "}
              <Link href="/auth/login" style={{ color: "#0284c7", fontWeight: 700, textDecoration: "none" }}>Back to Login</Link>
            </p>
          </div>
        )}

        {/* Step 2: In-place OTP & Password Reset */}
        {step === "otp" && (
          <form onSubmit={handleResetPassword}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{
                width: 58, height: 58, borderRadius: "50%",
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                color: "#15803d",
                display: "grid", placeItems: "center",
                margin: "0 auto 12px",
              }}>
                <ShieldCheck size={30} />
              </div>
              <h2 style={{ color: "#0f172a", marginBottom: 4, fontSize: "1.25rem", fontWeight: 800 }}>
                {userName ? `Hello, ${userName}` : "Verify & Reset Password"}
              </h2>
              <p style={{ color: "#64748b", fontSize: "0.8rem", lineHeight: 1.5, margin: 0 }}>
                Enter the 6-digit code sent to <strong style={{ color: "#0f172a" }}>{email}</strong>
              </p>
            </div>

            {infoMsg && (
              <div style={{
                marginBottom: 16, fontSize: "0.8rem", padding: "10px 14px",
                background: "#eff6ff", borderRadius: 8, color: "#1d4ed8", border: "1px solid #bfdbfe", textAlign: "center"
              }}>
                {infoMsg}
              </div>
            )}

            {error && (
              <div style={{
                marginBottom: 16, fontSize: "0.8rem", padding: "10px 14px",
                background: "#fef2f2", borderRadius: 8, color: "#b91c1c", border: "1px solid #fecaca", textAlign: "center"
              }}>
                {error}
              </div>
            )}

            {/* OTP Code Field */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: "0.8rem", color: "#1e293b", display: "block", marginBottom: 6 }}>
                6-Digit Verification Code *
              </label>
              <input
                type="text"
                maxLength={6}
                className="form-input"
                placeholder="• • • • • •"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{
                  fontSize: "1.4rem", fontWeight: 800, textAlign: "center", letterSpacing: "8px",
                  padding: "10px", width: "100%", borderRadius: 8, border: "2px solid #0284c7", boxSizing: "border-box",
                  color: "#0f172a", fontFamily: "monospace"
                }}
                autoFocus
                required
              />
            </div>

            {/* New Password */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: "0.8rem", color: "#1e293b", display: "block", marginBottom: 6 }}>
                New Password *
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  style={{ fontSize: "0.88rem", padding: "10px 38px 10px 36px", width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password strength bar */}
              {newPassword && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${strength.percent}%`, background: strength.color, transition: "width 0.3s, background 0.3s" }} />
                  </div>
                  <div style={{ fontSize: "0.72rem", color: strength.color, fontWeight: 700, marginTop: 4, textAlign: "right" }}>
                    Strength: {strength.label}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: "0.8rem", color: "#1e293b", display: "block", marginBottom: 6 }}>
                Confirm New Password *
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  style={{
                    fontSize: "0.88rem", padding: "10px 14px 10px 36px", width: "100%", borderRadius: 8,
                    border: confirmPassword && newPassword !== confirmPassword ? "1.5px solid #ef4444" : "1px solid #cbd5e1",
                    boxSizing: "border-box"
                  }}
                  required
                />
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <span style={{ fontSize: "0.72rem", color: "#ef4444", marginTop: 4, display: "block" }}>
                  Passwords do not match
                </span>
              )}
            </div>

            <button
              type="submit"
              className="cm-btn cm-btn--primary cm-btn--lg"
              disabled={loading || !otpCode || !newPassword || newPassword !== confirmPassword}
              style={{
                width: "100%", padding: "12px", borderRadius: 8, background: "#0284c7", color: "white", fontWeight: 700,
                border: "none", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontSize: "0.92rem", transition: "background 0.2s",
              }}
            >
              {loading ? "Securing Credentials..." : (
                <>
                  <KeyRound size={16} /> Reset &amp; Secure Account
                </>
              )}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, fontSize: "0.8rem" }}>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resending}
                style={{ background: "none", border: "none", color: "#0284c7", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              >
                <RotateCcw size={13} /> {resending ? "Resending..." : "Resend Code"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("email"); setError(""); setInfoMsg(""); setOtpCode(""); }}
                style={{ background: "none", border: "none", color: "#64748b", fontWeight: 600, cursor: "pointer" }}
              >
                Change Email
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Success Screen */}
        {step === "success" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "#f0fdf4", border: "2px solid #86efac",
              color: "#16a34a",
              display: "grid", placeItems: "center",
              margin: "0 auto 20px",
              boxShadow: "0 0 20px rgba(34, 197, 94, 0.2)"
            }}>
              <CheckCircle2 size={40} />
            </div>

            <h2 style={{ color: "#0f172a", marginBottom: 8, fontSize: "1.35rem", fontWeight: 800 }}>
              Password Reset Successfully!
            </h2>
            <p style={{ color: "#475569", fontSize: "0.88rem", lineHeight: 1.6, marginBottom: 24 }}>
              Your credentials have been securely updated. You can now access your CallMedex workstation.
            </p>

            <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#64748b" }}>
              <span className="cm-spinner" style={{ width: 14, height: 14, border: "2px solid #0284c7", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 1s linear infinite" }} />
              Redirecting to CallMedex Login...
            </div>

            <div style={{ marginTop: 24 }}>
              <Link
                href="/auth/login"
                className="cm-btn cm-btn--primary"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 24px",
                  borderRadius: 8, background: "#0284c7", color: "white", textDecoration: "none", fontWeight: 700, fontSize: "0.88rem"
                }}
              >
                Go to Login Now <ArrowLeft size={16} style={{ transform: "rotate(180deg)" }} />
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
