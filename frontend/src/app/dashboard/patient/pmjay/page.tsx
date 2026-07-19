"use client";

import { useState } from 'react';

export default function PMJAYBooking() {
  const [abha, setAbha] = useState('');
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState('');

  const verifyCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Verifying AB-PMJAY eligibility via NHCX...');
    
    // Simulate NHCX Verification
    setTimeout(() => {
      setStatus('');
      setStep(2);
    }, 1500);
  };

  const confirmBooking = () => {
    setStatus('Processing 100% Cashless Booking...');
    setTimeout(() => {
      setStatus('');
      setStep(3);
    }, 2000);
  };

  return (
    <div style={{ backgroundColor: '#f0f4f8', minHeight: '100vh', padding: '40px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🏥</div>
          <h1 style={{ color: '#1a2b4a', margin: '0 0 10px 0' }}>Ayushman Bharat Booking</h1>
          <p style={{ color: '#4a5568', margin: '0' }}>Get 100% cashless diagnostics and consultations using your AB-PMJAY card.</p>
        </div>

        {/* Step 1: Verify */}
        {step === 1 && (
          <form onSubmit={verifyCard}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#2d3748', fontWeight: 'bold', marginBottom: '8px' }}>Enter ABHA Number</label>
              <input 
                required
                placeholder="12-3456-7890-1234" 
                value={abha}
                onChange={e => setAbha(e.target.value)}
                style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '16px' }}
              />
            </div>
            <button type="submit" style={{ width: '100%', padding: '15px', backgroundColor: '#38a169', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
              Verify Eligibility
            </button>
            {status && <p style={{ textAlign: 'center', color: '#3182ce', fontWeight: 'bold', marginTop: '15px' }}>{status}</p>}
          </form>
        )}

        {/* Step 2: Select Service */}
        {step === 2 && (
          <div>
            <div style={{ backgroundColor: '#f0fff4', border: '1px solid #9ae6b4', padding: '15px', borderRadius: '8px', marginBottom: '20px', color: '#2f855a', fontWeight: 'bold', textAlign: 'center' }}>
              ✅ AB-PMJAY Coverage Active (Limit: ₹5,00,000)
            </div>
            
            <h3 style={{ color: '#2d3748', marginBottom: '15px' }}>Select Cashless Service</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>
                <input type="radio" name="service" defaultChecked />
                <div>
                  <div style={{ fontWeight: 'bold', color: '#1a2b4a' }}>General Physician Video Consult</div>
                  <div style={{ fontSize: '14px', color: '#718096' }}>Free under PMJAY</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}>
                <input type="radio" name="service" />
                <div>
                  <div style={{ fontWeight: 'bold', color: '#1a2b4a' }}>Complete Blood Count (Home Collection)</div>
                  <div style={{ fontSize: '14px', color: '#718096' }}>Free under PMJAY</div>
                </div>
              </label>
            </div>

            <button onClick={confirmBooking} style={{ width: '100%', padding: '15px', backgroundColor: '#3182ce', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
              Confirm Cashless Booking
            </button>
            {status && <p style={{ textAlign: 'center', color: '#3182ce', fontWeight: 'bold', marginTop: '15px' }}>{status}</p>}
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '60px', marginBottom: '15px' }}>🎉</div>
            <h2 style={{ color: '#2f855a', margin: '0 0 10px 0' }}>Booking Confirmed!</h2>
            <p style={{ color: '#4a5568', marginBottom: '20px' }}>Your claim has been automatically submitted to NHCX. You will not be charged for this service.</p>
            <a href="/dashboard/patient" style={{ display: 'inline-block', padding: '10px 20px', backgroundColor: '#e2e8f0', color: '#4a5568', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
              Return to Dashboard
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
