'use client';

import React from 'react';
import { useFamilyHubStore } from '@/store/useFamilyHubStore';
import { Pill, AlertTriangle, Plus, RotateCcw } from 'lucide-react';

export const MedicineCabinetGrid: React.FC = () => {
  const { medications } = useFamilyHubStore();

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 20,
        border: '1px solid #e2e8f0',
        padding: 24,
        boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pill style={{ width: 18, height: 18, color: '#7c3aed' }} />
            Smart Medicine Cabinet & Refill Radar
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Track active prescription pills, daily dosages, and refill dates.
          </p>
        </div>

        <button
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            color: '#334155',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Plus style={{ width: 14, height: 14 }} /> Add Medication
        </button>
      </div>

      {medications.length === 0 ? (
        <div style={{ padding: '24px', background: '#f8fafc', borderRadius: 14, border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
          <Pill style={{ width: 32, height: 32, color: '#94a3b8', margin: '0 auto 8px' }} />
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#334155', marginBottom: 4 }}>No Active Medications Recorded</div>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Click Add Medication above to track your active daily prescriptions and refill reminders.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {medications.map((med) => {
            const daysLeft = Math.max(0, Math.floor(med.remainingPills / med.pillsPerDay));
            const percentRemaining = Math.min(100, Math.round((med.remainingPills / med.totalPills) * 100));
            const isLow = daysLeft <= 5;

            return (
              <div
                key={med.id}
                style={{
                  background: isLow ? '#fffbeb' : '#f8fafc',
                  borderRadius: 14,
                  border: isLow ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>{med.medicineName}</div>
                    {isLow && (
                      <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle style={{ width: 12, height: 12 }} /> Refill Soon
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 12 }}>{med.dosage}</div>
                </div>

                <div>
                  {/* Horizontal Progress Bar */}
                  <div style={{ background: '#e2e8f0', height: 6, borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                    <div
                      style={{
                        width: `${percentRemaining}%`,
                        height: '100%',
                        background: isLow ? '#f59e0b' : '#7c3aed',
                        borderRadius: 999,
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                      <strong style={{ color: '#0f172a' }}>{med.remainingPills}</strong>/{med.totalPills} pills ({daysLeft} days left)
                    </span>

                    <button
                      style={{
                        padding: '4px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#7c3aed',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <RotateCcw style={{ width: 12, height: 12 }} /> Refill
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
