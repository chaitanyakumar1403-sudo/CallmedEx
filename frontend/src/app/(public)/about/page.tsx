export default function AboutPage() {
  return (
    <div className="section" style={{ background: "#fff" }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="section-title">
          <h1>About CallMedex</h1>
          <p>India&apos;s first AI-native healthcare orchestration platform, built by ZukoLabs from Visakhapatnam</p>
        </div>

        <div className="card" style={{ padding: 32, marginBottom: 24 }}>
          <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1.15rem", marginBottom: 16 }}>Our Mission</h3>
          <p style={{ color: "var(--color-gray-600)", lineHeight: 1.8, fontSize: "0.95rem" }}>
            CallMedex is not just another healthcare app — it&apos;s a healthcare orchestration platform that connects patients with diagnostic centers,
            doctors, phlebotomists, and pharmacies through a single AI-powered interface. We believe healthcare should be accessible to every Indian,
            starting from Tier 2 and Tier 3 cities where quality diagnostics and teleconsultation remain fragmented.
          </p>
        </div>

        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏗️</div>
            <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>Built in Vizag</h4>
            <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)" }}>
              Proudly built from Visakhapatnam, Andhra Pradesh — expanding across India&apos;s Tier 2 and Tier 3 cities.
            </p>
          </div>
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔗</div>
            <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>ABHA-First</h4>
            <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)" }}>
              India&apos;s ABDM ecosystem integrated from day one. Your health records follow you, not the hospital.
            </p>
          </div>
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>🤖</div>
            <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>AI-Native</h4>
            <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)" }}>
              AI-powered report interpretation, multilingual captions, and smart fraud detection built into every workflow.
            </p>
          </div>
          <div className="card" style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>📱</div>
            <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 8 }}>WhatsApp-Native</h4>
            <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)" }}>
              No app downloads. Book appointments, receive reports, and get reminders — all through WhatsApp.
            </p>
          </div>
        </div>

        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1.15rem", marginBottom: 12 }}>Compliance & Trust</h3>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", marginTop: 16 }}>
            <span className="badge badge-navy">DPDP Act 2023</span>
            <span className="badge badge-navy">ABDM / ABHA</span>
            <span className="badge badge-navy">FHIR R4</span>
            <span className="badge badge-navy">NMC 2026 Compliant</span>
            <span className="badge badge-navy">NHCX Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
