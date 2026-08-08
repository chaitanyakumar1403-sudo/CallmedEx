'use client';

import React, { useState } from 'react';
import { useHealthMatrixStore } from '@/store/useHealthMatrixStore';
import { FileText, Share2, QrCode, X, Sparkles } from 'lucide-react';

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
    <div className="cm-overlay" role="dialog" aria-modal="true" aria-labelledby="doctor-briefing-title">
      <div className="cm-modal">
        <div className="cm-modal__head">
          <h2 id="doctor-briefing-title" className="cm-modal__title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--cm-2)' }}>
            <Sparkles size={20} style={{ color: 'var(--cm-navy)' }} />
            AI Doctor Briefing Compiler
          </h2>
          <button type="button" className="cm-modal__x" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="cm-modal__body">
          <div className="cm-field">
            <span className="cm-field__label">Target Specialty Category</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--cm-2)', marginTop: 'var(--cm-2)' }}>
              {['Cardiology', 'Endocrinology', 'Gastroenterology', 'General Practice'].map((spec) => {
                const isSelected = specialty === spec;
                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => setSpecialty(spec)}
                    className="cm-btn cm-btn--sm"
                    style={{
                      border: isSelected ? '2px solid var(--cm-navy)' : '1px solid var(--cm-line-strong)',
                      background: isSelected ? 'var(--cm-active-bg)' : 'var(--cm-surface)',
                      color: isSelected ? 'var(--cm-navy)' : 'var(--cm-ink-2)',
                    }}
                  >
                    {spec}
                  </button>
                );
              })}
            </div>
          </div>

          {!activeBriefing ? (
            <div className="cm-empty">
              <span className="cm-empty__icon">
                <FileText size={20} />
              </span>
              <p className="cm-empty__body">
                Compiles ABHA records, lab trends, and current prescriptions into a 1-page clinical summary tailored for {specialty}.
              </p>
              <button
                type="button"
                onClick={handleCompile}
                disabled={isCompiling}
                className="cm-btn cm-btn--primary cm-empty__action"
              >
                {isCompiling ? 'Compiling…' : 'Compile Briefing'}
              </button>
            </div>
          ) : (
            <div>
              <div className="cm-card" style={{ marginBottom: 'var(--cm-4)' }}>
                <div style={{ fontWeight: 800, color: 'var(--cm-navy)', marginBottom: 'var(--cm-2)', textTransform: 'uppercase', fontSize: 'var(--cm-text-xs)', letterSpacing: '0.04em' }}>
                  {activeBriefing.specialtyType} Clinical Summary
                </div>

                <div style={{ marginBottom: 'var(--cm-2)' }}>
                  <strong style={{ color: 'var(--cm-ink)', fontSize: 'var(--cm-text-sm)' }}>Chief Observations</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 18, color: 'var(--cm-ink-2)', fontSize: 'var(--cm-text-sm)' }}>
                    {activeBriefing.chiefAnomalies.map((anom, idx) => (
                      <li key={idx}>{anom}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <strong style={{ color: 'var(--cm-ink)', fontSize: 'var(--cm-text-sm)' }}>Doctor Focus</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 18, color: 'var(--cm-ink-2)', fontSize: 'var(--cm-text-sm)' }}>
                    {activeBriefing.recommendedFocusPoints.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--cm-2)' }}>
                <button type="button" onClick={() => setShowQR(!showQR)} className="cm-btn cm-btn--secondary" style={{ flex: 1 }}>
                  <QrCode size={16} style={{ color: 'var(--cm-done)' }} /> {showQR ? 'Hide QR' : 'Doctor QR Code'}
                </button>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`CallMedex AI Doctor Briefing (${specialty}): Patient ID ${activeBriefing.patientId}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="cm-btn"
                  style={{ flex: 1, background: 'var(--cm-done)', color: '#fff', textDecoration: 'none' }}
                >
                  <Share2 size={16} /> Share WhatsApp
                </a>
              </div>

              {showQR && (
                <div className="cm-card" style={{ marginTop: 'var(--cm-3)', textAlign: 'center' }}>
                  <div style={{ width: 90, height: 90, margin: '0 auto 8px', border: '2px solid var(--cm-ink)', padding: 4, background: 'var(--cm-surface-2)', fontSize: 9, fontWeight: 700, wordBreak: 'break-all' }}>
                    [ABDM-QR-{activeBriefing.patientId.slice(0, 8)}]
                  </div>
                  <div style={{ fontSize: 'var(--cm-text-xs)', color: 'var(--cm-ink-3)' }}>Scan with clinic tablet for instant encrypted access</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
