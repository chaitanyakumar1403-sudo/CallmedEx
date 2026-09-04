'use client';

import React, { useEffect, useState } from 'react';
import { useFamilyHubStore } from '@/store/useFamilyHubStore';
import { AlertTriangle, ShieldAlert, X, MapPin } from 'lucide-react';

import { PATIENT_TRANSLATIONS, PatientLang } from '../patient/patientTranslations';

interface EmergencySOSWidgetProps {
  lang?: PatientLang;
}

export const EmergencySOSWidget: React.FC<EmergencySOSWidgetProps> = ({ lang = 'en' }) => {
  const { sosActive, sosCountdownSeconds, triggerSOS, cancelSOS, decrementSOSCountdown, emergencyContacts } = useFamilyHubStore();
  const t = PATIENT_TRANSLATIONS[lang] || PATIENT_TRANSLATIONS.en;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sosActive && sosCountdownSeconds > 0) {
      timer = setInterval(() => {
        decrementSOSCountdown();
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sosActive, sosCountdownSeconds, decrementSOSCountdown]);

  const [result, setResult] = useState<string>('');

  /** Three defects lived in this one call:
   *   - a RELATIVE '/api/...' url, which hits the Next.js origin, not the
   *     FastAPI backend, so every trigger 404'd;
   *   - hardcoded Bengaluru coordinates (12.9716, 77.5946) instead of the
   *     patient's own position, so a working call would have sent help to the
   *     wrong city;
   *   - no Authorization header, so the endpoint would have rejected it anyway.
   */
  const handleDispatchNow = async () => {
    setResult('');
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 8000, maximumAge: 60000,
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      // Send anyway — contacts still need to know, and the backend labels the
      // location as unavailable rather than inventing one.
    }

    try {
      const res = await fetch(`${apiBase}/api/v1/patient/sos/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat, lng, notes: 'Emergency trigger from patient dashboard' }),
      });
      const data = await res.json().catch(() => ({}));
      setResult(
        res.ok
          ? data.message || 'SOS raised.'
          : data.detail || 'Could not raise the SOS. Call 108 now.',
      );
    } catch {
      setResult('Could not reach CallMedex. Call 108 for an ambulance now.');
    }
  };

  return (
    <div
      style={{
        background: '#fff5f5',
        borderRadius: 10,
        border: '1px solid #fca5a5',
        borderLeft: '3px solid #dc2626',
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <AlertTriangle style={{ width: 15, height: 15, color: '#dc2626', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {t.emergencySOSTriage}
            <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '0 6px', borderRadius: 8, fontSize: '0.63rem', fontWeight: 700 }}>
              {t.twentyFourSevenActive}
            </span>
          </div>
          <div style={{ fontSize: '0.71rem', color: '#7f1d1d' }}>
            {result || t.sosAlertDesc(emergencyContacts.length)}
          </div>
        </div>
      </div>

      {!sosActive ? (
        <button
          onClick={() => {
            triggerSOS();
            handleDispatchNow();
          }}
          style={{
            padding: '6px 13px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: '#dc2626',
            color: 'white',
            fontWeight: 700,
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldAlert style={{ width: 14, height: 14 }} />
          {t.triggerEmergencySOS}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: '6px 14px', borderRadius: 10, border: '1px solid #fca5a5' }}>
          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#dc2626' }}>
            {t.dispatched} ({sosCountdownSeconds}s)
          </span>
          <button
            onClick={cancelSOS}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
          >
            {t.cancel}
          </button>
        </div>
      )}
    </div>
  );
};
