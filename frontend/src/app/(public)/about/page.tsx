export default function AboutPage() {
  return (
    <div className="section" style={{ background: "#fff" }}>
      <div className="container" style={{ maxWidth: 900 }}>
        {/* ── Hero ────────────────────────────────────────────────────── */}
        <div className="section-title">
          <h1>About CallMedex</h1>
          <p>
            India&apos;s most advanced AI-native healthcare orchestration platform,
            built by <strong>xylarcAI</strong> from Visakhapatnam
          </p>
        </div>

        {/* ── What We Do ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "1.3rem",
              textAlign: "center",
              marginBottom: 20,
              color: "var(--color-gray-800)",
            }}
          >
            What We Do
          </h2>
          <div className="grid-3">
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏠</div>
              <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>
                Home Sample Collection
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
                Doorstep phlebotomy with live Uber-style tracking and
                chain-of-custody QR scans — from collection to lab receipt.
              </p>
            </div>
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🧪</div>
              <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>
                Diagnostics &amp; Imaging
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
                Lab tests and scans at transparent CallMedex rates — home
                collection where possible, or a verified walk-in partner centre.
              </p>
            </div>
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📹</div>
              <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>
                Video Consultation
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
                Verified doctors, AI-generated e-prescriptions with generic
                names per NMC 2026 guidelines, and multilingual live captions.
              </p>
            </div>
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>💊</div>
              <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>
                Pharmacy Delivery
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
                Your nearest registered pharmacy fulfils your order — from
                prescription medicines to OTC essentials.
              </p>
            </div>
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📦</div>
              <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>
                Health Packages
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
                Fixed-rate full-body and condition-specific packages with home
                collection at MRP-struck prices.
              </p>
            </div>
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🚑</div>
              <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>
                Real-time Dispatch
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
                Nearest on-duty phlebotomist assigned to your booking with live
                ETA, distance tracking, and QR chain-of-custody.
              </p>
            </div>
          </div>
        </div>

        {/* ── Why We Are Different ───────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "1.3rem",
              textAlign: "center",
              marginBottom: 20,
              color: "var(--color-gray-800)",
            }}
          >
            Why We Are Different
          </h2>
          <div className="grid-2">
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔗</div>
              <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>
                ABHA-First
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
                ABDM-integrated from day one. Your health records follow you,
                not the hospital — linked to your ABHA account.
              </p>
            </div>
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📱</div>
              <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>
                WhatsApp-Native
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
                No app downloads. Book appointments, receive reports, and get
                reminders — all through WhatsApp.
              </p>
            </div>
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🤖</div>
              <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>
                AI-Native
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
                AI-powered report interpretation, multilingual support, smart
                fraud detection, and quality scoring embedded in every workflow.
              </p>
            </div>
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏗️</div>
              <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>
                Built for Bharat
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)", lineHeight: 1.6 }}>
                Built in Visakhapatnam for Tier 2 and Tier 3 India — starting
                where healthcare access is most fragmented.
              </p>
            </div>
          </div>
        </div>

        {/* ── Our Mission ────────────────────────────────────────────── */}
        <div className="card" style={{ padding: 32, marginBottom: 40 }}>
          <h3
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "1.15rem",
              marginBottom: 16,
            }}
          >
            Our Mission
          </h3>
          <p
            style={{
              color: "var(--color-gray-600)",
              lineHeight: 1.8,
              fontSize: "0.95rem",
            }}
          >
            CallMedex connects fragmented healthcare supply — doctors,
            diagnostic centres, pharmacies, phlebotomists, and hospitals — to
            patient demand through one AI-orchestrated platform. We believe
            healthcare should be accessible to every Indian, starting from Tier
            2 and Tier 3 cities where quality diagnostics, teleconsultation, and
            medicine delivery remain fragmented.
          </p>
        </div>

        {/* ── Compliance & Trust ─────────────────────────────────────── */}
        <div className="card" style={{ padding: 32, textAlign: "center", marginBottom: 32 }}>
          <h3
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "1.15rem",
              marginBottom: 12,
            }}
          >
            Compliance &amp; Trust
          </h3>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 24,
              flexWrap: "wrap",
              marginTop: 16,
            }}
          >
            <span className="badge badge-navy">DPDP Act 2023</span>
            <span className="badge badge-navy">ABDM / ABHA</span>
            <span className="badge badge-navy">FHIR R4</span>
            <span className="badge badge-navy">NMC 2026 Compliant</span>
            <span className="badge badge-navy">NHCX Ready</span>
          </div>
        </div>

        {/* ── Company footer ─────────────────────────────────────────── */}
        <p
          style={{
            textAlign: "center",
            fontSize: "0.85rem",
            color: "var(--color-gray-500)",
            padding: "16px 0 8px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          CallMedex is built and operated by <strong>xylarcAI</strong>,
          Visakhapatnam, Andhra Pradesh.
        </p>
      </div>
    </div>
  );
}