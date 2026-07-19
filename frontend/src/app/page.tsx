export default function Home() {
  return (
    <>
      {/* ─── Hero Section ─────────────────────────────────────────── */}
      <section className="hero">
        <div className="container">
          <div className="hero__content">
            <h1>
              Your Health, <span>Orchestrated</span> by AI
            </h1>
            <p>
              Book diagnostic tests, video consultations, pharmacy deliveries, and home
              sample collections — all from one ABHA-linked platform. Real doctors.
              Real-time tracking. Real care.
            </p>
            <div className="hero__actions">
              <a href="/auth/signup" className="btn btn-teal btn-lg">
                Get Started Free
              </a>
              <a href="/health-packages" className="btn btn-secondary btn-lg" style={{ borderColor: '#fff', color: '#fff' }}>
                View Health Packages
              </a>
            </div>
            <div className="hero__stats">
              <div className="hero__stat">
                <div className="hero__stat-number">50+</div>
                <div className="hero__stat-label">Partner Clinics</div>
              </div>
              <div className="hero__stat">
                <div className="hero__stat-number">200+</div>
                <div className="hero__stat-label">Diagnostic Tests</div>
              </div>
              <div className="hero__stat">
                <div className="hero__stat-number">10K+</div>
                <div className="hero__stat-label">Patients Served</div>
              </div>
            </div>
          </div>
          <div className="hero__visual">
            {/* Decorative medical illustration */}
            <div style={{
              width: 400, height: 400, borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, rgba(34,211,238,0.2), rgba(26,43,74,0.3))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '8rem', backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255,255,255,0.1)',
            }}>
              🏥
            </div>
          </div>
        </div>
      </section>

      {/* ─── Services Section ─────────────────────────────────────── */}
      <section className="section" style={{ background: '#fff' }}>
        <div className="container">
          <div className="section-title">
            <h2>Healthcare Services, Reimagined</h2>
            <p>From diagnostic tests to pharmacy deliveries — all connected through one intelligent platform</p>
          </div>
          <div className="grid-4">
            <div className="card service-card">
              <div className="service-card__icon service-card__icon--diagnostics">🔬</div>
              <h3>Diagnostics</h3>
              <p>Book lab tests online. Choose home collection or visit a partner center. Get AI-interpreted results.</p>
              <a href="/diagnostics" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>Book Now</a>
            </div>
            <div className="card service-card">
              <div className="service-card__icon service-card__icon--consult">👨‍⚕️</div>
              <h3>Video Consultation</h3>
              <p>Connect with verified doctors via video call. Live translated captions. AI-generated prescriptions.</p>
              <a href="/consultation" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>Consult Now</a>
            </div>
            <div className="card service-card">
              <div className="service-card__icon service-card__icon--pharmacy">💊</div>
              <h3>Pharmacy</h3>
              <p>Order medicines from the nearest pharmacy. One-tap e-prescription ordering. Delivery tracking.</p>
              <a href="/pharmacy" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>Order Medicines</a>
            </div>
            <div className="card service-card">
              <div className="service-card__icon service-card__icon--home">🏠</div>
              <h3>Home Collection</h3>
              <p>Phlebotomist at your doorstep. Live GPS tracking. Chain-of-custody for every sample.</p>
              <a href="/booking?type=home_collection" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>Book Now</a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Health Packages Section ──────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div className="section-title">
            <h2>Popular Health Packages</h2>
            <p>Comprehensive screening packages designed for Indian health profiles — starting from ₹799</p>
          </div>
          <div className="grid-3">
            <div className="card package-card">
              <div className="package-card__header">
                <h3>Basic Health Checkup</h3>
                <div className="package-card__price">₹799 <span>/ package</span></div>
              </div>
              <div className="package-card__body">
                <ul className="package-card__tests">
                  <li>Complete Blood Count (CBC)</li>
                  <li>Fasting Blood Sugar</li>
                  <li>Lipid Profile</li>
                  <li>Thyroid Profile (T3, T4, TSH)</li>
                  <li>Liver Function Test</li>
                  <li>Kidney Function Test</li>
                  <li>Urine Routine</li>
                </ul>
                <a href="/booking?type=lab" className="btn btn-primary btn-full">Book Now</a>
              </div>
            </div>
            <div className="card package-card" style={{ border: '2px solid var(--color-navy)' }}>
              <div className="package-card__header" style={{ position: 'relative' }}>
                <span className="badge badge-warning" style={{ position: 'absolute', top: 12, right: 16 }}>Most Popular</span>
                <h3>Comprehensive Wellness</h3>
                <div className="package-card__price">₹1,999 <span>/ package</span></div>
              </div>
              <div className="package-card__body">
                <ul className="package-card__tests">
                  <li>All Basic Checkup Tests</li>
                  <li>HbA1c (Diabetes Marker)</li>
                  <li>Vitamin D & B12</li>
                  <li>Iron Studies</li>
                  <li>Uric Acid & Calcium</li>
                  <li>ECG</li>
                  <li>60+ Parameters Total</li>
                </ul>
                <a href="/booking?type=lab" className="btn btn-primary btn-full">Book Now</a>
              </div>
            </div>
            <div className="card package-card">
              <div className="package-card__header">
                <h3>Cardiac Risk Assessment</h3>
                <div className="package-card__price">₹2,499 <span>/ package</span></div>
              </div>
              <div className="package-card__body">
                <ul className="package-card__tests">
                  <li>Advanced Lipid Profile</li>
                  <li>hs-CRP (Inflammation)</li>
                  <li>Homocysteine</li>
                  <li>ECG</li>
                  <li>Troponin T</li>
                  <li>BNP (Heart Failure Marker)</li>
                  <li>Cardiac Risk Score</li>
                </ul>
                <a href="/booking?type=lab" className="btn btn-primary btn-full">Book Now</a>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <a href="/health-packages" className="btn btn-secondary">View All Packages →</a>
          </div>
        </div>
      </section>

      {/* ─── Why CallMedex Section ────────────────────────────────── */}
      <section className="section" style={{ background: '#fff' }}>
        <div className="container">
          <div className="section-title">
            <h2>Why Thousands Choose CallMedex</h2>
            <p>Built different from legacy healthcare platforms</p>
          </div>
          <div className="grid-3">
            <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🔗</div>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.1rem', marginBottom: 8 }}>ABHA-Linked Records</h3>
              <p style={{ color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>
                Your health records follow you, not the hospital. Connected to India&apos;s national health data network.
              </p>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🤖</div>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.1rem', marginBottom: 8 }}>AI-Powered Insights</h3>
              <p style={{ color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>
                Lab reports explained in plain language. Abnormal values flagged automatically. Trends tracked over time.
              </p>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>📱</div>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.1rem', marginBottom: 8 }}>WhatsApp-Native</h3>
              <p style={{ color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>
                Book appointments, receive reports, and get reminders — all via WhatsApp. No app download needed.
              </p>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🌐</div>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.1rem', marginBottom: 8 }}>Multilingual Captions</h3>
              <p style={{ color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>
                Live translated captions during video consults. Speak your language — the doctor sees translated text.
              </p>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>📍</div>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.1rem', marginBottom: 8 }}>Live Tracking</h3>
              <p style={{ color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>
                Track your phlebotomist in real-time, like tracking a delivery. ETA, distance, and arrival notifications.
              </p>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>✅</div>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.1rem', marginBottom: 8 }}>Verified Providers</h3>
              <p style={{ color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>
                Every doctor verified against NMC registry. Every pharmacy license-checked. Trust scores visible.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA Section ──────────────────────────────────────────── */}
      <section className="section" style={{
        background: 'linear-gradient(135deg, var(--color-navy-dark) 0%, var(--color-navy) 100%)',
        color: '#fff', textAlign: 'center'
      }}>
        <div className="container">
          <h2 style={{ color: '#fff', marginBottom: 16 }}>Ready to Experience Healthcare, Reimagined?</h2>
          <p style={{ color: 'var(--color-gray-300)', maxWidth: 500, margin: '0 auto 32px', fontSize: '1.1rem' }}>
            Join thousands of patients and healthcare providers on India&apos;s smartest healthcare platform.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/auth/signup" className="btn btn-teal btn-lg">Create Your Account</a>
            <a href="/auth/signup?role=doctor" className="btn btn-lg" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
              Register as Provider
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
