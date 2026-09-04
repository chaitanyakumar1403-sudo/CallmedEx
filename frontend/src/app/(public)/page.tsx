import Link from "next/link";
import {
  ShieldCheck,
  Languages,
  Navigation,
  CheckCircle2,
  Activity,
  ArrowRight,
  Sparkles,
  HeartPulse,
  Clock,
  Award,
} from "lucide-react";
import Clinical3DIcon from "@/components/ui/Clinical3DIcon";

export default function HomePage() {
  return (
    <div style={{ backgroundColor: "var(--cm-surface)", color: "var(--cm-ink)", minHeight: "100vh" }}>
      {/* ─── Hero Section ─── */}
      <section style={{ borderBottom: "1px solid var(--cm-line)", padding: "72px 24px 64px", background: "var(--cm-surface)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: "999px", background: "var(--cm-active-surface)", border: "1px solid var(--cm-active-line)", color: "var(--cm-active)", fontSize: "var(--cm-text-xs)", fontWeight: 700, marginBottom: 20 }}>
              <ShieldCheck size={14} /> National Health Authority (ABHA) Integrated
            </div>

            <h1 style={{ margin: "0 0 20px 0", fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 900, color: "var(--cm-navy)", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              India&apos;s High-Precision <span style={{ color: "var(--cm-active)" }}>Clinical Healthcare</span> Operating System
            </h1>

            <p style={{ margin: "0 0 32px 0", fontSize: "var(--cm-text-base)", color: "var(--cm-ink-2)", lineHeight: 1.6, maxWidth: 540 }}>
              Book doorstep phlebotomy, verified NMC doctor teleconsultations, and doorstep nursing care with real-time GPS chain-of-custody tracking.
            </p>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 40 }}>
              <Link href="/auth/signup" className="cm-btn cm-btn--primary cm-btn--lg" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                Get Started Free <ArrowRight size={16} />
              </Link>
              <Link href="/diagnostics" className="cm-btn cm-btn--secondary cm-btn--lg" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                Book Diagnostic Test
              </Link>
            </div>

            {/* Metrics Ticker */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, borderTop: "1px solid var(--cm-line)", paddingTop: 24 }}>
              <div>
                <div style={{ fontSize: "var(--cm-text-2xl)", fontWeight: 900, color: "var(--cm-navy)", fontVariantNumeric: "tabular-nums" }}>50+</div>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", fontWeight: 600 }}>NABL Accredited Labs</div>
              </div>
              <div>
                <div style={{ fontSize: "var(--cm-text-2xl)", fontWeight: 900, color: "var(--cm-active)", fontVariantNumeric: "tabular-nums" }}>200+</div>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", fontWeight: 600 }}>Verified Biomarkers</div>
              </div>
              <div>
                <div style={{ fontSize: "var(--cm-text-2xl)", fontWeight: 900, color: "var(--cm-done)", fontVariantNumeric: "tabular-nums" }}>10K+</div>
                <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", fontWeight: 600 }}>Patients Served</div>
              </div>
            </div>
          </div>

          {/* Hero Visual Card: Clinical Status Preview */}
          <div className="cm-card" style={{ padding: 28, border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)", background: "var(--cm-surface)", boxShadow: "0 20px 40px -15px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid var(--cm-line)", paddingBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "transparent", display: "grid", placeItems: "center" }}>
                  <Clinical3DIcon name="activity" size={36} glow />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink)" }}>Live Clinical Dispatch</div>
                  <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-done)", display: "flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cm-done)" }} /> 24/7 Network Active
                  </div>
                </div>
              </div>
              <span className="cm-pill cm-pill--active">Vizag Command</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div style={{ padding: 12, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Clinical3DIcon name="droplet" size={28} glow />
                  <div>
                    <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink)" }}>Complete Blood Count (CBC)</div>
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Home Collection · Phlebotomist En Route</div>
                  </div>
                </div>
                <span className="cm-pill cm-pill--waiting">ETA 12m</span>
              </div>

              <div style={{ padding: 12, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Clinical3DIcon name="video" size={28} glow />
                  <div>
                    <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink)" }}>General Physician Teleconsult</div>
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>HD WebRTC Exam Room · Scribe Active</div>
                  </div>
                </div>
                <span className="cm-pill cm-pill--done">Connected</span>
              </div>

              <div style={{ padding: 12, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", border: "1px solid var(--cm-line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Clinical3DIcon name="pill" size={28} glow />
                  <div>
                    <div style={{ fontSize: "var(--cm-text-xs)", fontWeight: 700, color: "var(--cm-ink)" }}>Prescription Dispensation</div>
                    <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)" }}>Licensed Jan Aushadhi Partner Pharmacy</div>
                  </div>
                </div>
                <span className="cm-pill cm-pill--active">Verified</span>
              </div>
            </div>

            <div style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-3)", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--cm-line)", paddingTop: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clinical3DIcon name="shield" size={18} /> Zero Data Leakage Guarantee
              </span>
              <span style={{ fontWeight: 700, color: "var(--cm-ink)" }}>NMC 2026 Compliant</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Services Section ─── */}
      <section style={{ padding: "64px 24px", background: "var(--cm-surface)", borderBottom: "1px solid var(--cm-line)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ margin: "0 0 10px 0", fontSize: "var(--cm-text-2xl)", fontWeight: 800, color: "var(--cm-navy)" }}>
              Clinical Healthcare Services, Coordinated
            </h2>
            <p style={{ margin: 0, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)", maxWidth: 540, marginInline: "auto" }}>
              From door-to-lab diagnostic sample custody to HD video teleconsultations — seamlessly orchestrated on one verified canvas.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {/* Card 1 */}
            <div className="cm-card" style={{ padding: 24, border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", display: "grid", placeItems: "center", marginBottom: 16, border: "1px solid var(--cm-line)" }}>
                  <Clinical3DIcon name="microscope" size={30} glow />
                </div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                  Home Diagnostics &amp; Lab Tests
                </h3>
                <p style={{ margin: 0, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.5 }}>
                  Certified phlebotomists at your doorstep with barcode-sealed tubes, temperature sensors, and rapid NABL lab processing.
                </p>
              </div>
              <Link href="/diagnostics" className="cm-btn cm-btn--secondary cm-btn--sm" style={{ marginTop: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                Explore 200+ Tests <ArrowRight size={14} />
              </Link>
            </div>

            {/* Card 2 */}
            <div className="cm-card" style={{ padding: 24, border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", display: "grid", placeItems: "center", marginBottom: 16, border: "1px solid var(--cm-line)" }}>
                  <Clinical3DIcon name="video" size={30} glow />
                </div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                  Telemedicine Consultations
                </h3>
                <p style={{ margin: 0, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.5 }}>
                  Connect with verified NMC doctors over encrypted WebRTC video. Real-time clinical transcription and official generic e-Rx.
                </p>
              </div>
              <Link href="/consultation" className="cm-btn cm-btn--secondary cm-btn--sm" style={{ marginTop: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                Consult Specialist <ArrowRight size={14} />
              </Link>
            </div>

            {/* Card 3 */}
            <div className="cm-card" style={{ padding: 24, border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", display: "grid", placeItems: "center", marginBottom: 16, border: "1px solid var(--cm-line)" }}>
                  <Clinical3DIcon name="pharmacy" size={30} glow />
                </div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                  Prescription Pharmacy
                </h3>
                <p style={{ margin: 0, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.5 }}>
                  Direct transmission of your doctor&apos;s e-Rx to licensed neighborhood pharmacies with generic cost savings and tracking.
                </p>
              </div>
              <Link href="/pharmacy" className="cm-btn cm-btn--secondary cm-btn--sm" style={{ marginTop: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                Upload &amp; Order <ArrowRight size={14} />
              </Link>
            </div>

            {/* Card 4 */}
            <div className="cm-card" style={{ padding: 24, border: "1px solid var(--cm-line)", borderRadius: "var(--cm-radius)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", display: "grid", placeItems: "center", marginBottom: 16, border: "1px solid var(--cm-line)" }}>
                  <Clinical3DIcon name="homecare" size={30} glow />
                </div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                  Doorstep Nursing &amp; Therapy
                </h3>
                <p style={{ margin: 0, fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.5 }}>
                  Sterile wound dressing, post-op IV infusions, and bedside physiotherapy mobilizations dispatched to your residence.
                </p>
              </div>
              <Link href="/booking?type=home_collection" className="cm-btn cm-btn--secondary cm-btn--sm" style={{ marginTop: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                Book Home Visit <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Clinical Excellence Pillars ─── */}
      <section style={{ padding: "64px 24px", background: "var(--cm-surface-2)", borderBottom: "1px solid var(--cm-line)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ margin: "0 0 10px 0", fontSize: "var(--cm-text-2xl)", fontWeight: 800, color: "var(--cm-navy)" }}>
              Engineered for Healthcare Rigor
            </h2>
            <p style={{ margin: 0, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)", maxWidth: 540, marginInline: "auto" }}>
              Built with zero shortcuts in patient data privacy, provider licensing, and medical accuracy.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            <div className="cm-card" style={{ padding: 28, border: "1px solid var(--cm-line)", background: "var(--cm-surface)" }}>
              <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-active)", display: "grid", placeItems: "center", marginBottom: 16 }}>
                <ShieldCheck size={22} />
              </div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                ABHA &amp; National Health Grid
              </h3>
              <p style={{ margin: 0, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)", lineHeight: 1.5 }}>
                Your diagnostic reports and digital e-prescriptions are linked directly to your 14-digit Ayushman Bharat Health Account (ABHA).
              </p>
            </div>

            <div className="cm-card" style={{ padding: 28, border: "1px solid var(--cm-line)", background: "var(--cm-surface)" }}>
              <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-done)", display: "grid", placeItems: "center", marginBottom: 16 }}>
                <Sparkles size={22} />
              </div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                Verified Clinical Interpretation
              </h3>
              <p style={{ margin: 0, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)", lineHeight: 1.5 }}>
                Every report includes structured bio-marker ranges, flags out-of-range parameters, and pairs recommendations with licensed specialists.
              </p>
            </div>

            <div className="cm-card" style={{ padding: 28, border: "1px solid var(--cm-line)", background: "var(--cm-surface)" }}>
              <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-navy)", display: "grid", placeItems: "center", marginBottom: 16 }}>
                <Languages size={22} />
              </div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                Multilingual Consultations
              </h3>
              <p style={{ margin: 0, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)", lineHeight: 1.5 }}>
                Live translated speech captions during video calls across Telugu, Hindi, Tamil, and English for accessible healthcare.
              </p>
            </div>

            <div className="cm-card" style={{ padding: 28, border: "1px solid var(--cm-line)", background: "var(--cm-surface)" }}>
              <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-active)", display: "grid", placeItems: "center", marginBottom: 16 }}>
                <Navigation size={22} />
              </div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                Live GPS Telemetry
              </h3>
              <p style={{ margin: 0, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)", lineHeight: 1.5 }}>
                Track home phlebotomist and nursing dispatch with live countdown, distance meters, and two-party OTP arrival handshakes.
              </p>
            </div>

            <div className="cm-card" style={{ padding: 28, border: "1px solid var(--cm-line)", background: "var(--cm-surface)" }}>
              <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-done)", display: "grid", placeItems: "center", marginBottom: 16 }}>
                <Award size={22} />
              </div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                100% NMC Registered Doctors
              </h3>
              <p style={{ margin: 0, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)", lineHeight: 1.5 }}>
                Every doctor is authenticated against National Medical Commission state council records before they can consult on CallMedex.
              </p>
            </div>

            <div className="cm-card" style={{ padding: 28, border: "1px solid var(--cm-line)", background: "var(--cm-surface)" }}>
              <div style={{ width: 44, height: 44, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-navy)", display: "grid", placeItems: "center", marginBottom: 16 }}>
                <Clock size={22} />
              </div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)" }}>
                Zero-Hold Booking Flow
              </h3>
              <p style={{ margin: 0, fontSize: "var(--cm-text-sm)", color: "var(--cm-ink-3)", lineHeight: 1.5 }}>
                Instant booking confirmation via WhatsApp and SMS with calibrated morning fasting slots and prep instructions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Call to Action Section ─── */}
      <section style={{ padding: "64px 24px", background: "var(--cm-navy)", color: "#ffffff", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ color: "#ffffff", margin: "0 0 16px 0", fontSize: "var(--cm-text-2xl)", fontWeight: 800 }}>
            Experience Next-Generation Clinical Healthcare Today
          </h2>
          <p style={{ color: "#cbd5e1", maxWidth: 560, margin: "0 auto 32px auto", fontSize: "var(--cm-text-base)", lineHeight: 1.6 }}>
            Join thousands of patients, certified phlebotomists, and NMC doctors on India&apos;s most reliable health platform.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/auth/signup" className="cm-btn cm-btn--primary cm-btn--lg" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              Create Patient Account <ArrowRight size={16} />
            </Link>
            <Link href="/auth/signup?role=doctor" className="cm-btn cm-btn--secondary cm-btn--lg" style={{ background: "rgba(255,255,255,0.1)", color: "#ffffff", borderColor: "rgba(255,255,255,0.3)" }}>
              Register as Medical Provider
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
