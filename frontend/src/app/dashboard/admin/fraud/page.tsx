"use client";

import { useState, useEffect } from 'react';

export default function FraudAndQualityDashboard() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runAIScan = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:8000/api/admin/fraud/anomalies', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setProviders(data.anomalies);
      } else {
        setError(data.detail || "Failed to fetch anomalies.");
      }
    } catch (err) {
      setError("Network error while connecting to AI Engine.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Run an initial scan on mount
    runAIScan();
  }, []);

  return (
    <div style={{ backgroundColor: '#f0f4f8', minHeight: '100vh', padding: '40px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px' }}>
          <div>
            <h1 style={{ color: '#1a2b4a', margin: '0 0 10px 0' }}>AI Fraud & Quality Monitor</h1>
            <p style={{ color: '#4a5568', margin: '0' }}>Gemini AI continuously audits billing records to flag suspicious patterns.</p>
          </div>
          <button 
            onClick={runAIScan}
            disabled={loading}
            style={{ padding: '10px 20px', backgroundColor: loading ? '#a0aec0' : '#1a2b4a', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? '🤖 Scanning Patterns...' : '↻ Run AI Audit Now'}
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fed7d7', color: '#c53030', padding: '15px', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold' }}>
            {error}
          </div>
        )}

        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '20px', color: '#4a5568' }}>Provider Name</th>
                <th style={{ padding: '20px', color: '#4a5568' }}>Type</th>
                <th style={{ padding: '20px', color: '#4a5568' }}>Total Bookings</th>
                <th style={{ padding: '20px', color: '#4a5568' }}>Negative Signals</th>
                <th style={{ padding: '20px', color: '#4a5568' }}>Trust Score</th>
                <th style={{ padding: '20px', color: '#4a5568' }}>Status / Action</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p, idx) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: p.flagged ? '#fff5f5' : 'white' }}>
                  <td style={{ padding: '20px', fontWeight: 'bold', color: '#2d3748' }}>
                    {p.name}
                    {p.flagged && <div style={{ color: '#e53e3e', fontSize: '12px', marginTop: '4px', fontWeight: 'normal' }}>⚠️ {p.flag_reason}</div>}
                  </td>
                  <td style={{ padding: '20px', color: '#718096', textTransform: 'capitalize' }}>{p.type}</td>
                  <td style={{ padding: '20px', color: '#718096' }}>{p.total_bookings}</td>
                  <td style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <span style={{ backgroundColor: p.no_shows > 0 ? '#fed7d7' : '#edf2f7', color: p.no_shows > 0 ? '#c53030' : '#4a5568', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                        {p.no_shows} No-Shows
                      </span>
                      <span style={{ backgroundColor: p.complaints > 0 ? '#fed7d7' : '#edf2f7', color: p.complaints > 0 ? '#c53030' : '#4a5568', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                        {p.complaints} Complaints
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${p.score}%`, backgroundColor: p.score > 80 ? '#38a169' : p.score > 60 ? '#dd6b20' : '#e53e3e' }} />
                      </div>
                      <span style={{ fontWeight: 'bold', color: p.score > 80 ? '#2f855a' : p.score > 60 ? '#c05621' : '#c53030' }}>
                        {p.score.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '20px' }}>
                    {p.flagged ? (
                      <button style={{ padding: '8px 12px', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                        Review / Suspend
                      </button>
                    ) : (
                      <span style={{ color: '#38a169', fontWeight: 'bold', fontSize: '14px' }}>✓ In Good Standing</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
