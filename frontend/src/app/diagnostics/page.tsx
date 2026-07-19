export default function DiagnosticsPage() {
  const tests = [
    { name: "Complete Blood Count (CBC)", price: 199, turnaround: "4-6 hours" },
    { name: "Lipid Profile", price: 349, turnaround: "6-8 hours" },
    { name: "Thyroid Profile (T3, T4, TSH)", price: 399, turnaround: "8-12 hours" },
    { name: "Liver Function Test (LFT)", price: 349, turnaround: "6-8 hours" },
    { name: "Kidney Function Test (KFT)", price: 349, turnaround: "6-8 hours" },
    { name: "HbA1c (Diabetes)", price: 349, turnaround: "4-6 hours" },
    { name: "Vitamin D", price: 499, turnaround: "12-24 hours" },
    { name: "Vitamin B12", price: 599, turnaround: "12-24 hours" },
    { name: "Fasting Blood Sugar", price: 79, turnaround: "2-4 hours" },
    { name: "Urine Routine", price: 99, turnaround: "2-4 hours" },
    { name: "Iron Studies", price: 499, turnaround: "8-12 hours" },
    { name: "ECG", price: 299, turnaround: "Immediate" },
  ];

  return (
    <div className="section">
      <div className="container">
        <div className="section-title">
          <h1>Diagnostic Tests</h1>
          <p>200+ diagnostic tests available with home collection and partner center options</p>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 32, justifyContent: "center", flexWrap: "wrap" }}>
          <span className="chip active">All Tests</span>
          <span className="chip">Blood Tests</span>
          <span className="chip">Imaging</span>
          <span className="chip">Cardiac</span>
          <span className="chip">Diabetes</span>
          <span className="chip">Thyroid</span>
        </div>

        <div className="grid-3">
          {tests.map((test) => (
            <div key={test.name} className="card" style={{ padding: 20 }}>
              <h4 style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem", marginBottom: 8 }}>{test.name}</h4>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-navy)" }}>₹{test.price}</span>
                <span style={{ fontSize: "0.78rem", color: "var(--color-gray-500)" }}>⏱ {test.turnaround}</span>
              </div>
              <a href="/booking?type=lab" className="btn btn-primary btn-sm btn-full">Book Test</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
