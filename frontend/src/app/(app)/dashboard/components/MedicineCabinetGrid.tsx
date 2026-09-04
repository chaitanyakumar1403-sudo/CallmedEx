'use client';

import React, { useState } from 'react';
import { useFamilyHubStore, familyHubStore } from '@/store/useFamilyHubStore';
import { Pill, AlertTriangle, Plus, RotateCcw, X, Check } from 'lucide-react';

import { PATIENT_TRANSLATIONS, PatientLang } from '../patient/patientTranslations';

interface MedicineCabinetGridProps {
  lang?: PatientLang;
}

export const MedicineCabinetGrid: React.FC<MedicineCabinetGridProps> = ({ lang = 'en' }) => {
  const { medications } = useFamilyHubStore();
  const t = PATIENT_TRANSLATIONS[lang] || PATIENT_TRANSLATIONS.en;
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [medicineName, setMedicineName] = useState<string>('');
  const [dosage, setDosage] = useState<string>('');
  const [totalPills, setTotalPills] = useState<number>(30);
  const [remainingPills, setRemainingPills] = useState<number>(30);
  const [pillsPerDay, setPillsPerDay] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>('');

  const [refilling, setRefilling] = useState<string>('');

  /** The "Refill Needed" button was decorative: no handler, so the badge could
   *  be raised and never cleared. This resets the count to a full pack and
   *  re-anchors the server-side burn-down. */
  const handleRefill = async (med: (typeof medications)[number]) => {
    setRefilling(med.id);
    setMsg('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiBase}/api/v1/patient/medications/${med.id}/refill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ remaining_pills: med.totalPills }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg(err.detail || 'Could not record the refill.');
        return;
      }
      familyHubStore.setMedications(
        medications.map((m) =>
          m.id === med.id
            ? {
                ...m,
                remainingPills: med.totalPills,
                daysLeft: m.pillsPerDay > 0
                  ? Math.floor(med.totalPills / m.pillsPerDay)
                  : null,
                needsRefill: false,
                outOfStock: false,
              }
            : m,
        ),
      );
    } catch {
      setMsg('Network error recording the refill.');
    } finally {
      setRefilling('');
    }
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicineName.trim() || !dosage.trim()) {
      setMsg('Medicine name and dosage instructions are required.');
      return;
    }

    setIsSubmitting(true);
    setMsg('');

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiBase}/api/v1/patient/medications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          medicine_name: medicineName,
          dosage,
          total_pills: Number(totalPills),
          remaining_pills: Number(remainingPills),
          pills_per_day: Number(pillsPerDay),
        }),
      });

      const data = await res.json();
      if (res.ok && data.status === 'created' && data.medication?.id) {
        const newMed = {
          id: data.medication.id,
          medicineName: data.medication.medicine_name || medicineName,
          dosage: data.medication.dosage || dosage,
          totalPills: data.medication.total_pills ?? Number(totalPills),
          remainingPills: data.medication.remaining_pills ?? Number(remainingPills),
          pillsPerDay: data.medication.pills_per_day ?? Number(pillsPerDay),
          daysLeft: data.medication.days_left,
          needsRefill: data.medication.needs_refill,
          outOfStock: data.medication.out_of_stock,
        };
        familyHubStore.setMedications([...medications, newMed]);
        setShowAddModal(false);
        setMedicineName('');
        setDosage('');
        setTotalPills(30);
        setRemainingPills(30);
        setPillsPerDay(1);
      } else {
        setMsg(`Error: ${data.detail || 'Failed to add medication'}`);
      }
    } catch (err) {
      setMsg('Network error connecting to CallMedex server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        padding: '14px 16px',
        boxShadow: '0 4px 14px -6px rgba(15, 23, 42, 0.08)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Pill style={{ width: 15, height: 15, color: '#7c3aed' }} />
            {t.smartMedicineCabinet}
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#64748b' }}>
            {t.medicineCabinetSubtitle}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: 'none',
            background: '#7c3aed',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.76rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Plus style={{ width: 13, height: 13 }} /> {t.addMedication}
        </button>
      </div>

      {/* Add Medication Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              width: '90%',
              maxWidth: 440,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 800 }}>Add New Prescription</h4>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <form onSubmit={handleAddMedication} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Medicine Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol 500mg"
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Dosage Instructions *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1 tablet twice daily after meals"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Total Pills</label>
                  <input
                    type="number"
                    value={totalPills}
                    onChange={(e) => setTotalPills(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Remaining</label>
                  <input
                    type="number"
                    value={remainingPills}
                    onChange={(e) => setRemainingPills(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Pills/Day</label>
                  <input
                    type="number"
                    value={pillsPerDay}
                    onChange={(e) => setPillsPerDay(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {msg && <div style={{ fontSize: '0.8rem', color: '#dc2626' }}>{msg}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontSize: '0.82rem', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                >
                  {isSubmitting ? 'Saving...' : 'Save Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {medications.length === 0 ? (
        <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 10, border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155' }}>{t.noMedicationsTitle}</div>
          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2 }}>
            {t.noMedicationsBody}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
          {medications.map((med) => {
            // Prefer the server's projection. The local fallback divides the
            // stored count by the daily dose, which is exactly the figure that
            // stayed frozen at "5 days" for months because nothing decremented
            // it -- it is only used when the API predates the projection.
            const daysLeft = med.daysLeft ?? (
              med.pillsPerDay > 0
                ? Math.max(0, Math.floor(med.remainingPills / med.pillsPerDay))
                : 0
            );
            const percentRemaining = med.totalPills > 0
              ? Math.min(100, Math.round((med.remainingPills / med.totalPills) * 100))
              : 0;
            const isLow = med.needsRefill ?? daysLeft <= 5;

            return (
              <div
                key={med.id}
                style={{
                  background: med.outOfStock ? '#fef2f2' : isLow ? '#fffbeb' : '#f8fafc',
                  borderRadius: 10,
                  border: med.outOfStock
                    ? '1.5px solid #ef4444'
                    : isLow ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                  padding: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3, gap: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>{med.medicineName}</div>
                    {isLow && (
                      <span style={{ backgroundColor: med.outOfStock ? '#fee2e2' : '#fef3c7', color: med.outOfStock ? '#b91c1c' : '#b45309', padding: '1px 7px', borderRadius: 8, fontSize: '0.64rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                        <AlertTriangle style={{ width: 11, height: 11 }} />
                        {med.outOfStock ? 'Out of stock' : t.refillNeeded}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 8 }}>{med.dosage}</div>
                </div>

                <div>
                  {/* Horizontal Progress Bar */}
                  <div style={{ background: '#e2e8f0', height: 5, borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
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

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
                      <strong style={{ color: '#0f172a' }}>{med.remainingPills}</strong>/{med.totalPills} ({daysLeft} {t.daysSupplyRemaining})
                    </span>

                    <button
                      onClick={() => handleRefill(med)}
                      disabled={refilling === med.id}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 7,
                        border: 'none',
                        background: refilling === med.id ? '#a78bfa' : '#7c3aed',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: refilling === med.id ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <RotateCcw style={{ width: 11, height: 11 }} />
                      {refilling === med.id ? 'Saving…' : 'Mark refilled'}
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
