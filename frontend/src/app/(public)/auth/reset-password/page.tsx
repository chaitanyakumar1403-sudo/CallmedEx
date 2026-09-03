"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Lock, CheckCircle2, AlertCircle, LogIn, Link2 } from "lucide-react";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const emailParam = searchParams.get("email") || "";

  const [mode, setMode] = useState<"otp" | "token">(token ? "token" : "otp");
  const [email, setEmail] = useState(emailParam);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Password strength
  const getPasswordStrength = (pw: string): { label: string; color: string; percent: number } => {
    if (pw.length === 0) return { label: "", color: "#e2e8f0", percent: 0 };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: "Weak", color: "var(--cm-urgent)", percent: 20 };
    if (score === 2) return { label: "Fair", color: "var(--cm-waiting)", percent: 40 };
    if (score === 3) return { label: "Good", color: "var(--cm-active)", percent: 60 };
    if (score === 4) return { label: "Strong", color: "var(--cm-done)", percent: 80 };
    return { label: "Very Strong", color: "var(--cm-done)", percent: 100 };
  };

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async () => {
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (mode === "otp") {
        if (!email.trim() || !otpCode.trim()) {
          setError("Please enter your email and 6-digit OTP code");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/auth/reset-password-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            otp_code: otpCode.trim(),
            new_password: newPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Failed to reset password");
        }
      } else {
        const resetToken = token || (document.querySelector("textarea") as HTMLTextAreaElement)?.value?.trim();
        if (!resetToken) {
          setError("Please provide the reset token");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: resetToken,
            new_password: newPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Failed to reset password");
        }
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/auth/login");
      }, 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page" style={{ background: "var(--cm-surface)", minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="cm-card" style={{ maxWidth: 460, width: "100%", padding: 40, textAlign: "center", border: "1px solid var(--cm-line)" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "var(--cm-done-surface)", border: "1px solid var(--cm-done-line)",
            color: "var(--cm-done)",
            display: "grid", placeItems: "center",
            margin: "0 auto 20px",
          }}>
            <CheckCircle2 size={36} />
          </div>
          <h2 style={{ color: "var(--cm-navy)", marginBottom: 8, fontSize: "var(--cm-text-xl)", fontWeight: 800 }}>Password Reset Successfully!</h2>
          <p style={{ color: "var(--cm-ink-2)", fontSize: "var(--cm-text-sm)", lineHeight: 1.5, marginBottom: 24 }}>
            Your account password has been updated. You will be redirected to the login screen automatically in 3 seconds.
          </p>
          <Link
            href="/auth/login"
            className="cm-btn cm-btn--primary cm-btn--lg"
            style={{
              display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <LogIn size={16} /> Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ background: "var(--cm-surface)", minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="cm-card" style={{ maxWidth: 480, width: "100%", padding: 40, border: "1px solid var(--cm-line)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--cm-surface-2)", border: "1px solid var(--cm-line-strong)",
            color: "var(--cm-navy)",
            display: "grid", placeItems: "center",
            margin: "0 auto 16px",
          }}>
            <KeyRound size={28} />
          </div>
          <h2 style={{ color: "var(--cm-navy)", marginBottom: 6, fontSize: "var(--cm-text-xl)", fontWeight: 800 }}>Reset Your Password</h2>
          <p style={{ color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)" }}>
            {mode === "token" ? "Set your new password below." : "Enter the 6-digit code sent to your email and choose a new password."}
          </p>
        </div>

        {/* Mode toggle (only show when no token in URL) */}
        {!token && (
          <div style={{
            display: "flex", borderRadius: "var(--cm-radius-sm)", overflow: "hidden",
            border: "1px solid var(--cm-line-strong)", marginBottom: 20
          }}>
            <button
              onClick={() => setMode("otp")}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: "var(--cm-text-xs)",
                background: mode === "otp" ? "var(--cm-navy)" : "white",
                color: mode === "otp" ? "white" : "var(--cm-ink-3)",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "all 0.2s"
              }}
            >
              <KeyRound size={14} /> Enter OTP Code
            </button>
            <button
              onClick={() => setMode("token")}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: "var(--cm-text-xs)",
                background: mode === "token" ? "var(--cm-navy)" : "white",
                color: mode === "token" ? "white" : "var(--cm-ink-3)",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "all 0.2s"
              }}
            >
              <Link2 size={14} /> Paste Reset Link Token
            </button>
          </div>
        )}

        {error && (
          <div style={{
            textAlign: "center", marginBottom: 16, fontSize: "var(--cm-text-xs)",
            padding: 12, background: "var(--cm-urgent-surface)", borderRadius: "var(--cm-radius-sm)",
            color: "var(--cm-urgent)", border: "1px solid var(--cm-urgent-line)"
          }}>
            {error}
          </div>
        )}

        {/* OTP Mode Fields */}
        {mode === "otp" && (
          <>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink)", display: "block", marginBottom: 6 }}>Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="Your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ fontSize: "var(--cm-text-sm)", padding: "10px 14px", width: "100%", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", boxSizing: "border-box" }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink)", display: "block", marginBottom: 6 }}>6-Digit OTP Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="123456"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                style={{
                  fontSize: "1.3rem", fontWeight: 800, textAlign: "center",
                  letterSpacing: "0.25em", padding: "10px 14px", fontFamily: "monospace",
                  width: "100%", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", boxSizing: "border-box"
                }}
              />
            </div>
          </>
        )}

        {/* Token Mode Field */}
        {mode === "token" && !token && (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink)", display: "block", marginBottom: 6 }}>Reset Token (from email link)</label>
            <textarea
              className="form-input"
              placeholder="Paste the token from your email reset link here..."
              rows={3}
              style={{ fontSize: "var(--cm-text-xs)", fontFamily: "monospace", resize: "none", width: "100%", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", boxSizing: "border-box", padding: 10 }}
            />
            <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", marginTop: 4 }}>
              Tip: It&apos;s easier to just click the reset button directly in your email
            </p>
          </div>
        )}

        {/* Auto token info */}
        {token && (
          <div style={{
            padding: 12, background: "var(--cm-done-surface)", borderRadius: "var(--cm-radius-sm)",
            border: "1px solid var(--cm-done-line)", marginBottom: 14,
            fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", display: "flex", alignItems: "center", gap: 6, fontWeight: 700
          }}>
            <CheckCircle2 size={14} /> Reset token auto-detected from email link
          </div>
        )}

        {/* New Password */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label" style={{ fontWeight: 700, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink)", display: "block", marginBottom: 6 }}>New Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="Minimum 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ fontSize: "var(--cm-text-sm)", padding: "10px 14px", width: "100%", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", boxSizing: "border-box" }}
          />
          {newPassword.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{
                height: 4, borderRadius: 4, background: "var(--cm-surface-2)",
                overflow: "hidden", marginBottom: 4
              }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  width: `${strength.percent}%`,
                  background: strength.color,
                  transition: "all 0.3s ease"
                }} />
              </div>
              <span style={{ fontSize: "0.72rem", color: strength.color, fontWeight: 700 }}>
                {strength.label}
              </span>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="form-group" style={{ marginBottom: 24 }}>
          <label className="form-label" style={{ fontWeight: 700, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink)", display: "block", marginBottom: 6 }}>Confirm New Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{
              fontSize: "var(--cm-text-sm)", padding: "10px 14px", width: "100%", borderRadius: "var(--cm-radius-sm)", boxSizing: "border-box",
              border: passwordsMatch ? "1px solid var(--cm-done)" : passwordsMismatch ? "1px solid var(--cm-urgent)" : "1px solid var(--cm-line-strong)",
            }}
          />
          {passwordsMatch && (
            <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={12} /> Passwords match
            </span>
          )}
          {passwordsMismatch && (
            <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-urgent)", fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <AlertCircle size={12} /> Passwords do not match
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="cm-btn cm-btn--primary cm-btn--lg"
          disabled={loading || !newPassword || !confirmPassword || passwordsMismatch}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: loading || !newPassword || !confirmPassword || passwordsMismatch ? 0.6 : 1,
          }}
        >
          {loading ? "Resetting..." : (
            <>
              <Lock size={16} /> Reset Password
            </>
          )}
        </button>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link href="/auth/forgot-password" style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-active)", fontWeight: 700, textDecoration: "none" }}>
            Request a new code
          </Link>
          <span style={{ margin: "0 10px", color: "var(--cm-line-strong)" }}>|</span>
          <Link href="/auth/login" style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", textDecoration: "none" }}>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="auth-page" style={{ background: "var(--cm-surface)", minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div className="cm-card" style={{ maxWidth: 460, margin: "0 auto", padding: 40, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--cm-surface-2)", color: "var(--cm-navy)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
            <KeyRound size={24} />
          </div>
          <p style={{ color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)" }}>Loading verification form...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
