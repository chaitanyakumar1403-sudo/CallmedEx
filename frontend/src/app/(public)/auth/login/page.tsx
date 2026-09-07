"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  HeartPulse,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ArrowRight,
  Lock,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import Clinical3DIcon from "@/components/ui/Clinical3DIcon";
import { storeSession } from "@/lib/sessionKeeper";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>, roleOverride?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");

    const email = emailRef.current?.value || "";
    const password = passwordRef.current?.value || "";

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const bodyPayload: any = { email, password };
      if (roleOverride) {
        bodyPayload.role = roleOverride;
      }
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const rawText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(rawText && rawText.length < 300 ? rawText : `Server returned ${res.status} ${res.statusText}`);
      }

      if (!res.ok) {
        const errorMsg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        throw new Error(errorMsg || "Login failed");
      }

      // storeSession persists data.token and data.refresh_token
      storeSession(data);

      const role = data.user.role;
      const slug = role === "processing_center" ? "processing-center" : role;
      router.push(`/dashboard/${slug}`);
    } catch (err: unknown) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        background:
          "radial-gradient(circle at 82% 28%, rgba(2, 132, 199, 0.12) 0%, transparent 45%), radial-gradient(circle at 18% 72%, rgba(56, 189, 248, 0.08) 0%, transparent 40%), var(--cm-surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 16px",
        color: "var(--cm-ink)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1160px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "48px",
          alignItems: "center",
        }}
      >
        {/* Left: Brand Value Showcase */}
        <div style={{ padding: "8px 12px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: "999px",
              background: "var(--cm-active-surface)",
              border: "1px solid var(--cm-active-line)",
              color: "var(--cm-active)",
              fontSize: "var(--cm-text-xs)",
              fontWeight: 700,
              marginBottom: 20,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            <ShieldCheck size={14} /> Verified Healthcare Platform
          </div>

          <h1
            style={{
              fontSize: "clamp(2rem, 3.5vw, 2.75rem)",
              fontWeight: 900,
              lineHeight: 1.15,
              marginBottom: 16,
              letterSpacing: "-0.02em",
              color: "var(--cm-navy)",
            }}
          >
            Clinical Precision,
            <br />
            <span style={{ color: "var(--cm-active)" }}>
              Unified &amp; Instant.
            </span>
          </h1>

          <p style={{ fontSize: "var(--cm-text-base)", color: "var(--cm-ink-2)", lineHeight: 1.6, marginBottom: 28, maxWidth: "480px" }}>
            Access verified doctor teleconsultations, Rapido-style doorstep phlebotomist dispatch, ABHA health records, and clinical command stations.
          </p>

          {/* Feature Badges */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "transparent", display: "grid", placeItems: "center" }}>
                <Clinical3DIcon name="video" size={36} glow />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>Instant Telemedicine Consultations</div>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Live AI Scribe summaries and digital e-Prescriptions</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "transparent", display: "grid", placeItems: "center" }}>
                <Clinical3DIcon name="delivery" size={36} glow />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>Doorstep Dispatch Radar</div>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Home doctor, nurse, physio &amp; NABL sample collection</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "transparent", display: "grid", placeItems: "center" }}>
                <Clinical3DIcon name="shield" size={36} glow />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>Verified Clinical Network</div>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>ABHA-linked health records with NABL accredited diagnostics</div>
              </div>
            </div>
          </div>

          {/* Enterprise Security & Regulatory Assurance */}
          <div style={{ borderTop: "1px solid var(--cm-line)", paddingTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Sparkles size={16} style={{ color: "var(--cm-active)" }} />
              <span style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-active)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Enterprise Clinical Grade Infrastructure
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "var(--cm-surface-2)",
                  border: "1px solid var(--cm-line)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <CheckCircle2 size={16} style={{ color: "#22c55e", flexShrink: 0 }} />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--cm-ink)" }}>
                  ABDM &amp; FHIR R4 Compliant
                </span>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "var(--cm-surface-2)",
                  border: "1px solid var(--cm-line)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <ShieldCheck size={16} style={{ color: "var(--cm-active)", flexShrink: 0 }} />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--cm-ink)" }}>
                  256-Bit Encrypted Gateway
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Glassmorphic Login Card */}
        <div>
          <div className="cm-login-glass-card">
            {/* Top Cyan Accent Stripe */}
            <div className="cm-login-glass-stripe" />

            <div style={{ padding: "38px 34px" }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                {/* 3D Glassmorphic Heart Logo Pod */}
                <div className="cm-login-glass-heart">
                  <HeartPulse size={34} className="cm-login-glass-heart-icon" />
                </div>
                <h2
                  style={{
                    fontSize: "var(--cm-text-xl)",
                    fontWeight: 800,
                    color: "#ffffff",
                    margin: "0 0 6px 0",
                    letterSpacing: "-0.01em",
                    textShadow: "0 2px 10px rgba(0, 0, 0, 0.4)",
                  }}
                >
                  Welcome to CallMedex
                </h2>
                <p style={{ fontSize: "var(--cm-text-xs)", color: "#94a3b8", margin: 0 }}>
                  Enter your credentials to access your Command Center
                </p>
              </div>

              {error && (
                <div
                  style={{
                    textAlign: "left",
                    marginBottom: 20,
                    fontSize: "var(--cm-text-xs)",
                    padding: "12px 14px",
                    background: "rgba(239, 68, 68, 0.18)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    color: "#fca5a5",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Lock size={16} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 18 }}>
                  <label
                    htmlFor="login-email"
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#cbd5e1",
                      marginBottom: 6,
                    }}
                  >
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    ref={emailRef}
                    name="email"
                    type="email"
                    placeholder="you@callmedex.in"
                    required
                    className="cm-login-glass-input"
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label
                      htmlFor="login-password"
                      style={{ fontSize: "12px", fontWeight: 700, color: "#cbd5e1" }}
                    >
                      Password
                    </label>
                    <Link
                      href="/auth/forgot-password"
                      style={{ fontSize: "12px", color: "#38bdf8", textDecoration: "none", fontWeight: 700 }}
                    >
                      Forgot Password?
                    </Link>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      id="login-password"
                      ref={passwordRef}
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your account password"
                      required
                      className="cm-login-glass-input"
                      style={{ paddingRight: "44px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#94a3b8",
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", marginBottom: 24, fontSize: "12px", color: "#94a3b8" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      defaultChecked
                      style={{ accentColor: "#0284c7", width: 16, height: 16, borderRadius: 4 }}
                    />
                    Stay signed in for 30 days
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="cm-login-glass-btn"
                >
                  {loading ? (
                    "Authenticating..."
                  ) : (
                    <>
                      Sign In to Command Center <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <div
                style={{
                  textAlign: "center",
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                  fontSize: "12px",
                  color: "#94a3b8",
                }}
              >
                New healthcare provider or patient?{" "}
                <Link
                  href="/auth/signup"
                  style={{ color: "#38bdf8", fontWeight: 700, textDecoration: "none" }}
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
