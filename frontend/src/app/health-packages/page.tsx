"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HealthPackagesPage() {
  const router = useRouter();
  const [orgPackages, setOrgPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPackages() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiBase}/api/providers/search/packages`);
        const data = await res.json();
        if (data.success && data.packages) {
          setOrgPackages(data.packages);
        }
      } catch (e) {
        console.error("Failed to fetch packages", e);
      } finally {
        setLoading(false);
      }
    }
    fetchPackages();
  }, []);

  const standardPackages = [
    {
      name: "Basic Health Checkup", price: 799, tests: 7,
      included: ["CBC", "Fasting Blood Sugar", "Lipid Profile", "Thyroid Profile", "LFT", "KFT", "Urine Routine"],
      description: "Essential screening for overall health monitoring"
    },
    {
      name: "Comprehensive Wellness", price: 1999, tests: 12, popular: true,
      included: ["CBC", "HbA1c", "Lipid Profile", "Thyroid Profile", "LFT", "KFT", "Vitamin D", "Vitamin B12", "Iron Studies", "Uric Acid", "Calcium", "ECG"],
      description: "Full-body screening with 60+ parameters"
    },
    {
      name: "Cardiac Risk Assessment", price: 2499, tests: 7,
      included: ["Lipid Profile Advanced", "hs-CRP", "Homocysteine", "ECG", "Troponin T", "BNP", "Cardiac Risk Score"],
      description: "Specialized cardiac markers for heart health"
    },
    {
      name: "Diabetic Care Package", price: 1299, tests: 6,
      included: ["HbA1c", "Fasting Blood Sugar", "Post-Prandial Sugar", "KFT", "Urine Microalbumin", "Lipid Profile"],
      description: "Complete diabetic monitoring panel"
    },
    {
      name: "Women's Wellness", price: 2299, tests: 10,
      included: ["CBC", "Thyroid Profile", "Iron Studies", "Vitamin D", "Vitamin B12", "Calcium", "FSH", "LH", "Prolactin", "Pap Smear Referral"],
      description: "Comprehensive screening tailored for women"
    },
    {
      name: "Senior Citizen Complete", price: 2999, tests: 15,
      included: ["CBC", "Lipid Profile", "Thyroid Profile", "LFT", "KFT", "HbA1c", "Vitamin D", "B12", "Calcium", "Uric Acid", "PSA/Pap Smear", "ECG", "Chest X-Ray", "BMD", "Eye Screening"],
      description: "Full geriatric screening for 60+ patients"
    },
  ];

  return (
    <div className="section" style={{ backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      <div className="container">
        <div className="section-title">
          <h1 style={{ color: "#1e293b" }}>Health Packages</h1>
          <p style={{ color: "#475569" }}>Comprehensive screening packages designed for your health profile — home collection available</p>
        </div>

        {/* ─── STANDARD PACKAGES ─── */}
        <h2 style={{ fontSize: "1.5rem", color: "#334155", marginBottom: 20 }}>Popular Standard Packages</h2>
        <div className="grid-3">
          {standardPackages.map((pkg) => (
            <div key={pkg.name} className="card package-card" style={{ backgroundColor: "white", ...(pkg.popular ? { border: "2px solid var(--color-navy)" } : {}) }}>
              <div className="package-card__header" style={{ position: "relative" }}>
                {pkg.popular && (
                  <span className="badge badge-warning" style={{ position: "absolute", top: 12, right: 16 }}>Most Popular</span>
                )}
                <h3 style={{ color: "#0f172a" }}>{pkg.name}</h3>
                <div className="package-card__price">₹{pkg.price.toLocaleString()} <span>/ package</span></div>
                <p style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 4 }}>{pkg.tests} tests included</p>
              </div>
              <div className="package-card__body">
                <p style={{ fontSize: "0.85rem", color: "#475569", marginBottom: 16 }}>{pkg.description}</p>
                <ul className="package-card__tests">
                  {pkg.included.slice(0, 6).map((t) => <li key={t} style={{ color: "#334155" }}>{t}</li>)}
                  {pkg.included.length > 6 && <li style={{ color: "var(--color-teal)" }}>+{pkg.included.length - 6} more tests</li>}
                </ul>
                <button onClick={() => router.push("/booking?type=lab")} className="btn btn-primary btn-full">Book Now</button>
              </div>
            </div>
          ))}
        </div>

        {/* ─── CUSTOM ORGANIZATION PACKAGES ─── */}
        <h2 style={{ fontSize: "1.5rem", color: "#334155", marginTop: 40, marginBottom: 20 }}>Custom Packages by Diagnostic Centers</h2>
        
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading custom packages...</div>
        ) : orgPackages.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, backgroundColor: "white", borderRadius: 12, color: "#64748b" }}>
            No custom diagnostic center packages available right now.
          </div>
        ) : (
          <div className="grid-3">
            {orgPackages.map((pkg) => (
              <div key={pkg.id} className="card package-card" style={{ backgroundColor: "white", border: "1px solid #bae6fd", borderTop: "4px solid #0284c7" }}>
                <div className="package-card__header">
                  <div style={{ fontSize: "0.8rem", color: "#0284c7", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    🏥 {pkg.organization_name || "Diagnostic Center"}
                  </div>
                  <h3 style={{ color: "#0f172a" }}>{pkg.name}</h3>
                  <div className="package-card__price">₹{pkg.price.toLocaleString()} <span>/ package</span></div>
                  <p style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 4 }}>
                    {pkg.tests_included?.length || 0} tests included
                  </p>
                </div>
                <div className="package-card__body">
                  {pkg.description && (
                    <p style={{ fontSize: "0.85rem", color: "#475569", marginBottom: 16 }}>{pkg.description}</p>
                  )}
                  {pkg.tests_included && pkg.tests_included.length > 0 && (
                    <div style={{ fontSize: "0.8rem", color: "#0369a1", backgroundColor: "#f0f9ff", padding: "8px 12px", borderRadius: 8, marginBottom: 16 }}>
                      {pkg.tests_included.length} specific tests mapped to this package.
                    </div>
                  )}
                  <button onClick={() => router.push("/booking?type=lab")} style={{
                    width: "100%", backgroundColor: "#0284c7", color: "white", border: "none",
                    padding: "12px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: "0.9rem"
                  }}>
                    Book with {pkg.organization_name || "Center"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ marginTop: 40, padding: 32, textAlign: "center", backgroundColor: "white" }}>
          <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1.1rem", marginBottom: 8, color: "#1e293b" }}>Need a Custom Package?</h3>
          <p style={{ color: "#475569", fontSize: "0.9rem", marginBottom: 16 }}>
            Contact us to create a personalized health screening package based on your specific needs.
          </p>
          <button className="btn btn-teal">Contact Us</button>
        </div>
      </div>
    </div>
  );
}
