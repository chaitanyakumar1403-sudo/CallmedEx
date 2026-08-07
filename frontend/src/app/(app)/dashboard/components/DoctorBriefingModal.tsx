'use client';

import React, { useState } from 'react';
import { useHealthMatrixStore } from '@/store/useHealthMatrixStore';
import { FileText, Share2, QrCode, X, Sparkles, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const DoctorBriefingModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { activeBriefing, setActiveBriefing } = useHealthMatrixStore();
  const [specialty, setSpecialty] = useState<string>('Cardiology');
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [showQR, setShowQR] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCompile = async () => {
    setIsCompiling(true);
    try {
      const res = await fetch('/api/v1/patient/biomarkers/doctor-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialty_type: specialty }),
      });
      const data = await res.json();
      if (data.briefing) {
        setActiveBriefing({
          specialtyType: data.briefing.specialty_type,
          patientId: data.briefing.patient_id,
          compiledAt: data.briefing.compiled_at,
          chiefAnomalies: data.briefing.chief_anomalies,
          activeMedicationsCount: data.briefing.active_medications_count,
          recentReportCount: data.briefing.recent_report_count,
          riskSummary: data.briefing.risk_summary,
          recommendedFocusPoints: data.briefing.recommended_focus_points,
        });
      }
    } catch (err) {
      console.error('Error generating briefing:', err);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '20px',
          width: '90%',
          maxWidth: '520px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1f2937', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles style={{ width: 20, height: 20, color: '#4f46e5' }} />
            AI Doctor Briefing Compiler
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}
          >
            &times;
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
            Target Specialty Category
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {['Cardiology', 'Endocrinology', 'Gastroenterology', 'General Practice'].map((spec) => (
              <button
                key={spec}
                onClick={() => setSpecialty(spec)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: specialty === spec ? '2px solid #4f46e5' : '1px solid #d1d5db',
                  background: specialty === spec ? '#eef2ff' : '#fff',
                  color: specialty === spec ? '#4338ca' : '#374151',
                  fontWeight: specialty === spec ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        {!activeBriefing ? (
          <div style={{ padding: 24, background: '#f8fafc', borderRadius: 14, border: '1px dashed #cbd5e1', textAlign: 'center', marginBottom: 20 }}>
            <FileText style={{ width: 36, height: 36, color: '#94a3b8', margin: '0 auto 8px' }} />
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
              Compiles ABHA records, lab anomalies, and current prescriptions into a 1-page clinical summary tailored for {specialty}.
            </p>
            <button
              onClick={handleCompile}
              disabled={isCompiling}
              style={{
                marginTop: 16,
                padding: '10px 24px',
                borderRadius: 10,
                border: 'none',
                backgroundColor: '#4f46e5',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: isCompiling ? 'not-allowed' : 'pointer',
              }}
            >
              {isCompiling ? 'Compiling AI Summary...' : 'Compile Briefing PDF'}
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0', fontSize: '0.85rem', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#4338ca', marginBottom: 8, textTransform: 'uppercase', fontSize: '0.78rem' }}>
                {activeBriefing.specialtyType} Clinical Summary
              </div>

              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: '#334155' }}>Chief Observations:</strong>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: 18, color: '#475569' }}>
                  {activeBriefing.chiefAnomalies.map((anom, idx) => (
                    <li key={idx}>{anom}</li>
                  ))}
                </ul>
              </div>

              <div>
                <strong style={{ color: '#334155' }}>Doctor Focus:</strong>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: 18, color: '#475569' }}>
                  {activeBriefing.recommendedFocusPoints.map((pt, idx) => (
                    <li key={idx}>{pt}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowQR(!showQR)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <QrCode style={{ width: 16, height: 16, color: '#059669' }} /> {showQR ? 'Hide QR' : 'Doctor QR Code'}
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(`CallMedex AI Doctor Briefing (${specialty}): Patient ID ${activeBriefing.patientId}`)}`}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Share2 style={{ width: 16, height: 16 }} /> Share WhatsApp
              </a>
            </div>

            {showQR && (
              <div style={{ marginTop: 12, padding: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ width: 90, height: 90, margin: '0 auto 8px', border: '2px solid #0f172a', padding: 4, background: '#f8fafc', fontSize: '9px', fontWeight: 'bold', wordBreak: 'break-all' }}>
                  [ABDM-QR-{activeBriefing.patientId.slice(0, 8)}]
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Scan with clinic tablet for instant encrypted access</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
