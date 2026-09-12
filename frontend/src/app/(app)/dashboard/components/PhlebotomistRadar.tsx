'use client';

import React from 'react';
import { Compass, ShieldCheck, Search } from 'lucide-react';

/**
 * Live collection tracking for the patient.
 *
 * Everything rendered here comes from the dispatch tracking payload. This
 * component used to carry defaults — "Ravi Kumar (Certified Phlebotomist)",
 * 8 minutes away, 24 km/h, a 4.2°C cold-chain reading and an "NMC Biometric
 * Verified" badge — and the patient dashboard rendered it with only the OTP
 * supplied, so every patient watched the same invented collector approach.
 * There is no cold-chain sensor anywhere in the platform, so no temperature
 * is shown at all.
 */
interface Candidate {
  first_name?: string;
  distance_km?: number | null;
  eta_minutes?: number | null;
  rating?: number | null;
  rating_count?: number;
}

interface Props {
  /** searching | provider_notified | provider_accepted | en_route | arrived | in_progress */
  status?: string;
  phleboName?: string | null;
  etaMinutes?: number | null;
  distanceKm?: number | null;
  otpPin?: string;
  speedKmh?: number | null;
  /** Collectors holding a live offer, while nobody has accepted yet. */
  candidates?: Candidate[];
  /** "live" GPS fix vs "base" registered address. */
  locationSource?: string;
}

const SEARCHING = new Set(['searching', 'provider_notified']);

export const PhlebotomistRadar: React.FC<Props> = ({
  status = 'searching',
  phleboName,
  etaMinutes,
  distanceKm,
  otpPin,
  speedKmh,
  candidates = [],
  locationSource,
}) => {
  const searching = SEARCHING.has(status);

  return (
    <div
      style={{
        background: '#f0fff4',
        borderRadius: 14,
        border: '1.5px solid #38a169',
        padding: '14px 18px',
        boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.05)',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.02rem', color: '#166534', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            {searching
              ? <Search style={{ width: 16, height: 16, color: '#15803d' }} />
              : <Compass style={{ width: 16, height: 16, color: '#15803d' }} />}
            {searching ? 'Finding a collector near you' : 'Live collection tracking'}
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#15803d' }}>
            {searching
              ? 'Your request has gone out to verified collectors in your area.'
              : 'Real-time location from your collector’s device.'}
          </p>
        </div>

        {!searching && typeof etaMinutes === 'number' && (
          <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: 16, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Arriving in ~{etaMinutes} Mins
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, alignItems: 'stretch' }}>
        <div style={{ background: '#fff', padding: '12px 14px', borderRadius: 10, border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {searching ? (
            candidates.length > 0 ? (
              <>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                  {candidates.length} collector{candidates.length === 1 ? '' : 's'} notified
                </div>
                {candidates.slice(0, 4).map((c, i) => (
                  <div
                    key={`${c.first_name ?? 'collector'}-${i}`}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: '0.78rem', color: '#334155', paddingTop: 4,
                      borderTop: i === 0 ? 'none' : '1px solid #f1f5f9',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {c.first_name || 'Collector'}
                      {typeof c.rating === 'number' && (
                        <span style={{ color: '#64748b', fontWeight: 500 }}> · {c.rating.toFixed(1)}★</span>
                      )}
                    </span>
                    <span style={{ color: '#64748b' }}>
                      {typeof c.distance_km === 'number' ? `${c.distance_km.toFixed(1)} km` : '—'}
                      {typeof c.eta_minutes === 'number' ? ` · ~${c.eta_minutes} min` : ''}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                Still searching for an available collector. We will notify you the
                moment someone accepts.
              </div>
            )
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                {phleboName || 'Your collector'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {typeof distanceKm === 'number' ? `${distanceKm.toFixed(1)} km away` : 'Location updating…'}
                {typeof speedKmh === 'number' && speedKmh > 0 ? ` · ${Math.round(speedKmh)} km/h` : ''}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck style={{ width: 13, height: 13 }} /> Verified by CallMedex
                </span>
                {locationSource === 'base' && (
                  <span style={{ fontSize: '0.72rem', color: '#b45309' }}>
                    Live GPS unavailable — showing last known area
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Doorstep OTP Pin Box - Medium Proportions */}
        <div style={{ background: '#0284c7', color: '#fff', padding: '10px 14px', borderRadius: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, color: '#e0f2fe' }}>
            Doorstep Verification OTP
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: 3, background: '#fff', color: '#0284c7', padding: '3px 12px', borderRadius: 6, display: 'inline-block', margin: '0 auto' }}>
            {otpPin || '••••'}
          </div>
          <div style={{ fontSize: '0.66rem', color: '#bae6fd', marginTop: 4, lineHeight: 1.2 }}>
            {otpPin
              ? 'Share only upon phlebotomist arrival'
              : 'Appears upon collector arrival'}
          </div>
        </div>
      </div>
    </div>
  );
};
