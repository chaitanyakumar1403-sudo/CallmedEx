/**
 * Consultation Page — 3-mode discovery:
 *
 *   Teleconsultation → verified online doctors (no location needed)
 *   Walk-in          → in-person doctors + dental clinics, physiotherapy
 *                      centres, clinics, polyclinics & hospitals (State →
 *                      District location filter)
 *   Home Visit       → home-visit doctors + physiotherapy centres that offer
 *                      home service (State → District location filter)
 *
 * Dental & physiotherapy were removed from /diagnostics (Book a Test) because
 * they are walk-in-only services; this page is where patients find them.
 */
'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { telemedAPI, discoveryAPI } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import StateDistrictPicker from '@/components/StateDistrictPicker';

type ConsultMode = 'teleconsultation' | 'walkin' | 'home';

interface Doctor {
  doctor_id: string;
  name: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  consultation_fee: number;
  languages: string[];
  city: string;
  district?: string;
  state?: string;
  available: boolean;
  rating?: number;
  consultation_mode?: string;
}

interface OrgCard {
  id: string;
  name: string;
  organization_type: string;
  city: string;
  state: string;
  min_price?: number | null;
  home_service_enabled?: boolean;
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
  'Dentistry',
  'Ophthalmology',
  'Pulmonology',
];

// Walk-in tab: the organization types a patient can physically visit.
const WALKIN_ORG_TYPES = ['dental_clinic', 'physiotherapy_center', 'clinic', 'polyclinic', 'hospital'];

const ORG_TYPE_LABEL: Record<string, string> = {
  dental_clinic: 'Dental Clinic',
  physiotherapy_center: 'Physiotherapy Centre',
  clinic: 'Clinic',
  polyclinic: 'Polyclinic',
  hospital: 'Hospital',
  nursing_home: 'Nursing Home',
};

const ORG_TYPE_ICON: Record<string, string> = {
  dental_clinic: '🦷',
  physiotherapy_center: '🧘',
  clinic: '🏥',
  polyclinic: '🏥',
  hospital: '🏨',
  nursing_home: '🏨',
};

const MODE_META: Record<ConsultMode, { title: string; subtitle: string; empty: string }> = {
  teleconsultation: {
    title: '📹 Video Consultation',
    subtitle: 'Connect with verified doctors via HD video call — with AI-generated e-prescriptions',
    empty: 'No doctors available for video consultation right now. Try again shortly.',
  },
  walkin: {
    title: '🏥 Walk-in Consultation',
    subtitle: 'Book an in-person visit — verified doctors, dental clinics, physiotherapy centres and hospitals near you',
    empty: 'No walk-in providers found. Try a different location or filter.',
  },
  home: {
    title: '🏠 Home Visit',
    subtitle: 'Verified doctors and physiotherapists who come to your doorstep',
    empty: 'No home-visit providers found. Try a different location.',
  },
};

// normalize /api/providers/search/doctors rows into the page's Doctor shape
function normalizeSearchDoctor(d: any): Doctor {
  const fees = d.fees || {};
  const fee = fees.in_person ?? fees.home_visit ?? fees.online ?? Object.values(fees)[0] ?? 0;
  return {
    doctor_id: d.id,
    name: d.name || '',
    specialization: d.specialization || '',
    qualification: d.qualification || '',
    experience_years: d.experience_years || 0,
    consultation_fee: Number(fee) || 0,
    languages: d.languages || ['English'],
    city: d.city || '',
    district: d.district || '',
    state: d.state || '',
    available: true,
    consultation_mode: d.consultation_mode,
  };
}

// Location match for the State → District filter. Providers with incomplete
// location fields are kept — hiding verified supply over a missing profile
// field costs bookings; the fallback note covers the zero-result case.
function matchesLocation(
  item: { state?: string; district?: string; city?: string },
  selState: string,
  selDistrict: string
): boolean {
  if (selState) {
    const s = (item.state || '').trim().toLowerCase();
    if (s && s !== selState.trim().toLowerCase()) return false;
  }
  if (selDistrict) {
    const d = selDistrict.trim().toLowerCase();
    const district = (item.district || '').trim().toLowerCase();
    const city = (item.city || '').trim().toLowerCase();
    if (district) return district === d || district.includes(d) || d.includes(district);
    if (city) return city === d || city.includes(d) || d.includes(city);
  }
  return true;
}

function ConsultationContent() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [orgs, setOrgs] = useState<OrgCard[]>([]);
  const [selectedSpec, setSelectedSpec] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [consultMode, setConsultMode] = useState<ConsultMode>('teleconsultation');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [locState, setLocState] = useState('');
  const [district, setDistrict] = useState('');
  const [locationDetected, setLocationDetected] = useState(false);
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Per-mode result cache — switching tabs doesn't refetch.
  const cache = useRef<Partial<Record<ConsultMode, { doctors: Doctor[]; orgs: OrgCard[] }>>>({});

  // Read mode from URL params (from body map navigation)
  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'online' || modeParam === 'teleconsultation') setConsultMode('teleconsultation');
    else if (modeParam === 'walkin' || modeParam === 'offline' || modeParam === 'in_person') setConsultMode('walkin');
    else if (modeParam === 'home') setConsultMode('home');

    const specParam = searchParams.get('spec');
    if (specParam) {
      const match = SPECIALIZATIONS.find(s => s.toLowerCase().includes(specParam.toLowerCase()) || specParam.toLowerCase().includes(s.toLowerCase()));
      if (match) setSelectedSpec(match);
      else setSelectedSpec(specParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const cached = cache.current[consultMode];
    if (cached) {
      setDoctors(cached.doctors);
      setOrgs(cached.orgs);
      setError('');
      setIsLoading(false);
      return;
    }
    loadMode(consultMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultMode]);

  const loadMode = async (mode: ConsultMode) => {
    setIsLoading(true);
    setError('');
    try {
      if (mode === 'teleconsultation') {
        const result = await telemedAPI.listDoctors();
        const docs = (result.doctors || []) as Doctor[];
        cache.current[mode] = { doctors: docs, orgs: [] };
        setDoctors(docs);
        setOrgs([]);
      } else if (mode === 'walkin') {
        const [inPerson, both, orgResult] = await Promise.all([
          discoveryAPI.searchDoctors({ consultation_mode: 'in_person' }),
          discoveryAPI.searchDoctors({ consultation_mode: 'both' }),
          discoveryAPI.searchOrganizations({ exclude_diagnostic: true }),
        ]);
        const seen = new Map<string, Doctor>();
        [...(inPerson.doctors || []), ...(both.doctors || [])].forEach((d: any) => {
          const nd = normalizeSearchDoctor(d);
          if (nd.doctor_id) seen.set(nd.doctor_id, nd);
        });
        const walkinOrgs: OrgCard[] = (orgResult.organizations || [])
          .filter((o: any) => WALKIN_ORG_TYPES.includes(o.organization_type))
          .map((o: any) => ({
            id: o.id,
            name: o.organization_name || o.name || '',
            organization_type: o.organization_type,
            city: o.city || '',
            state: o.state || '',
            min_price: o.min_price,
          }));
        const docs = [...seen.values()];
        cache.current[mode] = { doctors: docs, orgs: walkinOrgs };
        setDoctors(docs);
        setOrgs(walkinOrgs);
      } else {
        const [homeDoctors, physioResult] = await Promise.all([
          discoveryAPI.searchDoctors({ consultation_mode: 'home_visit' }),
          discoveryAPI.searchProviders({ type: 'physiotherapy_center', home_service: true }),
        ]);
        const docs = (homeDoctors.doctors || []).map(normalizeSearchDoctor);
        const homeOrgs: OrgCard[] = (physioResult.providers || []).map((p: any) => ({
          id: p.provider_user_id,
          name: p.display_name || '',
          organization_type: p.subtype || 'physiotherapy_center',
          city: p.city || '',
          state: p.state || '',
          min_price: p.min_price,
          home_service_enabled: p.home_service_enabled,
        }));
        cache.current[mode] = { doctors: docs, orgs: homeOrgs };
        setDoctors(docs);
        setOrgs(homeOrgs);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load providers');
    } finally {
      setIsLoading(false);
    }
  };

  const needsLocation = consultMode !== 'teleconsultation';

  const { filteredDoctors, filteredOrgs, locationFallback } = useMemo(() => {
    let docs = doctors;
    let facilities = orgs;

    if (selectedSpec !== 'All') {
      docs = docs.filter((d) => d.specialization === selectedSpec);
      facilities = []; // specialization chips are doctor-oriented
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.specialization.toLowerCase().includes(q) ||
          d.languages.some((l) => l.toLowerCase().includes(q))
      );
      facilities = facilities.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (ORG_TYPE_LABEL[o.organization_type] || '').toLowerCase().includes(q) ||
          o.city.toLowerCase().includes(q)
      );
    }

    let fallback = false;
    if (needsLocation && (locState || district)) {
      const locDocs = docs.filter((d) => matchesLocation(d, locState, district));
      const locOrgs = facilities.filter((o) => matchesLocation(o, locState, district));
      // Graceful fallback: an empty strict result shows everything with a
      // note rather than a blank page (existing page behaviour, kept).
      if (locDocs.length === 0 && locOrgs.length === 0 && (docs.length > 0 || facilities.length > 0)) {
        fallback = true;
      } else {
        docs = locDocs;
        facilities = locOrgs;
      }
    }

    return { filteredDoctors: docs, filteredOrgs: facilities, locationFallback: fallback };
  }, [doctors, orgs, selectedSpec, searchQuery, needsLocation, locState, district]);

  const requireAuth = () => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/consultation');
      return false;
    }
    return true;
  };

  const handleConsult = (doctor: Doctor) => {
    if (!requireAuth() || !doctor.available) return;

    if (consultMode === 'teleconsultation') {
      router.push(`/consultation/${doctor.doctor_id}?name=${encodeURIComponent(doctor.name)}&spec=${encodeURIComponent(doctor.specialization)}&fee=${doctor.consultation_fee}`);
    } else if (consultMode === 'home') {
      router.push(`/booking?type=home_doctor&doctor=${doctor.doctor_id}&name=${encodeURIComponent(doctor.name)}&spec=${encodeURIComponent(doctor.specialization)}&fee=${doctor.consultation_fee}`);
    } else {
      router.push(`/booking?type=doctor&doctor=${doctor.doctor_id}&name=${encodeURIComponent(doctor.name)}&spec=${encodeURIComponent(doctor.specialization)}&fee=${doctor.consultation_fee}`);
    }
  };

  const handleOrgBooking = (org: OrgCard) => {
    if (!requireAuth()) return;
    router.push(`/booking?type=doctor&org=${org.id}`);
  };

  const meta = MODE_META[consultMode];

  const modeButton = (mode: ConsultMode, label: string, activeBg: string, activeShadow: string) => (
    <button
      onClick={() => setConsultMode(mode)}
      style={{
        flex: 1, padding: '12px 16px', borderRadius: 10,
        border: 'none', cursor: 'pointer',
        fontWeight: 700, fontSize: '0.85rem',
        background: consultMode === mode ? activeBg : 'transparent',
        color: consultMode === mode ? '#fff' : '#64748b',
        boxShadow: consultMode === mode ? activeShadow : 'none',
        transition: 'all 0.25s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="section">
      <div className="container">
        <div className="section-title">
          <h1>{meta.title}</h1>
          <p>{meta.subtitle}</p>
        </div>

        {/* ── Mode Toggle ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 0, justifyContent: 'center', marginBottom: 28,
          background: '#f1f5f9', borderRadius: 14, padding: 4,
          maxWidth: 560, margin: '0 auto 28px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          {modeButton('teleconsultation', '📹 Teleconsultation',
            'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            '0 4px 12px rgba(2,132,199,0.3)')}
          {modeButton('walkin', '🏥 Walk-in',
            'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            '0 4px 12px rgba(15,23,42,0.3)')}
          {modeButton('home', '🏠 Home Visit',
            'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            '0 4px 12px rgba(22,163,74,0.3)')}
        </div>

        {/* ── Search & Location Bar ───────────────────────────────── */}
        <div style={{ maxWidth: 640, margin: '0 auto var(--space-lg)' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Search by doctor name, specialization, or language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 2, paddingLeft: 16, fontSize: '0.95rem', minWidth: 240 }}
            />
          </div>
          {needsLocation && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <StateDistrictPicker
                stateValue={locState}
                districtValue={district}
                detected={locationDetected}
                onChange={(next) => {
                  setLocState(next.state);
                  setDistrict(next.district);
                  setLocationDetected(next.detected);
                }}
              />
            </div>
          )}
          {needsLocation && locationFallback && (
            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>
              No providers registered in {district || locState}{district && locState ? `, ${locState}` : ''} yet — showing all available providers.
            </p>
          )}
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
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                delete cache.current[consultMode];
                loadMode(consultMode);
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Doctor + Facility Cards */}
        {!isLoading && !error && (
          <>
            {filteredDoctors.length === 0 && filteredOrgs.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <p style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</p>
                <p style={{ color: 'var(--color-gray-500)' }}>{meta.empty}</p>
              </div>
            ) : (
              <div className="grid-2">
                {filteredOrgs.map((org) => (
                  <div
                    key={org.id}
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
                        background: consultMode === 'home'
                          ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                          : 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.8rem',
                        color: '#fff',
                      }}
                    >
                      {ORG_TYPE_ICON[org.organization_type] || '🏥'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', marginBottom: 4 }}>
                            {org.name}
                          </h4>
                          <div style={{ fontSize: '0.82rem', color: 'var(--color-gray-500)' }}>
                            {ORG_TYPE_LABEL[org.organization_type] || org.organization_type}
                            {consultMode === 'home' && org.home_service_enabled ? ' · Home service' : ''}
                          </div>
                        </div>
                        <span className="badge badge-success">● Verified</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {(org.city || org.state) && (
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              📍 {[org.city, org.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {org.min_price != null && (
                            <span style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
                              from ₹{org.min_price}
                            </span>
                          )}
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOrgBooking(org)}
                            style={{ minWidth: 110 }}
                          >
                            {consultMode === 'home' ? '🏠 Book Home Visit' : '🏥 Book Visit'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

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
                          : consultMode === 'home'
                            ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                            : 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.8rem',
                        color: '#fff',
                      }}
                    >
                      {consultMode === 'teleconsultation' ? '👨‍⚕️' : consultMode === 'home' ? '🏠' : '🏥'}
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
                          {needsLocation && (doc.city || doc.district) && (
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              · 📍 {[doc.city || doc.district, doc.state].filter(Boolean).join(', ')}
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
                              : consultMode === 'home'
                                ? (doc.available ? '🏠 Book Home Visit' : 'Unavailable')
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
