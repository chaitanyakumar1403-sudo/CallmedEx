export default function PharmacyPage() {
  const pharmacies = [
    { name: "MedPlus Pharmacy", address: "Dwaraka Nagar, Vizag", delivery: true, is24x7: false, radius: 5, rating: 4.5 },
    { name: "Apollo Pharmacy", address: "MVP Colony, Vizag", delivery: true, is24x7: true, radius: 8, rating: 4.7 },
    { name: "Netmeds Partner Store", address: "RK Beach Road, Vizag", delivery: true, is24x7: false, radius: 10, rating: 4.3 },
    { name: "Care & Cure Pharmacy", address: "Seethammadhara, Vizag", delivery: false, is24x7: false, radius: 3, rating: 4.6 },
  ];

  return (
    <div className="section">
      <div className="container">
        <div className="section-title">
          <h1>Pharmacy</h1>
          <p>Order medicines from verified pharmacies near you. Upload prescriptions or use e-prescriptions from consultations.</p>
        </div>

        {/* Upload Prescription */}
        <div className="card" style={{ padding: 32, marginBottom: 32, textAlign: "center", border: "2px dashed var(--color-gray-300)", background: "var(--color-gray-50)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📄</div>
          <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1.1rem", marginBottom: 8 }}>Upload Prescription</h3>
          <p style={{ color: "var(--color-gray-500)", fontSize: "0.9rem", marginBottom: 16 }}>
            Upload a photo of your prescription and we&apos;ll match it to the nearest pharmacy with stock availability.
          </p>
          <button className="btn btn-primary">Upload Prescription</button>
        </div>

        {/* Pharmacy List */}
        <h3 style={{ fontFamily: "var(--font-body)", fontSize: "1.15rem", marginBottom: 16 }}>Pharmacies Near You</h3>
        <div className="grid-2">
          {pharmacies.map((p) => (
            <div key={p.name} className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h4 style={{ fontFamily: "var(--font-body)", fontSize: "1rem", marginBottom: 4 }}>{p.name}</h4>
                  <p style={{ fontSize: "0.82rem", color: "var(--color-gray-500)" }}>📍 {p.address}</p>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span style={{ color: "var(--color-amber)" }}>⭐</span>
                  <span style={{ fontWeight: 600 }}>{p.rating}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {p.delivery && <span className="badge badge-success">Home Delivery</span>}
                {p.is24x7 && <span className="badge badge-info">24×7</span>}
                <span className="badge badge-navy">{p.radius} km radius</span>
              </div>
              <button className="btn btn-primary btn-sm btn-full">Order from Here</button>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 32, padding: 24, textAlign: "center", background: "var(--color-gray-50)" }}>
          <p style={{ fontSize: "0.85rem", color: "var(--color-gray-500)" }}>
            💊 All prescriptions require generic drug names per BIS mandate · e-Prescriptions auto-generated after video consultations · Drug license verified for all partner pharmacies
          </p>
        </div>
      </div>
    </div>
  );
}
