"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

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
    if (score <= 1) return { label: "Weak", color: "#ef4444", percent: 20 };
    if (score === 2) return { label: "Fair", color: "#f59e0b", percent: 40 };
    if (score === 3) return { label: "Good", color: "#eab308", percent: 60 };
    if (score === 4) return { label: "Strong", color: "#22c55e", percent: 80 };
    return { label: "Very Strong", color: "#059669", percent: 100 };
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
      let url: string;
      let body: Record<string, string>;

      if (mode === "token" && token) {
        url = "/api/auth/reset-password";
        body = { token, new_password: newPassword, confirm_password: confirmPassword };
      } else {
        if (!email.trim()) { setError("Please enter your email"); setLoading(false); return; }
        if (!otpCode.trim() || otpCode.length !== 6) { setError("Please enter the 6-digit OTP code"); setLoading(false); return; }
        url = "/api/auth/verify-reset-otp";
        body = { email: email.trim().toLowerCase(), otp_code: otpCode.trim(), new_password: newPassword, confirm_password: confirmPassword };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to reset password");
      }
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="auth-page">
        <div className="card auth-card" style={{ maxWidth: 460, margin: "0 auto", padding: 40 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px", fontSize: "2.2rem",
              boxShadow: "0 8px 24px rgba(16, 185, 129, 0.3)"
            }}>
              ✅
            </div>
            <h2 style={{ color: "#1e293b", marginBottom: 8 }}>Password Reset Successful!</h2>
            <p style={{ color: "#64748b", fontSize: "0.92rem", lineHeight: 1.6, marginBottom: 28 }}>
              Your password has been updated. You can now log in with your new password.
            </p>

            <button
              onClick={() => router.push("/auth/login")}
              className="btn btn-primary btn-full btn-lg"
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                borderRadius: 10, fontWeight: 700, padding: "14px 0",
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
              }}
            >
              🔓 Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card auth-card" style={{ maxWidth: 480, margin: "0 auto", padding: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", fontSize: "2rem",
            boxShadow: "0 8px 24px rgba(2, 132, 199, 0.25)"
          }}>
            🔑
          </div>
          <h2 style={{ color: "#1e293b", marginBottom: 6 }}>Reset Your Password</h2>
          <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
            {mode === "token" ? "Set your new password below." : "Enter the 6-digit code sent to your email and choose a new password."}
          </p>
        </div>

        {/* Mode toggle (only show when no token in URL) */}
        {!token && (
          <div style={{
            display: "flex", borderRadius: 10, overflow: "hidden",
            border: "1px solid #e2e8f0", marginBottom: 20
          }}>
            <button
              onClick={() => setMode("otp")}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: "0.82rem",
                background: mode === "otp" ? "linear-gradient(135deg, #0284c7, #0369a1)" : "white",
                color: mode === "otp" ? "white" : "#64748b",
                transition: "all 0.2s"
              }}
            >
              🔢 Enter OTP Code
            </button>
            <button
              onClick={() => setMode("token")}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: "0.82rem",
                background: mode === "token" ? "linear-gradient(135deg, #0284c7, #0369a1)" : "white",
                color: mode === "token" ? "white" : "#64748b",
                transition: "all 0.2s"
              }}
            >
              🔗 Paste Reset Link Token
            </button>
          </div>
        )}

        {error && (
          <div style={{
            textAlign: "center", marginBottom: 16, fontSize: "0.88rem",
            padding: 12, background: "#fef2f2", borderRadius: 8,
            color: "#dc2626", border: "1px solid #fecaca"
          }}>
            {error}
          </div>
        )}

        {/* OTP Mode Fields */}
        {mode === "otp" && (
          <>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ fontSize: "0.95rem", padding: "12px 16px" }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>6-Digit OTP Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter 6-digit code from email"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{
                  fontSize: "1.5rem", fontWeight: 800, letterSpacing: "8px",
                  textAlign: "center", padding: "14px 16px",
                  fontFamily: "'Courier New', monospace",
                  background: "#f8fafc",
                }}
              />
            </div>
          </>
        )}

        {/* Token Mode Field */}
        {mode === "token" && !token && (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Reset Token (from email link)</label>
            <textarea
              className="form-input"
              placeholder="Paste the token from your email reset link here..."
              rows={3}
              style={{ fontSize: "0.8rem", fontFamily: "monospace", resize: "none" }}
            />
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>
              💡 Tip: It&apos;s easier to just click the reset button directly in your email
            </p>
          </div>
        )}

        {/* Auto token info */}
        {token && (
          <div style={{
            padding: 12, background: "#ecfdf5", borderRadius: 8,
            border: "1px solid #a7f3d0", marginBottom: 14,
            fontSize: "0.82rem", color: "#065f46"
          }}>
            ✅ Reset token auto-detected from email link
          </div>
        )}

        {/* New Password */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label" style={{ fontWeight: 600 }}>New Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="Minimum 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ fontSize: "0.95rem", padding: "12px 16px" }}
          />
          {newPassword.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{
                height: 4, borderRadius: 4, background: "#e2e8f0",
                overflow: "hidden", marginBottom: 4
              }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  width: `${strength.percent}%`,
                  background: strength.color,
                  transition: "all 0.3s ease"
                }} />
              </div>
              <span style={{ fontSize: "0.72rem", color: strength.color, fontWeight: 600 }}>
                {strength.label}
              </span>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="form-group" style={{ marginBottom: 24 }}>
          <label className="form-label" style={{ fontWeight: 600 }}>Confirm New Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{
              fontSize: "0.95rem", padding: "12px 16px",
              borderColor: passwordsMatch ? "#22c55e" : passwordsMismatch ? "#ef4444" : undefined,
            }}
          />
          {passwordsMatch && (
            <span style={{ fontSize: "0.75rem", color: "#22c55e", fontWeight: 600, marginTop: 4, display: "block" }}>
              ✅ Passwords match
            </span>
          )}
          {passwordsMismatch && (
            <span style={{ fontSize: "0.75rem", color: "#ef4444", fontWeight: 600, marginTop: 4, display: "block" }}>
              ❌ Passwords do not match
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="btn btn-primary btn-full btn-lg"
          disabled={loading || !newPassword || !confirmPassword || passwordsMismatch}
          style={{
            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
            borderRadius: 10, fontWeight: 700, padding: "14px 0",
            boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
            opacity: loading || !newPassword || !confirmPassword || passwordsMismatch ? 0.6 : 1,
          }}
        >
          {loading ? "Resetting..." : "🔒 Reset Password"}
        </button>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/auth/forgot-password" style={{ fontSize: "0.82rem", color: "#0284c7", fontWeight: 600 }}>
            Request a new code
          </a>
          <span style={{ margin: "0 10px", color: "#cbd5e1" }}>|</span>
          <a href="/auth/login" style={{ fontSize: "0.82rem", color: "#64748b" }}>
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="card auth-card" style={{ maxWidth: 460, margin: "0 auto", padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔑</div>
          <p style={{ color: "#64748b" }}>Loading reset form...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
