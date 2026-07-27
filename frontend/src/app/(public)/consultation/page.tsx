/**
 * Consultation Page — Doctor Listing for Video & Walk-in Consultation
 * API-connected with search, filter, mode toggle, and real-time availability.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { telemedAPI } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { Suspense } from 'react';

interface Doctor {
  doctor_id: string;
  name: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  consultation_fee: number;
  languages: string[];
  city: string;
  available: boolean;
  rating?: number;
  walkin_available?: boolean;
}

const SPECIALIZATIONS = [
  'All',
  'General Medicine',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Gynecology',
  'Orthopedics',
  'ENT',
  'Neurology',
  'Psychiatry',
];

function ConsultationContent() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [selectedSpec, setSelectedSpec] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [consultMode, setConsultMode] = useState<'teleconsultation' | 'walkin'>('teleconsultation');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [detectedCity, setDetectedCity] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read mode from URL params (from body map navigation)
  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'online') setConsultMode('teleconsultation');
    else if (modeParam === 'walkin' || modeParam === 'offline') setConsultMode('walkin');

    const specParam = searchParams.get('spec');
    if (specParam) {
      const match = SPECIALIZATIONS.find(s => s.toLowerCase() === specParam.toLowerCase());
      if (match) setSelectedSpec(match);
    }
  }, [searchParams]);

  useEffect(() => {
    loadDoctors();
  }, []);

  useEffect(() => {
    let filtered = doctors;

    if (selectedSpec !== 'All') {
      filtered = filtered.filter((d) => d.specialization === selectedSpec);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.specialization.toLowerCase().includes(q) ||
          d.languages.some((l) => l.toLowerCase().includes(q))
      );
    }

    // For walk-in mode, optionally filter by city if detected
    if (consultMode === 'walkin' && detectedCity) {
      const cityFiltered = filtered.filter(d =>
        d.city && d.city.toLowerCase().includes(detectedCity.toLowerCase())
      );
      // Only filter by city if it produces results, otherwise show all
      if (cityFiltered.length > 0) {
        filtered = cityFiltered;
      }
    }

    setFilteredDoctors(filtered);
  }, [doctors, selectedSpec, searchQuery, consultMode, detectedCity]);

  const loadDoctors = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await telemedAPI.listDoctors();
      setDoctors(result.doctors || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load doctors');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsult = (doctor: Doctor) => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/consultation');
      return;
    }
    if (!doctor.available) return;

    if (consultMode === 'teleconsultation') {
      router.push(`/consultation/${doctor.doctor_id}?name=${encodeURIComponent(doctor.name)}&spec=${encodeURIComponent(doctor.specialization)}&fee=${doctor.consultation_fee}`);
    } else {
      router.push(`/booking?type=walkin&doctor=${doctor.doctor_id}&name=${encodeURIComponent(doctor.name)}&spec=${encodeURIComponent(doctor.specialization)}&fee=${doctor.consultation_fee}`);
    }
  };

  // Auto-detect location
  const handleDetectLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const geoapifyKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY || "";
          let city = "";

          if (geoapifyKey) {
            const res = await fetch(
              `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${geoapifyKey}&format=json`
            );
            const json = await res.json();
            const result = json.results?.[0] || {};
            city = result.city || result.town || result.village || result.county || "";
          } else {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
              { headers: { "Accept-Language": "en", "User-Agent": "CallMedex/2.0" } }
            );
            const data = await res.json();
            const addr = data.address || {};
            city = addr.city || addr.town || addr.village || addr.county || "";
          }

          if (city) {
            setDetectedCity(city);
            setLocationDetected(true);
          }
        } catch { /* silent */ } finally {
          setDetectingLocation(false);
        }
      },
      () => { setDetectingLocation(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  return (
    <div className="section">
      <div className="container">
        <div className="section-title">
          <h1>{consultMode === 'teleconsultation' ? '📹 Video Consultation' : '🏥 Walk-in Consultation'}</h1>
          <p>
            {consultMode === 'teleconsultation'
              ? 'Connect with verified doctors via HD video call — with AI-generated e-prescriptions'
              : 'Book an in-person visit with verified doctors near you — walk-in appointments available'}
          </p>
        </div>

        {/* ── Mode Toggle ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 0, justifyContent: 'center', marginBottom: 28,
          background: '#f1f5f9', borderRadius: 14, padding: 4,
          maxWidth: 420, margin: '0 auto 28px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <button
            onClick={() => setConsultMode('teleconsultation')}
            style={{
              flex: 1, padding: '12px 20px', borderRadius: 10,
              border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.88rem',
              background: consultMode === 'teleconsultation'
                ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                : 'transparent',
              color: consultMode === 'teleconsultation' ? '#fff' : '#64748b',
              boxShadow: consultMode === 'teleconsultation' ? '0 4px 12px rgba(2,132,199,0.3)' : 'none',
              transition: 'all 0.25s ease',
            }}
          >
            📹 Teleconsultation
          </button>
          <button
            onClick={() => setConsultMode('walkin')}
            style={{
              flex: 1, padding: '12px 20px', borderRadius: 10,
              border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.88rem',
              background: consultMode === 'walkin'
                ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                : 'transparent',
              color: consultMode === 'walkin' ? '#fff' : '#64748b',
              boxShadow: consultMode === 'walkin' ? '0 4px 12px rgba(15,23,42,0.3)' : 'none',
              transition: 'all 0.25s ease',
            }}
          >
            🏥 Walk-in
          </button>
        </div>

        {/* ── Search & Location Bar ───────────────────────────────── */}
        <div style={{ maxWidth: 600, margin: '0 auto var(--space-lg)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search by doctor name, specialization, or language..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 2, paddingLeft: 16, fontSize: '0.95rem', minWidth: 240 }}
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {locationDetected && detectedCity && (
              <span style={{
                padding: '8px 14px', borderRadius: 10,
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                fontSize: '0.82rem', color: '#166534', fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                📍 {detectedCity}
                <button
                  onClick={() => { setDetectedCity(''); setLocationDetected(false); }}
                  style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', marginLeft: 6, fontWeight: 700 }}
                >
                  ✕
                </button>
              </span>
            )}
            {!locationDetected && (
              <button
                onClick={handleDetectLocation}
                disabled={detectingLocation}
                style={{
                  padding: '10px 16px', borderRadius: 10,
                  border: '1.5px solid #cbd5e1', background: '#fff',
                  cursor: detectingLocation ? 'wait' : 'pointer',
                  fontSize: '0.82rem', fontWeight: 600, color: '#475569',
                  display: 'flex', alignItems: 'center', gap: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                {detectingLocation ? (
                  <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>📡</span> Detecting...</>
                ) : (
                  <>📍 Detect Location</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Specialization Filter */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
          {SPECIALIZATIONS.map((spec) => (
            <button
              key={spec}
              className={`chip ${selectedSpec === spec ? 'active' : ''}`}
              onClick={() => setSelectedSpec(spec)}
            >
              {spec}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card skeleton-card">
                <div style={{ display: 'flex', gap: 20, alignItems: 'center', padding: 24 }}>
                  <div className="skeleton skeleton-circle" style={{ width: 72, height: 72 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-text" style={{ width: '60%', height: 20, marginBottom: 8 }} />
                    <div className="skeleton skeleton-text" style={{ width: '40%', height: 14, marginBottom: 16 }} />
                    <div className="skeleton skeleton-text" style={{ width: '80%', height: 14 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <p style={{ color: 'var(--color-red)', marginBottom: 16 }}>❌ {error}</p>
            <button className="btn btn-primary btn-sm" onClick={loadDoctors}>
              Retry
            </button>
          </div>
        )}

        {/* Doctor Cards */}
        {!isLoading && !error && (
          <>
            {filteredDoctors.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</p>
                <p style={{ color: 'var(--color-gray-500)' }}>
                  No doctors found matching your criteria. Try a different filter.
                </p>
              </div>
            ) : (
              <div className="grid-2">
                {filteredDoctors.map((doc) => (
                  <div
                    key={doc.doctor_id}
                    className="card doctor-card"
                    style={{ padding: 24, display: 'flex', gap: 20, alignItems: 'center' }}
                  >
                    <div
                      className="doctor-card__avatar"
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: consultMode === 'teleconsultation'
                          ? 'linear-gradient(135deg, var(--color-navy) 0%, var(--color-navy-light) 100%)'
                          : 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.8rem',
                        color: '#fff',
                      }}
                    >
                      {consultMode === 'teleconsultation' ? '👨‍⚕️' : '🏥'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', marginBottom: 4 }}>
                            {doc.name}
                          </h4>
                          <div style={{ fontSize: '0.82rem', color: 'var(--color-gray-500)' }}>
                            {doc.specialization} · {doc.experience_years} yrs exp
                          </div>
                          {doc.qualification && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-gray-400)', marginTop: 2 }}>
                              {doc.qualification}
                            </div>
                          )}
                        </div>
                        <span className={`badge ${doc.available ? 'badge-success' : 'badge-warning'}`}>
                          {doc.available ? '● Available' : '● Busy'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {doc.rating && (
                            <span style={{ color: 'var(--color-amber)' }}>⭐ {doc.rating}</span>
                          )}
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)' }}>
                            · {doc.languages.join(', ')}
                          </span>
                          {consultMode === 'walkin' && doc.city && (
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              · 📍 {doc.city}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
                            ₹{doc.consultation_fee}
                          </span>
                          <button
                            className={`btn ${consultMode === 'teleconsultation' ? 'btn-teal' : 'btn-primary'} btn-sm`}
                            disabled={!doc.available}
                            onClick={() => handleConsult(doc)}
                            style={{ minWidth: 110 }}
                          >
                            {consultMode === 'teleconsultation'
                              ? (doc.available ? '📹 Consult' : 'Unavailable')
                              : (doc.available ? '🏥 Book Visit' : 'Unavailable')
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Compliance Footer */}
        <div
          className="card"
          style={{
            marginTop: 32,
            padding: 24,
            textAlign: 'center',
            background: 'var(--color-gray-50)',
            border: '1px solid var(--color-gray-200)',
          }}
        >
          <p style={{ fontSize: '0.9rem', color: 'var(--color-gray-500)' }}>
            🔒 All consultations comply with NMC 2026 telemedicine guidelines · Prescriptions include
            generic names per BIS mandate · Sessions encrypted end-to-end · AI-assisted e-prescriptions
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ConsultationPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b' }}>Loading consultation...</p>
      </div>
    }>
      <ConsultationContent />
    </Suspense>
  );
}
