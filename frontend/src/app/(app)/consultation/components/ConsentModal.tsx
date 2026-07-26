/**
 * ConsentModal — NMC 2026 Digital Consent Capture
 * Required before starting any video consultation.
 */
'use client';

import { useState } from 'react';

interface ConsentModalProps {
  doctorName: string;
  onConsent: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConsentModal({ doctorName, onConsent, onCancel, isLoading }: ConsentModalProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderBottom: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🛡️</div>
          <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '1.4rem', fontWeight: 700 }}>
            Digital Consent Required
          </h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>
            NMC 2026 Telemedicine Guidelines
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '32px' }}>
          <h4 style={{ margin: '0 0 20px 0', color: '#334155', fontSize: '1.05rem', fontWeight: 600 }}>
            Before your consultation with <span style={{ color: '#0f4c81' }}>{doctorName}</span>, please confirm:
          </h4>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { text: <>I consent to a <strong>video-based telemedicine consultation</strong> as per NMC 2026 guidelines.</> },
              { text: <>I understand the session may be <strong>transcribed by AI</strong> for generating an accurate e-prescription.</> },
              { text: <>All prescriptions will use <strong>generic drug names</strong> per BIS mandate.</> },
              { text: <>My health data is processed under <strong>DPDP Act 2023</strong> protections and will not be shared without consent.</> },
              { text: <>This consultation is <strong>end-to-end encrypted</strong>. No recording is stored without explicit consent.</> }
            ].map((item, idx) => (
              <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ 
                  backgroundColor: '#dcfce7', color: '#16a34a', width: '24px', height: '24px', 
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0, marginTop: '2px'
                }}>✓</span>
                <span style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5' }}>{item.text}</span>
              </li>
            ))}
          </ul>

          {/* Checkbox Area */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onClick={() => setChecked(!checked)}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {}} // handled by onClick on wrapper
                style={{ width: '20px', height: '20px', accentColor: '#0f4c81', cursor: 'pointer' }}
              />
              <span style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: 600 }}>
                I have read and agree to the above terms. I give my digital consent for this telemedicine session.
              </span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '24px 32px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          gap: '16px',
          justifyContent: 'flex-end',
          backgroundColor: '#f8fafc'
        }}>
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: '12px 24px',
              backgroundColor: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              color: '#475569',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              flex: 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConsent}
            disabled={!checked || isLoading}
            style={{
              padding: '12px 24px',
              backgroundColor: (!checked || isLoading) ? '#94a3b8' : '#0f4c81',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontWeight: 600,
              cursor: (!checked || isLoading) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minWidth: '200px',
              flex: 2,
              boxShadow: (!checked || isLoading) ? 'none' : '0 4px 6px -1px rgba(15, 76, 129, 0.4)'
            }}
          >
            {isLoading ? 'Processing...' : '✅ I Agree & Join Call'}
          </button>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          padding: '12px',
          backgroundColor: '#f1f5f9',
          color: '#64748b',
          fontSize: '0.75rem',
          fontWeight: 500,
          borderTop: '1px solid #e2e8f0'
        }}>
          <span>🔒 Compliant with NMC 2026 · DPDP Act 2023 · FHIR R4</span>
        </div>
      </div>
    </div>
  );
}
