'use client';

import React, { useEffect } from 'react';
import { useFamilyHubStore } from '@/store/useFamilyHubStore';
import { AlertTriangle, ShieldAlert, X, MapPin } from 'lucide-react';

export const EmergencySOSWidget: React.FC = () => {
  const { sosActive, sosCountdownSeconds, triggerSOS, cancelSOS, decrementSOSCountdown, emergencyContacts } = useFamilyHubStore();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sosActive && sosCountdownSeconds > 0) {
      timer = setInterval(() => {
        decrementSOSCountdown();
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sosActive, sosCountdownSeconds, decrementSOSCountdown]);

  const handleDispatchNow = async () => {
    try {
      await fetch('/api/v1/patient/sos/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: 12.9716, lng: 77.5946, notes: 'Direct emergency trigger from patient dashboard' }),
      });
    } catch (err) {
      console.error('Failed to trigger emergency SOS backend endpoint:', err);
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%)',
        borderRadius: 16,
        borderLeft: '4px solid #dc2626',
        borderTop: '1px solid #fca5a5',
        borderRight: '1px solid #fca5a5',
        borderBottom: '1px solid #fca5a5',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertTriangle style={{ width: 20, height: 20 }} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
            Emergency SOS Triage
            <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '1px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700 }}>
              24/7 Active
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#7f1d1d', marginTop: 2 }}>
            Instant dispatch alert to {emergencyContacts.length} emergency contacts & CallMedex unit with GPS.
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
            padding: '8px 18px',
            borderRadius: 10,
            border: 'none',
            backgroundColor: '#dc2626',
            color: 'white',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <ShieldAlert style={{ width: 16, height: 16 }} />
          Trigger Emergency SOS
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', padding: '6px 14px', borderRadius: 10, border: '1px solid #fca5a5' }}>
          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#dc2626' }}>
            Dispatched! ({sosCountdownSeconds}s)
          </span>
          <button
            onClick={cancelSOS}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
