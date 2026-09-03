"use client";
import { useState } from "react";
import Link from "next/link";
import { KeyRound, Mail, CheckCircle2, ArrowLeft, ShieldCheck } from "lucide-react";

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
      <div className="auth-page" style={{ background: "var(--cm-surface)", minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="cm-card" style={{ maxWidth: 460, width: "100%", padding: 40, border: "1px solid var(--cm-line)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "var(--cm-done-surface)", border: "1px solid var(--cm-done-line)",
              color: "var(--cm-done)",
              display: "grid", placeItems: "center",
              margin: "0 auto 20px",
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ color: "var(--cm-navy)", marginBottom: 8, fontSize: "var(--cm-text-xl)", fontWeight: 800 }}>Check Your Inbox</h2>
            <p style={{ color: "var(--cm-ink-2)", fontSize: "var(--cm-text-sm)", lineHeight: 1.6, marginBottom: 24 }}>
              We&apos;ve sent a <strong>6-digit verification code</strong> to<br />
              <span style={{ color: "var(--cm-active)", fontWeight: 700 }}>{email}</span>
            </p>

            <div style={{
              background: "var(--cm-surface-2)", borderRadius: "var(--cm-radius-sm)", padding: 20,
              border: "1px solid var(--cm-line)", marginBottom: 24, textAlign: "left"
            }}>
              <div style={{ fontWeight: 800, color: "var(--cm-navy)", fontSize: "var(--cm-text-xs)", marginBottom: 8 }}>Next Steps:</div>
              <ol style={{ margin: 0, paddingLeft: 20, color: "var(--cm-ink-2)", fontSize: "var(--cm-text-xs)", lineHeight: 1.8 }}>
                <li>Open your email inbox (check spam/junk folder too)</li>
                <li>Find the email from <strong>CallMedex Security</strong></li>
                <li>Copy the <strong>6-digit OTP code</strong> or click the reset button</li>
                <li>Enter your new password on the verification page</li>
              </ol>
            </div>

            <Link
              href={`/auth/reset-password?email=${encodeURIComponent(email)}`}
              className="cm-btn cm-btn--primary cm-btn--lg"
              style={{
                display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <KeyRound size={16} /> Enter OTP &amp; Reset Password
            </Link>

            <p style={{ marginTop: 20, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
              Didn&apos;t receive the email?{" "}
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                style={{ color: "var(--cm-active)", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: "var(--cm-text-xs)" }}
              >
                Try again
              </button>
            </p>

            <Link href="/auth/login" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", textDecoration: "none", fontWeight: 600 }}>
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ background: "var(--cm-surface)", minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="cm-card" style={{ maxWidth: 460, width: "100%", padding: 40, border: "1px solid var(--cm-line)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--cm-surface-2)", border: "1px solid var(--cm-line-strong)",
            color: "var(--cm-navy)",
            display: "grid", placeItems: "center",
            margin: "0 auto 16px",
          }}>
            <KeyRound size={28} />
          </div>
          <h2 style={{ color: "var(--cm-navy)", marginBottom: 6, fontSize: "var(--cm-text-xl)", fontWeight: 800 }}>Forgot Password?</h2>
          <p style={{ color: "var(--cm-ink-3)", fontSize: "var(--cm-text-xs)", lineHeight: 1.5 }}>
            Enter your registered email address and we&apos;ll send you a verification code to reset your password.
          </p>
        </div>

        {error && (
          <div style={{
            textAlign: "center", marginBottom: 16, fontSize: "var(--cm-text-xs)",
            padding: 12, background: "var(--cm-urgent-surface)", borderRadius: "var(--cm-radius-sm)",
            color: "var(--cm-urgent)", border: "1px solid var(--cm-urgent-line)"
          }}>
            {error}
          </div>
        )}

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label" style={{ fontWeight: 700, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink)", display: "block", marginBottom: 6 }}>Email Address</label>
          <input
            type="email"
            className="form-input"
            placeholder="Enter your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{ fontSize: "var(--cm-text-sm)", padding: "12px 16px", width: "100%", borderRadius: "var(--cm-radius-sm)", border: "1px solid var(--cm-line-strong)", boxSizing: "border-box" }}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="cm-btn cm-btn--primary cm-btn--lg"
          disabled={loading}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {loading ? "Sending..." : (
            <>
              <Mail size={16} /> Send Reset Code
            </>
          )}
        </button>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
          Remember your password?{" "}
          <Link href="/auth/login" style={{ color: "var(--cm-active)", fontWeight: 700, textDecoration: "none" }}>Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
