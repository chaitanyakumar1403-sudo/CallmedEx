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
  MapPin,
  CheckCircle2,
  Stethoscope,
  User,
  HeartHandshake,
  Apple,
  Activity,
  ArrowRight,
  Lock,
} from "lucide-react";
import Clinical3DIcon from "@/components/ui/Clinical3DIcon";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const setDemoAccount = (email: string) => {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = "Demo@123456";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const email = emailRef.current?.value || "";
    const password = passwordRef.current?.value || "";

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("token_expires_at", String(Date.now() + 60 * 60 * 1000));

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
        background: "var(--cm-surface)",
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
            <ShieldCheck size={14} /> Vizag Verified Healthcare Platform
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
                <Clinical3DIcon name="check" size={36} glow />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>80% Provider Remuneration Standard</div>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Transparent 80/20 revenue split as per official CallMedex MOUs</div>
              </div>
            </div>
          </div>

          {/* Quick Demo Fillers for testing */}
          <div style={{ borderTop: "1px solid var(--cm-line)", paddingTop: 18 }}>
            <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 12 }}>
              Quick Demo Accounts
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDemoAccount("doctor@callmedex.in")}
                className="cm-btn cm-btn--secondary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px" }}
              >
                <Clinical3DIcon name="stethoscope" size={20} /> Doctor
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount("patient@callmedex.in")}
                className="cm-btn cm-btn--secondary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px" }}
              >
                <Clinical3DIcon name="patient" size={20} /> Patient
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount("nurse@callmedex.in")}
                className="cm-btn cm-btn--secondary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px" }}
              >
                <Clinical3DIcon name="nurse" size={20} /> Nurse
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount("dietitian@callmedex.in")}
                className="cm-btn cm-btn--secondary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px" }}
              >
                <Clinical3DIcon name="dietitian" size={20} /> Dietitian
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount("physio@callmedex.in")}
                className="cm-btn cm-btn--secondary cm-btn--sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px" }}
              >
                <Clinical3DIcon name="physio" size={20} /> Physio
              </button>
            </div>
          </div>
        </div>

        {/* Right: Modern Clinical White Login Card */}
        <div>
          <div
            className="cm-card"
            style={{
              background: "var(--cm-surface)",
              borderRadius: "var(--cm-radius)",
              border: "1px solid var(--cm-line)",
              boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.07)",
              overflow: "hidden",
            }}
          >
            {/* Top Navy Accent Stripe */}
            <div
              style={{
                height: "4px",
                width: "100%",
                background: "var(--cm-navy)",
              }}
            />

            <div style={{ padding: "36px 32px" }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div
                  style={{
                    display: "inline-flex",
                    padding: 14,
                    borderRadius: "16px",
                    background: "var(--cm-surface-2)",
                    border: "1px solid var(--cm-line)",
                    color: "var(--cm-navy)",
                    marginBottom: 14,
                  }}
                >
                  <HeartPulse size={32} />
                </div>
                <h2 style={{ fontSize: "var(--cm-text-xl)", fontWeight: 800, color: "var(--cm-navy)", margin: "0 0 6px 0", letterSpacing: "-0.01em" }}>
                  Welcome to CallMedex
                </h2>
                <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", margin: 0 }}>
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
                    background: "var(--cm-urgent-surface)",
                    border: "1px solid var(--cm-urgent-line)",
                    color: "var(--cm-urgent)",
                    borderRadius: "var(--cm-radius-sm)",
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
                    style={{ display: "block", fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink)", marginBottom: 6 }}
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
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "var(--cm-radius-sm)",
                      background: "#ffffff",
                      border: "1px solid var(--cm-line-strong)",
                      color: "var(--cm-ink)",
                      fontSize: "var(--cm-text-sm)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label
                      htmlFor="login-password"
                      style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink)" }}
                    >
                      Password
                    </label>
                    <Link
                      href="/auth/forgot-password"
                      style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-active)", textDecoration: "none", fontWeight: 700 }}
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
                      style={{
                        width: "100%",
                        padding: "12px 44px 12px 14px",
                        borderRadius: "var(--cm-radius-sm)",
                        background: "#ffffff",
                        border: "1px solid var(--cm-line-strong)",
                        color: "var(--cm-ink)",
                        fontSize: "var(--cm-text-sm)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
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
                        color: "var(--cm-ink-3)",
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", marginBottom: 24, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      defaultChecked
                      style={{ accentColor: "var(--cm-active)", width: 16, height: 16, borderRadius: 4 }}
                    />
                    Stay signed in for 30 days
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="cm-btn cm-btn--primary cm-btn--lg"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
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
                  borderTop: "1px solid var(--cm-line)",
                  fontSize: "var(--cm-text-xs)",
                  color: "var(--cm-ink-3)",
                }}
              >
                New healthcare provider or patient?{" "}
                <Link
                  href="/auth/signup"
                  style={{ color: "var(--cm-active)", fontWeight: 700, textDecoration: "none" }}
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
