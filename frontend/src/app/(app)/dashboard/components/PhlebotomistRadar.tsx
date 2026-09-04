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
        borderRadius: 20,
        border: '2px solid #38a169',
        padding: 24,
        boxShadow: '0 10px 30px -5px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#166534', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            {searching
              ? <Search style={{ width: 18, height: 18, color: '#15803d' }} />
              : <Compass style={{ width: 18, height: 18, color: '#15803d' }} />}
            {searching ? 'Finding a collector near you' : 'Live collection tracking'}
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#15803d' }}>
            {searching
              ? 'Your request has gone out to verified collectors in your area.'
              : 'Real-time location from your collector’s device.'}
          </p>
        </div>

        {!searching && typeof etaMinutes === 'number' && (
          <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase' }}>
            Arriving in ~{etaMinutes} Mins
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'stretch' }}>
        <div style={{ background: '#fff', padding: 18, borderRadius: 14, border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {searching ? (
            candidates.length > 0 ? (
              <>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                  {candidates.length} collector{candidates.length === 1 ? '' : 's'} notified
                </div>
                {candidates.slice(0, 4).map((c, i) => (
                  <div
                    key={`${c.first_name ?? 'collector'}-${i}`}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: '0.82rem', color: '#334155', paddingTop: 6,
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
              <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                Still searching for an available collector. We will notify you the
                moment someone accepts.
              </div>
            )
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                {phleboName || 'Your collector'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {typeof distanceKm === 'number' ? `${distanceKm.toFixed(1)} km away` : 'Location updating…'}
                {typeof speedKmh === 'number' && speedKmh > 0 ? ` · ${Math.round(speedKmh)} km/h` : ''}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck style={{ width: 14, height: 14 }} /> Verified by CallMedex
                </span>
                {locationSource === 'base' && (
                  <span style={{ fontSize: '0.75rem', color: '#b45309' }}>
                    Live GPS unavailable — showing last known area
                  </span>
                )}
              </div>
            </>
          )}
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
            {otpPin || '••••'}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#e0f2fe', marginTop: 6 }}>
            {otpPin
              ? 'Share only upon phlebotomist arrival'
              : 'Your OTP appears here once the collector arrives'}
          </div>
        </div>
      </div>
    </div>
  );
};
