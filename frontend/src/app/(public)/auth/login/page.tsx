"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
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

/** Decode JWT payload to check expiry without verifying signature */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000;
    return Date.now() >= exp;
  } catch {
    return true;
  }
}

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
        background: "radial-gradient(ellipse at 20% 20%, #0c1a30 0%, #060b17 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        position: "relative",
        overflow: "hidden",
        color: "#f8fafc",
      }}
    >
      {/* Background ambient lighting orbs */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "5%",
          width: "420px",
          height: "420px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "5%",
          width: "480px",
          height: "480px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "1160px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "36px",
          alignItems: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Left: Brand Value Showcase */}
        <div style={{ padding: "16px 20px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: "999px",
              background: "rgba(14, 165, 233, 0.12)",
              border: "1px solid rgba(14, 165, 233, 0.3)",
              color: "#38bdf8",
              fontSize: "0.82rem",
              fontWeight: 700,
              marginBottom: 20,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            <ShieldCheck size={14} /> Vizag&apos;s #1 Healthcare Platform
          </div>

          <h1
            style={{
              fontSize: "clamp(2rem, 4vw, 2.85rem)",
              fontWeight: 900,
              lineHeight: 1.15,
              marginBottom: 16,
              letterSpacing: "-0.02em",
              background: "linear-gradient(135deg, #ffffff 30%, #94a3b8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Smart Healthcare,
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #38bdf8, #34d399)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Unified &amp; Instant.
            </span>
          </h1>

          <p style={{ fontSize: "1.05rem", color: "#94a3b8", lineHeight: 1.6, marginBottom: 28, maxWidth: "480px" }}>
            Access seamless teleconsultations, Rapido-style doorstep phlebotomy and nurse dispatch, ABHA records, and dedicated clinical command centers for doctors.
          </p>

          {/* Feature Badges */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: "8px", background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f1f5f9" }}>60-Second Instant Teleconsultations</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Live AI Scribe summaries and digital e-Prescriptions</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: "8px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MapPin size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f1f5f9" }}>Live Doorstep Dispatch Radar</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Home doctor, nurse, physio &amp; NABL sample collection</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: "8px", background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f1f5f9" }}>80% Provider Remuneration Standard</div>
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Transparent 80/20 revenue split as per official CallMedex MOUs</div>
              </div>
            </div>
          </div>

          {/* Quick Demo Fillers for testing */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16 }}>
            <div style={{ fontSize: "0.76rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 10 }}>
              Quick Demo Accounts
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={() => setDemoAccount("doctor@callmedex.in")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  background: "rgba(14, 165, 233, 0.12)",
                  border: "1px solid rgba(14, 165, 233, 0.25)",
                  color: "#38bdf8",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Stethoscope size={13} /> Doctor
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount("patient@callmedex.in")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  color: "#34d399",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <User size={13} /> Patient
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount("nurse@callmedex.in")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  background: "rgba(244, 63, 94, 0.12)",
                  border: "1px solid rgba(244, 63, 94, 0.25)",
                  color: "#fb7185",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <HeartHandshake size={13} /> Nurse
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount("dietitian@callmedex.in")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  color: "#34d399",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Apple size={13} /> Dietitian
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount("physio@callmedex.in")}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  background: "rgba(139, 92, 246, 0.12)",
                  border: "1px solid rgba(139, 92, 246, 0.25)",
                  color: "#a78bfa",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Activity size={13} /> Physio
              </button>
            </div>
          </div>
        </div>

        {/* Right: Modern High-Brand Login Card */}
        <div>
          <div
            style={{
              background: "rgba(15, 23, 42, 0.82)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              borderRadius: "20px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Top Accent Stripe */}
            <div
              style={{
                height: "5px",
                width: "100%",
                background: "linear-gradient(90deg, #0284c7, #10b981, #6366f1)",
              }}
            />

            <div style={{ padding: "36px 32px" }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div
                  style={{
                    display: "inline-flex",
                    padding: 14,
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(16, 185, 129, 0.2))",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    color: "#38bdf8",
                    marginBottom: 14,
                  }}
                >
                  <HeartPulse size={32} />
                </div>
                <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ffffff", margin: "0 0 6px 0", letterSpacing: "-0.01em" }}>
                  Welcome Back
                </h2>
                <p style={{ fontSize: "0.9rem", color: "#94a3b8", margin: 0 }}>
                  Enter your verified credentials to access your Command Center
                </p>
              </div>

              {error && (
                <div
                  style={{
                    textAlign: "left",
                    marginBottom: 20,
                    fontSize: "0.86rem",
                    padding: "12px 14px",
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#fca5a5",
                    borderRadius: 10,
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
                    style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}
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
                      borderRadius: "10px",
                      background: "rgba(30, 41, 59, 0.8)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#ffffff",
                      fontSize: "0.95rem",
                      outline: "none",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#38bdf8";
                      e.target.style.boxShadow = "0 0 0 3px rgba(56, 189, 248, 0.15)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "rgba(255, 255, 255, 0.12)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label
                      htmlFor="login-password"
                      style={{ fontSize: "0.85rem", fontWeight: 600, color: "#cbd5e1" }}
                    >
                      Password
                    </label>
                    <a
                      href="/auth/forgot-password"
                      style={{ fontSize: "0.8rem", color: "#38bdf8", textDecoration: "none", fontWeight: 600 }}
                    >
                      Forgot Password?
                    </a>
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
                        borderRadius: "10px",
                        background: "rgba(30, 41, 59, 0.8)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#ffffff",
                        fontSize: "0.95rem",
                        outline: "none",
                        transition: "border-color 0.2s, box-shadow 0.2s",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#38bdf8";
                        e.target.style.boxShadow = "0 0 0 3px rgba(56, 189, 248, 0.15)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(255, 255, 255, 0.12)";
                        e.target.style.boxShadow = "none";
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
                        color: "#94a3b8",
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", marginBottom: 24, fontSize: "0.85rem", color: "#94a3b8" }}>
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
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "1rem",
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px 0 rgba(2, 132, 199, 0.39)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "transform 0.1s ease, box-shadow 0.2s ease",
                  }}
                >
                  {loading ? (
                    "Authenticating..."
                  ) : (
                    <>
                      Login to Command Center <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <div
                style={{
                  textAlign: "center",
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  fontSize: "0.9rem",
                  color: "#94a3b8",
                }}
              >
                New healthcare provider or patient?{" "}
                <a
                  href="/auth/signup"
                  style={{ color: "#38bdf8", fontWeight: 700, textDecoration: "none" }}
                >
                  Create Account
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
