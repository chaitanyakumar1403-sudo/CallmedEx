"use client";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to send reset code");
      }
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
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
              ✉️
            </div>
            <h2 style={{ color: "#1e293b", marginBottom: 8 }}>Check Your Email</h2>
            <p style={{ color: "#64748b", fontSize: "0.92rem", lineHeight: 1.6, marginBottom: 24 }}>
              We&apos;ve sent a <strong>6-digit verification code</strong> to<br />
              <span style={{ color: "#0284c7", fontWeight: 700 }}>{email}</span>
            </p>

            <div style={{
              background: "#f0f9ff", borderRadius: 12, padding: 20,
              border: "1px solid #bae6fd", marginBottom: 24, textAlign: "left"
            }}>
              <div style={{ fontWeight: 700, color: "#0369a1", fontSize: "0.85rem", marginBottom: 8 }}>📋 What to do next:</div>
              <ol style={{ margin: 0, paddingLeft: 20, color: "#475569", fontSize: "0.83rem", lineHeight: 1.8 }}>
                <li>Open your email inbox (check spam/junk too)</li>
                <li>Find the email from <strong>CallMedex</strong></li>
                <li>Copy the <strong>6-digit OTP code</strong> or click the reset button</li>
                <li>Enter your new password on the reset page</li>
              </ol>
            </div>

            <a
              href={`/auth/reset-password?email=${encodeURIComponent(email)}`}
              style={{
                display: "inline-block", width: "100%", padding: "14px 0",
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "white", borderRadius: 10, fontWeight: 700,
                textDecoration: "none", fontSize: "0.95rem",
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                textAlign: "center",
              }}
            >
              🔑 Enter OTP & Reset Password
            </a>

            <p style={{ marginTop: 20, fontSize: "0.82rem", color: "#94a3b8" }}>
              Didn&apos;t receive the email?{" "}
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                style={{ color: "#0284c7", fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontSize: "0.82rem" }}
              >
                Try again
              </button>
            </p>

            <a href="/auth/login" style={{ display: "block", marginTop: 12, fontSize: "0.85rem", color: "#64748b" }}>
              ← Back to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card auth-card" style={{ maxWidth: 460, margin: "0 auto", padding: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", fontSize: "2rem",
            boxShadow: "0 8px 24px rgba(2, 132, 199, 0.25)"
          }}>
            🔐
          </div>
          <h2 style={{ color: "#1e293b", marginBottom: 6 }}>Forgot Password?</h2>
          <p style={{ color: "#64748b", fontSize: "0.88rem", lineHeight: 1.5 }}>
            Enter your registered email address and we&apos;ll send you a verification code to reset your password.
          </p>
        </div>

        {error && (
          <div style={{
            textAlign: "center", marginBottom: 16, fontSize: "0.88rem",
            padding: 12, background: "#fef2f2", borderRadius: 8,
            color: "#dc2626", border: "1px solid #fecaca"
          }}>
            {error}
          </div>
        )}

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label" style={{ fontWeight: 600 }}>Email Address</label>
          <input
            type="email"
            className="form-input"
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{ fontSize: "0.95rem", padding: "12px 16px" }}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="btn btn-primary btn-full btn-lg"
          disabled={loading}
          style={{
            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
            borderRadius: 10, fontWeight: 700, padding: "14px 0",
            boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
          }}
        >
          {loading ? "Sending..." : "📧 Send Reset Code"}
        </button>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: "0.88rem", color: "#64748b" }}>
          Remember your password?{" "}
          <a href="/auth/login" style={{ color: "var(--color-navy)", fontWeight: 600 }}>Back to Login</a>
        </p>
      </div>
    </div>
  );
}
