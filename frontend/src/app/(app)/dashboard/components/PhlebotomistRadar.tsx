'use client';

import React from 'react';
import { Compass, Thermometer, ShieldCheck, Key } from 'lucide-react';

interface Props {
  phleboName?: string;
  etaMinutes?: number;
  temperatureCelsius?: number;
  otpPin?: string;
  speedKmh?: number;
}

export const PhlebotomistRadar: React.FC<Props> = ({
  phleboName = 'Ravi Kumar (Certified Phlebotomist)',
  etaMinutes = 8,
  temperatureCelsius = 4.2,
  otpPin,
  speedKmh = 24,
}) => {
  return (
    <div
      style={{
        background: '#f0fff4',
        borderRadius: 20,
        border: '2px solid #38a169',
        padding: 24,
        boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#166534', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Compass style={{ width: 18, height: 18, color: '#15803d' }} />
            Live Phlebotomist Arrival Tracking
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#15803d' }}>
            Real-time GPS telemetry & cold-chain container monitoring.
          </p>
        </div>

        <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase' }}>
          Arriving in ~{etaMinutes} Mins
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'center' }}>
        {/* Phlebo Profile Details */}
        <div style={{ background: '#fff', padding: 18, borderRadius: 14, border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{phleboName}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>Transit Speed: {speedKmh} km/h</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Thermometer style={{ width: 14, height: 14 }} /> Cold Chain: {temperatureCelsius}°C (Optimal)
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck style={{ width: 14, height: 14 }} /> NMC Biometric Verified
            </span>
          </div>
        </div>

        {/* Doorstep OTP Pin Box */}
        <div style={{ background: '#0284c7', color: '#fff', padding: 16, borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            Doorstep Verification OTP
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: 4, background: '#fff', color: '#0284c7', padding: '4px 12px', borderRadius: 8, display: 'inline-block' }}>
            {/* No invented PIN. Until the collector marks themselves arrived
                the backend does not release one, and printing a placeholder
                that looks like a code is worse than showing none. */}
            {otpPin || "••••"}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#e0f2fe', marginTop: 6 }}>
            {otpPin
              ? "Share only upon phlebotomist arrival"
              : "Your OTP appears here once the collector arrives"}
          </div>
        </div>
      </div>
    </div>
  );
};
