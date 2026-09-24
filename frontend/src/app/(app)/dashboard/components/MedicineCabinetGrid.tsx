'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { useFamilyHubStore, familyHubStore, MedicationItem } from '@/store/useFamilyHubStore';
import { customConfirm } from '@/lib/customConfirm';
import { Pill, Plus, RotateCcw, X, Clock, Bell, BellRing, Pencil, Trash2 } from 'lucide-react';
import { PATIENT_TRANSLATIONS, PatientLang } from '../patient/patientTranslations';

interface MedicineCabinetGridProps {
  lang?: PatientLang;
}

const PRESET_TIMES: Record<string, string[]> = {
  once_daily: ['09:00'],
  twice_daily: ['09:00', '21:00'],
  thrice_daily: ['08:00', '14:00', '20:00'],
};

const FREQ_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'once_daily', label: 'Once a day', hint: '9 AM' },
  { key: 'twice_daily', label: 'Twice a day', hint: '9 AM · 9 PM' },
  { key: 'thrice_daily', label: '3 times a day', hint: '8 AM · 2 PM · 8 PM' },
  { key: 'custom', label: 'Custom times', hint: 'Set your own' },
];

const apiBase = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
});

/** "21:00" -> "9 PM", "08:30" -> "8:30 AM". */
const prettyTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
};

const timesFor = (med: MedicationItem) =>
  med.reminderTimes?.length ? med.reminderTimes
    : PRESET_TIMES[med.reminderFrequency || ''] || (med.pillsPerDay === 3 ? PRESET_TIMES.thrice_daily
      : med.pillsPerDay === 2 ? PRESET_TIMES.twice_daily : PRESET_TIMES.once_daily);

const fromServer = (m: any, fallback: Partial<MedicationItem> = {}): MedicationItem => ({
  id: m.id,
  medicineName: m.medicine_name ?? fallback.medicineName ?? '',
  dosage: m.dosage ?? fallback.dosage ?? '',
  totalPills: m.total_pills ?? fallback.totalPills ?? 0,
  remainingPills: m.remaining_pills ?? fallback.remainingPills ?? 0,
  pillsPerDay: m.pills_per_day ?? fallback.pillsPerDay ?? 1,
  refillDate: m.refill_date,
  daysLeft: m.days_left,
  needsRefill: m.needs_refill,
  outOfStock: m.out_of_stock,
  reminderFrequency: m.reminder_frequency || fallback.reminderFrequency,
  reminderTimes: m.reminder_times?.length ? m.reminder_times : fallback.reminderTimes,
});

type Draft = {
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  perDose: number;
  total: number;
  remaining: number;
};

const EMPTY_DRAFT: Draft = {
  name: '', dosage: '', frequency: 'twice_daily', times: PRESET_TIMES.twice_daily,
  perDose: 1, total: 30, remaining: 30,
};

export const MedicineCabinetGrid: React.FC<MedicineCabinetGridProps> = ({ lang = 'en' }) => {
  const { medications } = useFamilyHubStore();
  const t = PATIENT_TRANSLATIONS[lang] || PATIENT_TRANSLATIONS.en;

  // null = closed, '' = adding, id = editing that medicine
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState('');

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  // The daily burn rate is tablets per dose times doses a day. It used to be
  // the dose count alone, so "2 tablets twice a day" ran down at 2 a day, not 4.
  const pillsPerDay = Math.max(1, draft.perDose) * draft.times.length;

  const openAdd = () => {
    setDraft(EMPTY_DRAFT);
    setMsg('');
    setEditingId('');
  };

  const openEdit = (med: MedicationItem) => {
    const times = timesFor(med);
    const perDose = med.pillsPerDay > 0 && med.pillsPerDay % times.length === 0
      ? med.pillsPerDay / times.length : 1;
    setDraft({
      name: med.medicineName,
      dosage: med.dosage,
      frequency: med.reminderFrequency && (med.reminderFrequency === 'custom' || PRESET_TIMES[med.reminderFrequency])
        ? med.reminderFrequency
        : times.length === 3 ? 'thrice_daily' : times.length === 2 ? 'twice_daily' : times.length === 1 ? 'once_daily' : 'custom',
      times,
      perDose,
      total: med.totalPills,
      remaining: med.remainingPills,
    });
    setMsg('');
    setEditingId(med.id);
  };

  const close = () => setEditingId(null);

  const handleFrequencyChange = (freq: string) =>
    set({ frequency: freq, times: PRESET_TIMES[freq] || (draft.frequency === 'custom' ? draft.times : ['09:00']) });

  const handleToggleNotifications = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setEnableNotifications(permission === 'granted');
      if (permission !== 'granted') setMsg('Allow notifications in your browser to get dose reminders.');
    } else {
      setMsg('This browser does not support notifications.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.dosage.trim()) {
      setMsg('Please enter the medicine name and how to take it.');
      return;
    }
    if (draft.total < 1 || draft.remaining < 0 || draft.remaining > draft.total) {
      setMsg('Tablets left must be between 0 and the pack size.');
      return;
    }
    setIsSubmitting(true);
    setMsg('');
    const body = {
      medicine_name: draft.name.trim(),
      dosage: draft.dosage.trim(),
      total_pills: Number(draft.total),
      remaining_pills: Number(draft.remaining),
      pills_per_day: pillsPerDay,
      reminder_frequency: draft.frequency,
      reminder_times: draft.times,
    };
    const isEdit = !!editingId;
    try {
      const res = await fetch(
        `${apiBase()}/api/v1/patient/medications${isEdit ? `/${editingId}` : ''}`,
        { method: isEdit ? 'PATCH' : 'POST', headers: authHeaders(), body: JSON.stringify(body) },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.medication?.id) {
        setMsg(data.detail || 'Could not save this medicine. Please try again.');
        return;
      }
      const saved = fromServer(data.medication, {
        medicineName: body.medicine_name, dosage: body.dosage, totalPills: body.total_pills,
        remainingPills: body.remaining_pills, pillsPerDay: body.pills_per_day,
        reminderFrequency: body.reminder_frequency, reminderTimes: body.reminder_times,
      });
      familyHubStore.setMedications(
        isEdit ? medications.map((m) => (m.id === editingId ? saved : m)) : [...medications, saved],
      );
      toast.success(isEdit ? `${saved.medicineName} updated` : `${saved.medicineName} added`);
      close();
    } catch {
      setMsg('Could not reach CallMedex. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefill = async (med: MedicationItem) => {
    setBusyId(med.id);
    try {
      const res = await fetch(`${apiBase()}/api/v1/patient/medications/${med.id}/refill`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ remaining_pills: med.totalPills }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Could not record the refill.');
        return;
      }
      familyHubStore.setMedications(
        medications.map((m) => m.id === med.id ? {
          ...m,
          remainingPills: med.totalPills,
          daysLeft: m.pillsPerDay > 0 ? Math.floor(med.totalPills / m.pillsPerDay) : null,
          needsRefill: false,
          outOfStock: false,
        } : m),
      );
      toast.success(`${med.medicineName} marked as refilled`);
    } catch {
      toast.error('Could not reach CallMedex. Please try again.');
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async (med: MedicationItem) => {
    if (!await customConfirm(`Remove ${med.medicineName} from your medicines? Its reminders will stop.`)) return;
    setBusyId(med.id);
    try {
      const res = await fetch(`${apiBase()}/api/v1/patient/medications/${med.id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Could not remove this medicine.');
        return;
      }
      familyHubStore.setMedications(medications.filter((m) => m.id !== med.id));
      toast.success(`${med.medicineName} removed`);
    } catch {
      toast.error('Could not reach CallMedex. Please try again.');
    } finally {
      setBusyId('');
    }
  };

  const scheduleLabel = (med: MedicationItem) => {
    const times = timesFor(med);
    const doses = times.length;
    const freq = doses === 1 ? 'Once a day' : doses === 2 ? 'Twice a day' : `${doses} times a day`;
    return `${freq} · ${times.map(prettyTime).join(', ')}`;
  };

  return (
    <div id="medicine-cabinet" className="card cm-panel cm-med cm-psec">
      <div className="cm-med__head">
        <div>
          <h3 className="cm-med__title">
            <span className="cm-icon3d" aria-hidden><Pill size={19} /></span> {t.smartMedicineCabinet}
          </h3>
          <p className="cm-med__sub">{t.medicineCabinetSubtitle}</p>
        </div>
        <button type="button" onClick={openAdd} className="cm-btn cm-btn--primary cm-btn--sm">
          <Plus size={14} /> {t.addMedication}
        </button>
      </div>

      {editingId !== null && (
        <div className="cm-modal-backdrop" onClick={close}>
          <div
            className="cm-modal-glass-dialog cm-med-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="med-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-med-dialog__head">
              <h4 id="med-dialog-title">{editingId ? 'Edit medicine' : 'Add a medicine'}</h4>
              <button type="button" onClick={close} className="cm-modal__x" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="cm-med-form">
              <label className="cm-med-field">
                <span>Medicine name</span>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol 500 mg"
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  required
                />
              </label>

              <label className="cm-med-field">
                <span>How to take it</span>
                <input
                  type="text"
                  placeholder="e.g. After food"
                  value={draft.dosage}
                  onChange={(e) => set({ dosage: e.target.value })}
                  required
                />
              </label>

              <fieldset className="cm-med-field">
                <legend>How often</legend>
                <div className="cm-med-freq">
                  {FREQ_OPTIONS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={draft.frequency === f.key}
                      onClick={() => handleFrequencyChange(f.key)}
                      className={`cm-med-freq__opt${draft.frequency === f.key ? ' is-on' : ''}`}
                    >
                      <strong>{f.label}</strong>
                      <small>{f.hint}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              {draft.frequency === 'custom' && (
                <div className="cm-med-times">
                  {draft.times.map((time, idx) => (
                    <div key={idx} className="cm-med-times__row">
                      <input
                        type="time"
                        value={time}
                        aria-label={`Dose ${idx + 1} time`}
                        onChange={(e) => set({ times: draft.times.map((x, i) => (i === idx ? e.target.value : x)) })}
                      />
                      {draft.times.length > 1 && (
                        <button
                          type="button"
                          className="cm-btn cm-btn--ghost cm-btn--sm cm-btn--icon"
                          aria-label={`Remove dose ${idx + 1}`}
                          onClick={() => set({ times: draft.times.filter((_, i) => i !== idx) })}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {draft.times.length < 5 && (
                    <button
                      type="button"
                      className="cm-btn cm-btn--ghost cm-btn--sm"
                      onClick={() => set({ times: [...draft.times, '12:00'] })}
                    >
                      <Plus size={14} /> Add a time
                    </button>
                  )}
                </div>
              )}

              <div className="cm-med-grid3">
                <label className="cm-med-field">
                  <span>Tablets per dose</span>
                  <input type="number" min={1} value={draft.perDose}
                    onChange={(e) => set({ perDose: Math.max(1, Number(e.target.value) || 1) })} />
                </label>
                <label className="cm-med-field">
                  <span>Pack size</span>
                  <input type="number" min={1} value={draft.total}
                    onChange={(e) => set({ total: Number(e.target.value) })} />
                </label>
                <label className="cm-med-field">
                  <span>Tablets left now</span>
                  <input type="number" min={0} value={draft.remaining}
                    onChange={(e) => set({ remaining: Number(e.target.value) })} />
                </label>
              </div>
              <p className="cm-med-hint">
                {pillsPerDay} tablet{pillsPerDay === 1 ? '' : 's'} a day
                {draft.remaining > 0 && ` · lasts about ${Math.floor(draft.remaining / pillsPerDay)} day${Math.floor(draft.remaining / pillsPerDay) === 1 ? '' : 's'}`}
              </p>

              <div className={`cm-med-notify${enableNotifications ? ' is-on' : ''}`}>
                {enableNotifications ? <BellRing size={16} /> : <Bell size={16} />}
                <div>
                  <strong>Dose reminders</strong>
                  <small>Get a notification at each dose time</small>
                </div>
                <button type="button" onClick={handleToggleNotifications} className="cm-btn cm-btn--secondary cm-btn--sm"
                  disabled={enableNotifications}>
                  {enableNotifications ? 'On' : 'Turn on'}
                </button>
              </div>

              {msg && <div className="cm-med-error" role="alert">{msg}</div>}

              <div className="cm-med-actions">
                <button type="button" onClick={close} className="cm-btn cm-btn--secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="cm-btn cm-btn--primary">
                  {isSubmitting ? 'Saving…' : editingId ? 'Save changes' : 'Add medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {medications.length === 0 ? (
        <div className="cm-med-empty">
          <strong>{t.noMedicationsTitle}</strong>
          <span>{t.noMedicationsBody}</span>
        </div>
      ) : (
        <div className="cm-med-list">
          {medications.map((med) => {
            const daysLeft = med.daysLeft ?? (
              med.pillsPerDay > 0 ? Math.max(0, Math.floor(med.remainingPills / med.pillsPerDay)) : 0
            );
            const percent = med.totalPills > 0
              ? Math.min(100, Math.round((med.remainingPills / med.totalPills) * 100)) : 0;
            const isLow = med.needsRefill ?? daysLeft <= 5;
            const tone = med.outOfStock ? 'out' : isLow ? 'low' : 'ok';
            const busy = busyId === med.id;

            return (
              <article key={med.id} className={`cm-med-card cm-med-card--${tone}`}>
                <div className="cm-med-card__top">
                  <div className="cm-med-card__name">{med.medicineName}</div>
                  <div className="cm-med-card__tools">
                    <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm cm-btn--icon"
                      aria-label={`Edit ${med.medicineName}`} title="Edit" onClick={() => openEdit(med)} disabled={busy}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="cm-btn cm-btn--ghost cm-btn--sm cm-btn--icon cm-med-card__del"
                      aria-label={`Remove ${med.medicineName}`} title="Remove" onClick={() => handleDelete(med)} disabled={busy}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {med.dosage && <div className="cm-med-card__dosage">{med.dosage}</div>}
                <div className="cm-med-card__sched">
                  <Clock size={12} aria-hidden /> {scheduleLabel(med)}
                </div>

                {isLow && (
                  <span className={`cm-pill ${med.outOfStock ? 'cm-pill--urgent' : 'cm-pill--waiting'} cm-med-card__badge`}>
                    {med.outOfStock ? 'Supply finished · refill now' : t.refillNeeded}
                  </span>
                )}

                <div className="cm-med-card__bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}
                  aria-label={`${med.remainingPills} of ${med.totalPills} tablets left`}>
                  <span style={{ width: `${percent}%` }} />
                </div>

                <div className="cm-med-card__foot">
                  <span className="cm-med-card__supply">
                    <strong>{med.remainingPills}</strong> of {med.totalPills} left · {daysLeft} day{daysLeft === 1 ? '' : 's'}
                  </span>
                  <button type="button" onClick={() => handleRefill(med)} disabled={busy}
                    className="cm-btn cm-btn--secondary cm-btn--sm">
                    <RotateCcw size={13} /> {busy ? 'Saving…' : 'Mark refilled'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
