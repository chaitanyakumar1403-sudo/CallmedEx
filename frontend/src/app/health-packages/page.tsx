export default function HealthPackagesPage() {
  const packages = [
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
    <div className="section">
      <div className="container">
        <div className="section-title">
          <h1>Health Packages</h1>
          <p>Comprehensive screening packages designed for Indian health profiles — home collection available</p>
        </div>

        <div className="grid-3">
          {packages.map((pkg) => (
            <div key={pkg.name} className="card package-card" style={pkg.popular ? { border: "2px solid var(--color-navy)" } : {}}>
              <div className="package-card__header" style={{ position: "relative" }}>
                {pkg.popular && (
                  <span className="badge badge-warning" style={{ position: "absolute", top: 12, right: 16 }}>Most Popular</span>
                )}
                <h3>{pkg.name}</h3>
                <div className="package-card__price">₹{pkg.price.toLocaleString()} <span>/ package</span></div>
                <p style={{ fontSize: "0.82rem", opacity: 0.8, marginTop: 4 }}>{pkg.tests} tests included</p>
              </div>
              <div className="package-card__body">
                <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)", marginBottom: 16 }}>{pkg.description}</p>
                <ul className="package-card__tests">
                  {pkg.included.slice(0, 6).map((t) => <li key={t}>{t}</li>)}
                  {pkg.included.length > 6 && <li style={{ color: "var(--color-teal)" }}>+{pkg.included.length - 6} more tests</li>}
                </ul>
                <a href="/booking?type=lab" className="btn btn-primary btn-full">Book Now</a>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 40, padding: 32, textAlign: "center" }}>
          <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1.1rem", marginBottom: 8 }}>Need a Custom Package?</h3>
          <p style={{ color: "var(--color-gray-500)", fontSize: "0.9rem", marginBottom: 16 }}>
            Contact us to create a personalized health screening package based on your specific needs.
          </p>
          <button className="btn btn-teal">Contact Us</button>
        </div>
      </div>
    </div>
  );
}
