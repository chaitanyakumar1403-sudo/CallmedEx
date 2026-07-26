"use client";

import { useState, useEffect } from 'react';
import DashboardShell from '../../components/DashboardShell';

export default function FraudAndQualityDashboard() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runAIScan = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/admin/fraud/anomalies`, {
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
    <DashboardShell
      role="admin"
      title="Fraud & Quality Monitor"
      subtitle="Billing records are audited continuously to flag suspicious patterns."
      tabs={[]}
      activeTab=""
      onTabChange={() => {}}
      aside={
        <button
          onClick={runAIScan}
          disabled={loading}
          style={{
            padding: '10px 18px', borderRadius: 999,
            cursor: loading ? 'not-allowed' : 'pointer',
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(255,255,255,0.12)', color: '#fff',
            fontWeight: 700, fontSize: '0.85rem', opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Scanning…' : '↻ Run audit now'}
        </button>
      }
    >

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
    </DashboardShell>
  );
}
