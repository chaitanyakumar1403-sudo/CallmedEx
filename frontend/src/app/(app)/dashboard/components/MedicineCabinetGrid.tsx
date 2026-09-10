'use client';

import React, { useState } from 'react';
import { useFamilyHubStore, familyHubStore } from '@/store/useFamilyHubStore';
import { Pill, AlertTriangle, Plus, RotateCcw, X, Check, Clock, Bell, BellRing } from 'lucide-react';
import Clinical3DIcon from '@/components/ui/Clinical3DIcon';
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
  const [reminderFrequency, setReminderFrequency] = useState<string>('twice_daily');
  const [reminderTimes, setReminderTimes] = useState<string[]>(['09:00', '21:00']);
  const [enableNotifications, setEnableNotifications] = useState<boolean>(false);
  const [notificationGranted, setNotificationGranted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>('');
  const [refilling, setRefilling] = useState<string>('');

  // Handle Dose Reminder Frequency Switch
  const handleFrequencyChange = (freq: string) => {
    setReminderFrequency(freq);
    if (freq === 'once_daily') {
      setPillsPerDay(1);
      setReminderTimes(['09:00']);
    } else if (freq === 'twice_daily') {
      setPillsPerDay(2);
      setReminderTimes(['09:00', '21:00']);
    } else if (freq === 'thrice_daily') {
      setPillsPerDay(3);
      setReminderTimes(['08:00', '14:00', '20:00']);
    } else if (freq === 'custom') {
      setReminderTimes(['09:00']);
    }
  };

  const handleCustomTimeChange = (index: number, newTime: string) => {
    const updated = [...reminderTimes];
    updated[index] = newTime;
    setReminderTimes(updated);
  };

  const addCustomTime = () => {
    if (reminderTimes.length < 5) {
      setReminderTimes([...reminderTimes, '12:00']);
      setPillsPerDay(reminderTimes.length + 1);
    }
  };

  const removeCustomTime = (index: number) => {
    if (reminderTimes.length > 1) {
      const updated = reminderTimes.filter((_, i) => i !== index);
      setReminderTimes(updated);
      setPillsPerDay(updated.length);
    }
  };

  const handleToggleNotifications = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationGranted(true);
        setEnableNotifications(true);
      } else {
        setEnableNotifications(false);
        setMsg('Please enable browser notification permissions to receive dose alarms.');
      }
    } else {
      setMsg('Web Notifications are not supported in this browser environment.');
    }
  };

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
          reminder_frequency: reminderFrequency,
          reminder_times: reminderTimes,
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
          reminderFrequency: data.medication.reminder_frequency || reminderFrequency,
          reminderTimes: data.medication.reminder_times || reminderTimes,
        };
        familyHubStore.setMedications([...medications, newMed]);
        setShowAddModal(false);
        setMedicineName('');
        setDosage('');
        setTotalPills(30);
        setRemainingPills(30);
        setPillsPerDay(1);
        setReminderFrequency('twice_daily');
        setReminderTimes(['09:00', '21:00']);
      } else {
        setMsg(`Error: ${data.detail || 'Failed to add medication'}`);
      }
    } catch {
      setMsg('Network error connecting to CallMedex server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatScheduleLabel = (med: any) => {
    const times = med.reminderTimes || (med.pillsPerDay === 2 ? ['09:00', '21:00'] : ['09:00']);
    const freqName = med.reminderFrequency === 'twice_daily' ? 'Twice daily'
      : med.reminderFrequency === 'thrice_daily' ? '3x daily'
      : med.reminderFrequency === 'custom' ? 'Custom'
      : `${med.pillsPerDay} pill/day`;
    return `${freqName} (${times.join(', ')})`;
  };

  return (
    <div
      id="medicine-cabinet"
      className="card cm-panel"
      style={{
        padding: '16px 20px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--cm-ink)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pill style={{ width: 17, height: 17, color: 'var(--cm-active)' }} />
            {t.smartMedicineCabinet}
          </h3>
          <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--cm-ink-3)' }}>
            {t.medicineCabinetSubtitle}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--cm-radius)',
            border: 'none',
            background: 'var(--cm-active)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
            transition: 'all 0.2s ease',
          }}
        >
          <Plus style={{ width: 14, height: 14 }} /> {t.addMedication}
        </button>
      </div>

      {/* Add Medication Modal with Dose Reminders */}
      {showAddModal && (
        <div className="cm-modal-backdrop">
          <div className="cm-modal-glass-dialog">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid var(--cm-line)', paddingBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--cm-ink)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clinical3DIcon name="medicine-3d" size={28} glow />
                Add Medication &amp; Dose Reminder
              </h4>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cm-ink-3)', padding: 4 }}
                aria-label="Close"
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <form onSubmit={handleAddMedication} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--cm-ink)', display: 'block', marginBottom: 5 }}>
                  Medicine Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol 500mg, Atorvastatin 20mg"
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--cm-line)', background: 'var(--cm-surface-2)', color: 'var(--cm-ink)', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--cm-ink)', display: 'block', marginBottom: 5 }}>
                  Dosage Instructions *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1 tablet after meals"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--cm-line)', background: 'var(--cm-surface-2)', color: 'var(--cm-ink)', fontSize: '0.85rem' }}
                  required
                />
              </div>

              {/* Dose Schedule Selector */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--cm-ink)', display: 'block', marginBottom: 6 }}>
                  Dose Reminder Frequency
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleFrequencyChange('once_daily')}
                    style={{
                      padding: '8px 10px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                      border: reminderFrequency === 'once_daily' ? '2px solid var(--cm-active)' : '1px solid var(--cm-line)',
                      background: reminderFrequency === 'once_daily' ? 'var(--cm-active-surface)' : 'var(--cm-surface-2)',
                      color: reminderFrequency === 'once_daily' ? 'var(--cm-active)' : 'var(--cm-ink-2)',
                    }}
                  >
                    Once a day (09:00 AM)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFrequencyChange('twice_daily')}
                    style={{
                      padding: '8px 10px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                      border: reminderFrequency === 'twice_daily' ? '2px solid var(--cm-active)' : '1px solid var(--cm-line)',
                      background: reminderFrequency === 'twice_daily' ? 'var(--cm-active-surface)' : 'var(--cm-surface-2)',
                      color: reminderFrequency === 'twice_daily' ? 'var(--cm-active)' : 'var(--cm-ink-2)',
                    }}
                  >
                    Twice a day (09 AM, 09 PM)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFrequencyChange('thrice_daily')}
                    style={{
                      padding: '8px 10px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                      border: reminderFrequency === 'thrice_daily' ? '2px solid var(--cm-active)' : '1px solid var(--cm-line)',
                      background: reminderFrequency === 'thrice_daily' ? 'var(--cm-active-surface)' : 'var(--cm-surface-2)',
                      color: reminderFrequency === 'thrice_daily' ? 'var(--cm-active)' : 'var(--cm-ink-2)',
                    }}
                  >
                    3x a day (08, 14, 20)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFrequencyChange('custom')}
                    style={{
                      padding: '8px 10px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                      border: reminderFrequency === 'custom' ? '2px solid var(--cm-active)' : '1px solid var(--cm-line)',
                      background: reminderFrequency === 'custom' ? 'var(--cm-active-surface)' : 'var(--cm-surface-2)',
                      color: reminderFrequency === 'custom' ? 'var(--cm-active)' : 'var(--cm-ink-2)',
                    }}
                  >
                    Custom Dose Times
                  </button>
                </div>
              </div>

              {/* Custom Time Pickers */}
              {reminderFrequency === 'custom' && (
                <div style={{ background: 'var(--cm-surface-2)', padding: 12, borderRadius: 8, border: '1px solid var(--cm-line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--cm-ink-2)' }}>Set Custom Times</span>
                    {reminderTimes.length < 5 && (
                      <button
                        type="button"
                        onClick={addCustomTime}
                        style={{ background: 'none', border: 'none', color: 'var(--cm-active)', fontWeight: 700, fontSize: '0.74rem', cursor: 'pointer' }}
                      >
                        + Add Time
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {reminderTimes.map((time, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => handleCustomTimeChange(idx, e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--cm-line)', fontSize: '0.78rem', background: 'var(--cm-surface)', color: 'var(--cm-ink)' }}
                        />
                        {reminderTimes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCustomTime(idx)}
                            style={{ background: 'none', border: 'none', color: 'var(--cm-urgent)', cursor: 'pointer', padding: 2 }}
                          >
                            <X style={{ width: 12, height: 12 }} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Web Notification Permission Prompt */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8,
                background: enableNotifications ? 'var(--cm-done-surface)' : 'var(--cm-surface-2)',
                border: `1px solid ${enableNotifications ? 'var(--cm-done-line)' : 'var(--cm-line)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {enableNotifications ? (
                    <BellRing style={{ width: 16, height: 16, color: 'var(--cm-done)' }} />
                  ) : (
                    <Bell style={{ width: 16, height: 16, color: 'var(--cm-ink-3)' }} />
                  )}
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--cm-ink)' }}>
                      Tablet Alarm Notifications
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--cm-ink-3)' }}>
                      Alert me at dose times automatically
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  style={{
                    padding: '5px 12px', borderRadius: 999, border: 'none',
                    background: enableNotifications ? 'var(--cm-done)' : 'var(--cm-active)',
                    color: '#ffffff', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  {enableNotifications ? 'Enabled' : 'Enable Alarms'}
                </button>
              </div>

              {/* Pill Counts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cm-ink-2)', display: 'block', marginBottom: 4 }}>Total Pack</label>
                  <input
                    type="number"
                    value={totalPills}
                    onChange={(e) => setTotalPills(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--cm-line)', background: 'var(--cm-surface-2)', color: 'var(--cm-ink)', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cm-ink-2)', display: 'block', marginBottom: 4 }}>Remaining</label>
                  <input
                    type="number"
                    value={remainingPills}
                    onChange={(e) => setRemainingPills(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--cm-line)', background: 'var(--cm-surface-2)', color: 'var(--cm-ink)', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--cm-ink-2)', display: 'block', marginBottom: 4 }}>Pills/Day</label>
                  <input
                    type="number"
                    value={pillsPerDay}
                    onChange={(e) => setPillsPerDay(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--cm-line)', background: 'var(--cm-surface-2)', color: 'var(--cm-ink)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {msg && <div style={{ fontSize: '0.8rem', color: 'var(--cm-urgent)' }}>{msg}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--cm-line)', background: 'var(--cm-surface-2)', color: 'var(--cm-ink)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--cm-active)', color: '#ffffff', fontSize: '0.82rem', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                >
                  {isSubmitting ? 'Saving...' : 'Save Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Medication Cards */}
      {medications.length === 0 ? (
        <div style={{ padding: '20px', background: 'var(--cm-surface-2)', borderRadius: 10, border: '1px dashed var(--cm-line)', textAlign: 'center', color: 'var(--cm-ink-3)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--cm-ink)' }}>{t.noMedicationsTitle}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--cm-ink-3)', marginTop: 4 }}>
            {t.noMedicationsBody}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {medications.map((med) => {
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
                  background: med.outOfStock ? 'var(--cm-urgent-surface)' : isLow ? 'var(--cm-warn-surface, #fef9c3)' : 'var(--cm-surface)',
                  borderRadius: 'var(--cm-radius)',
                  border: med.outOfStock
                    ? '1.5px solid var(--cm-urgent-line)'
                    : isLow ? '1.5px solid var(--cm-warn-line, #fde047)' : '1px solid var(--cm-line)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--cm-shadow-1)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 6 }}>
                    <div style={{ fontFamily: 'var(--cm-font-display)', fontWeight: 700, letterSpacing: '-0.01em', fontSize: '0.88rem', color: 'var(--cm-ink)' }}>{med.medicineName}</div>
                    {isLow && (
                      <span style={{
                        backgroundColor: med.outOfStock ? 'var(--cm-urgent-surface)' : '#fef3c7',
                        color: med.outOfStock ? 'var(--cm-urgent)' : '#b45309',
                        padding: '2px 8px', borderRadius: 8, fontSize: '0.66rem', fontWeight: 600,
                        letterSpacing: '0.02em',
                        display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                      }}>
                        <AlertTriangle style={{ width: 11, height: 11 }} />
                        {med.outOfStock ? 'Out of stock' : t.refillNeeded}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--cm-ink-3)', marginBottom: 6 }}>{med.dosage}</div>

                  {/* Schedule Indicator */}
                  <div style={{
                    fontSize: '0.7rem', fontWeight: 600, color: 'var(--cm-active)',
                    display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10,
                  }}>
                    <Clock style={{ width: 12, height: 12 }} />
                    <span>{formatScheduleLabel(med)}</span>
                  </div>
                </div>

                <div>
                  {/* Horizontal Progress Bar */}
                  <div style={{ background: 'var(--cm-surface-2)', height: 6, borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                    <div
                      style={{
                        width: `${percentRemaining}%`,
                        height: '100%',
                        background: isLow ? 'var(--cm-urgent)' : 'var(--cm-active)',
                        borderRadius: 999,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--cm-ink-2)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      <strong style={{ color: 'var(--cm-ink)', fontVariantNumeric: 'tabular-nums' }}>{med.remainingPills}</strong>/{med.totalPills} ({daysLeft} {t.daysSupplyRemaining})
                    </span>

                    <button
                      onClick={() => handleRefill(med)}
                      disabled={refilling === med.id}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: refilling === med.id ? 'var(--cm-line-strong)' : 'var(--cm-active)',
                        color: '#ffffff',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        letterSpacing: '-0.005em',
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
