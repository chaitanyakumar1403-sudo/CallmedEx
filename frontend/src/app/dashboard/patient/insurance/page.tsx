"use client";

import { useState } from 'react';

export default function NHCXInsuranceDashboard() {
  const [abha, setAbha] = useState('');
  const [status, setStatus] = useState('');
  const [eligibility, setEligibility] = useState<any>(null);

  const checkEligibility = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Querying NHCX Sandbox...');
    setEligibility(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:8000/api/insurance/eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ abha_number: abha })
      });
      const data = await res.json();
      if (res.ok) {
        setEligibility(data.data);
        setStatus('');
      } else {
        setStatus(`Error: ${data.detail}`);
      }
    } catch (err) {
      setStatus('Network Error');
    }
  };

  return (
    <div style={{ backgroundColor: '#f7fafc', minHeight: '100vh', padding: '40px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ color: '#1a2b4a', marginBottom: '10px' }}>NHCX Insurance Hub</h1>
        <p style={{ color: '#4a5568', marginBottom: '30px' }}>Verify your active health insurance policies securely via the National Health Claims Exchange (NHCX).</p>

        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h2 style={{ color: '#2d3748', margin: '0 0 20px 0' }}>Pre-Consultation Eligibility Check</h2>
          
          <form onSubmit={checkEligibility} style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <input 
              required
              placeholder="Enter ABHA Number (e.g. 12-3456-7890-1234)" 
              value={abha}
              onChange={e => setAbha(e.target.value)}
              style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '16px' }}
            />
            <button type="submit" style={{ padding: '12px 25px', backgroundColor: '#3182ce', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              Verify Coverage
            </button>
          </form>

          {status && <p style={{ color: '#718096', fontWeight: 'bold' }}>{status}</p>}

          {eligibility && (
            <div style={{ padding: '20px', backgroundColor: eligibility.eligible ? '#f0fff4' : '#fff5f5', border: `1px solid ${eligibility.eligible ? '#c6f6d5' : '#fed7d7'}`, borderRadius: '8px' }}>
              {eligibility.eligible ? (
                <>
                  <h3 style={{ margin: '0 0 15px 0', color: '#2f855a' }}>✅ Active Coverage Found</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <p style={{ margin: '0', fontSize: '12px', color: '#4a5568', textTransform: 'uppercase' }}>Insurer</p>
                      <p style={{ margin: '5px 0 0 0', fontWeight: 'bold', color: '#2d3748' }}>{eligibility.insurer_name}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0', fontSize: '12px', color: '#4a5568', textTransform: 'uppercase' }}>Coverage Limit</p>
                      <p style={{ margin: '5px 0 0 0', fontWeight: 'bold', color: '#2d3748' }}>₹{eligibility.coverage_limit.toLocaleString()}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0', fontSize: '12px', color: '#4a5568', textTransform: 'uppercase' }}>Co-Pay</p>
                      <p style={{ margin: '5px 0 0 0', fontWeight: 'bold', color: '#2d3748' }}>{eligibility.co_pay_percentage}%</p>
                    </div>
                  </div>
                  <button style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#38a169', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Book Cashless Appointment
                  </button>
                </>
              ) : (
                <h3 style={{ margin: '0', color: '#c53030' }}>❌ {eligibility.reason}</h3>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
