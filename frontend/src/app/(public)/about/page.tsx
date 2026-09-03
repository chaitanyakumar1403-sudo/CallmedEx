import {
  Home,
  TestTube2,
  Video,
  Pill,
  Package,
  Navigation,
  Link2,
  Smartphone,
  Cpu,
  Building2,
  ShieldCheck,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="section" style={{ background: "var(--cm-surface)", minHeight: "100vh" }}>
      <div className="container" style={{ maxWidth: 960 }}>
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <div className="section-title">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: "var(--cm-active-surface)", border: "1px solid var(--cm-active-line)", color: "var(--cm-active)", fontSize: "var(--cm-text-xs)", fontWeight: 700, marginBottom: 12 }}>
            <ShieldCheck size={14} /> National Health Mission Aligned
          </div>
          <h1 style={{ color: "var(--cm-navy)" }}>About CallMedex</h1>
          <p style={{ color: "var(--cm-ink-2)" }}>
            India&apos;s high-precision clinical healthcare orchestration platform,
            built by <strong>xylarcAI</strong> from Visakhapatnam.
          </p>
        </div>

        {/* ── What We Do ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontSize: "var(--cm-text-xl)",
              fontWeight: 800,
              textAlign: "center",
              marginBottom: 24,
              color: "var(--cm-navy)",
            }}
          >
            What We Do
          </h2>
          <div className="grid-3">
            <div className="cm-card" style={{ padding: 24, textAlign: "center", border: "1px solid var(--cm-line)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-active)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <Home size={24} />
              </div>
              <h4 style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", marginBottom: 8 }}>
                Home Sample Collection
              </h4>
              <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.6 }}>
                Doorstep phlebotomy with live GPS tracking and
                chain-of-custody barcode scans — from collection to lab receipt.
              </p>
            </div>

            <div className="cm-card" style={{ padding: 24, textAlign: "center", border: "1px solid var(--cm-line)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-active)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <TestTube2 size={24} />
              </div>
              <h4 style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", marginBottom: 8 }}>
                Diagnostics &amp; Imaging
              </h4>
              <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.6 }}>
                Lab tests and scans at transparent CallMedex rates — home
                collection where possible, or a verified walk-in partner centre.
              </p>
            </div>

            <div className="cm-card" style={{ padding: 24, textAlign: "center", border: "1px solid var(--cm-line)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-done)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <Video size={24} />
              </div>
              <h4 style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", marginBottom: 8 }}>
                Video Teleconsultation
              </h4>
              <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.6 }}>
                Verified doctors, AI-generated e-prescriptions with generic
                names per NMC 2026 guidelines, and multilingual live captions.
              </p>
            </div>

            <div className="cm-card" style={{ padding: 24, textAlign: "center", border: "1px solid var(--cm-line)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-navy)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <Pill size={24} />
              </div>
              <h4 style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", marginBottom: 8 }}>
                Pharmacy Delivery
              </h4>
              <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.6 }}>
                Your nearest registered pharmacy fulfils your order — from
                prescription medicines to OTC essentials with live delivery tracking.
              </p>
            </div>

            <div className="cm-card" style={{ padding: 24, textAlign: "center", border: "1px solid var(--cm-line)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-waiting)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <Package size={24} />
              </div>
              <h4 style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", marginBottom: 8 }}>
                Health Packages
              </h4>
              <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.6 }}>
                Fixed-rate full-body and condition-specific packages with doorstep
                blood collection at transparent, calibrated prices.
              </p>
            </div>

            <div className="cm-card" style={{ padding: 24, textAlign: "center", border: "1px solid var(--cm-line)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-urgent)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <Navigation size={24} />
              </div>
              <h4 style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", marginBottom: 8 }}>
                Real-Time Dispatch
              </h4>
              <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.6 }}>
                Nearest on-duty phlebotomist assigned to your booking with live
                ETA, distance tracking, and two-party OTP handshake.
              </p>
            </div>
          </div>
        </div>

        {/* ── Why We Are Different ───────────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontSize: "var(--cm-text-xl)",
              fontWeight: 800,
              textAlign: "center",
              marginBottom: 24,
              color: "var(--cm-navy)",
            }}
          >
            Clinical Architectural Pillars
          </h2>
          <div className="grid-2">
            <div className="cm-card" style={{ padding: 28, textAlign: "center", border: "1px solid var(--cm-line)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-active)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <Link2 size={24} />
              </div>
              <h4 style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", marginBottom: 8 }}>
                ABHA-First Architecture
              </h4>
              <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.6 }}>
                ABDM-integrated from day one. Your health records follow you,
                not the hospital — linked securely to your ABHA account.
              </p>
            </div>

            <div className="cm-card" style={{ padding: 28, textAlign: "center", border: "1px solid var(--cm-line)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-done)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <Smartphone size={24} />
              </div>
              <h4 style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", marginBottom: 8 }}>
                WhatsApp &amp; SMS Native
              </h4>
              <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.6 }}>
                Zero installation friction. Book appointments, receive verified lab reports, and get
                fasting prep reminders directly through WhatsApp.
              </p>
            </div>

            <div className="cm-card" style={{ padding: 28, textAlign: "center", border: "1px solid var(--cm-line)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-navy)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <Cpu size={24} />
              </div>
              <h4 style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", marginBottom: 8 }}>
                AI-Native Scribe &amp; Interpretation
              </h4>
              <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.6 }}>
                AI-powered report interpretation, multilingual consultations, real-time
                transcription, and quality scoring embedded in clinical workflows.
              </p>
            </div>

            <div className="cm-card" style={{ padding: 28, textAlign: "center", border: "1px solid var(--cm-line)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "var(--cm-radius-sm)", background: "var(--cm-surface-2)", color: "var(--cm-waiting)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <Building2 size={24} />
              </div>
              <h4 style={{ fontSize: "var(--cm-text-base)", fontWeight: 800, color: "var(--cm-ink)", marginBottom: 8 }}>
                Built for Bharat
              </h4>
              <p style={{ fontSize: "var(--cm-text-xs)", color: "var(--cm-ink-2)", lineHeight: 1.6 }}>
                Engineered in Visakhapatnam for Tier 2 and Tier 3 India — starting
                where healthcare access and provider discovery are most fragmented.
              </p>
            </div>
          </div>
        </div>

        {/* ── Our Mission ────────────────────────────────────────────── */}
        <div className="cm-card" style={{ padding: 32, marginBottom: 40, border: "1px solid var(--cm-line)" }}>
          <h3
            style={{
              fontSize: "var(--cm-text-lg)",
              fontWeight: 800,
              color: "var(--cm-navy)",
              marginBottom: 12,
            }}
          >
            Our Mission
          </h3>
          <p
            style={{
              color: "var(--cm-ink-2)",
              lineHeight: 1.7,
              fontSize: "var(--cm-text-sm)",
              margin: 0,
            }}
          >
            CallMedex connects fragmented healthcare supply — doctors,
            diagnostic centres, pharmacies, phlebotomists, and hospitals — to
            patient demand through one verified clinical operating system. We believe
            quality healthcare should be accessible to every citizen, starting from Tier
            2 and Tier 3 cities where diagnostics, teleconsultation, and
            timely medicine delivery remain fragmented.
          </p>
        </div>

        {/* ── Compliance & Trust ─────────────────────────────────────── */}
        <div className="cm-card" style={{ padding: 32, textAlign: "center", marginBottom: 32, border: "1px solid var(--cm-line)" }}>
          <h3
            style={{
              fontSize: "var(--cm-text-base)",
              fontWeight: 800,
              color: "var(--cm-navy)",
              marginBottom: 12,
            }}
          >
            Regulatory Compliance &amp; Standards
          </h3>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 16,
            }}
          >
            <span className="cm-pill cm-pill--navy">DPDP Act 2023</span>
            <span className="cm-pill cm-pill--navy">ABDM / ABHA</span>
            <span className="cm-pill cm-pill--navy">FHIR R4</span>
            <span className="cm-pill cm-pill--navy">NMC 2026 Compliant</span>
            <span className="cm-pill cm-pill--navy">NHCX Ready</span>
          </div>
        </div>

        {/* ── Company footer ─────────────────────────────────────────── */}
        <p
          style={{
            textAlign: "center",
            fontSize: "var(--cm-text-xs)",
            color: "var(--cm-ink-3)",
            padding: "16px 0 8px",
            borderTop: "1px solid var(--cm-line)",
          }}
        >
          CallMedex is built and operated by <strong>xylarcAI</strong>,
          Visakhapatnam, Andhra Pradesh.
        </p>
      </div>
    </div>
  );
}
