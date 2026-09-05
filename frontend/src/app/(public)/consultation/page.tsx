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
import {
  Video,
  Building2,
  Home,
  Search,
  MapPin,
  Star,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';

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

const MODE_META: Record<ConsultMode, { title: string; subtitle: string; empty: string }> = {
  teleconsultation: {
    title: 'Video Teleconsultation',
    subtitle: 'Connect with verified doctors via HD video call with digital e-prescriptions',
    empty: 'No doctors available for video consultation right now. Try again shortly.',
  },
  walkin: {
    title: 'Walk-in Consultation',
    subtitle: 'Book an in-person visit — verified doctors, dental clinics, physiotherapy centres and hospitals near you',
    empty: 'No walk-in providers found. Try a different location or filter.',
  },
  home: {
    title: 'Home Doctor Visit',
    subtitle: 'Verified doctors and physiotherapists who come to your doorstep',
    empty: 'No home-visit providers found. Try a different location.',
  },
};

function normSpec(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z]/g, '');
}

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

// Location match for the State → District filter, used only by the physical
// modes (walk-in, home visit). Video consultation never calls this: a patient
// in any state may consult any verified doctor.
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
    const key = (v?: string) => (v || '').toLowerCase().replace(/[^a-z]/g, '');
    const d = key(selDistrict);
    const candidates = [key(item.district), key(item.city)].filter(Boolean);
    // No location on the profile at all: for a physical visit that is not
    // "matches everywhere", it is "we cannot tell" — and sending a patient to
    // a clinic whose district is unknown is the wrong side to err on.
    if (candidates.length === 0) return false;
    return candidates.some((c) => c === d || c.includes(d) || d.includes(c));
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

  // Default the location to the patient's own district. Walk-in and home
  // visits are scoped to it, so making them pick it every time (and showing
  // every doctor in India until they did) was the wrong default.
  useEffect(() => {
    if (locState || district) return;
    try {
      const stored = localStorage.getItem('user');
      if (!stored) return;
      const u = JSON.parse(stored);
      const d = (u?.district || u?.city || '').trim();
      const st = (u?.state || '').trim();
      if (d || st) {
        setDistrict(d);
        setLocState(st);
      }
    } catch { /* no stored profile — the picker stays empty */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        // One request: the backend now resolves a doctor's real published
        // modes from their availability blocks and tariffs, so the old
        // in_person + "both" merge (which still missed anyone whose enum said
        // "online" while they published walk-in slots) is no longer needed.
        const [inPerson, orgResult] = await Promise.all([
          discoveryAPI.searchDoctors({ consultation_mode: 'in_person' }),
          discoveryAPI.searchOrganizations({ exclude_diagnostic: true }),
        ]);
        const seen = new Map<string, Doctor>();
        (inPerson.doctors || []).forEach((d: any) => {
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

  const { filteredDoctors, filteredOrgs } = useMemo(() => {
    let docs = doctors;
    let facilities = orgs;

    if (selectedSpec !== 'All') {
      // The chips read "General Medicine"; the database holds
      // "general medicine". Exact equality matched neither, so picking any
      // specialization emptied the page even when that doctor was listed
      // under "All" a second earlier.
      const wanted = normSpec(selectedSpec);
      docs = docs.filter((d) => {
        const has = normSpec(d.specialization);
        return has === wanted || has.includes(wanted) || wanted.includes(has);
      });
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

    if (needsLocation && (locState || district)) {
      // Walk-in and home visits are physical: a doctor in another district
      // cannot see this patient, so once a location is chosen the filter is
      // STRICT. Showing everyone as a "fallback" was worse than an empty
      // list — it advertised doctors in other states as bookable for a
      // clinic visit. Video consultation never reaches this branch
      // (needsLocation is false for it) and stays nationwide on purpose.
      docs = docs.filter((d) => matchesLocation(d, locState, district));
      facilities = facilities.filter((o) => matchesLocation(o, locState, district));
    }

    return { filteredDoctors: docs, filteredOrgs: facilities };
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

        {/* Individual physiotherapists and dietitians are booked by name, with
            their own published slots per mode — this page lists doctors and
            centres, so route those two roles to their own flow rather than
            leaving them undiscoverable. */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
          justifyContent: 'center', marginBottom: 22, padding: '14px 18px',
          background: 'var(--cm-surface-2)', border: '1px solid var(--cm-line)', borderRadius: 'var(--cm-radius)',
        }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--cm-navy)', fontWeight: 600 }}>
            Looking for a physiotherapist or dietitian?
          </span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <a
              href="/booking/therapy?role=physiotherapist"
              className="btn btn-primary btn-sm"
              style={{
                textDecoration: 'none',
                backgroundColor: 'var(--cm-navy)',
                color: '#ffffff',
                fontWeight: 700,
                borderRadius: '8px',
                padding: '8px 16px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Consult a Physio
            </a>
            <a
              href="/booking/therapy?role=dietitian"
              className="btn btn-secondary btn-sm"
              style={{
                textDecoration: 'none',
                backgroundColor: '#ffffff',
                color: 'var(--cm-navy)',
                border: '1.5px solid var(--cm-navy)',
                fontWeight: 700,
                borderRadius: '8px',
                padding: '8px 16px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Consult a Dietitian
            </a>
          </div>
        </div>

        {/* ── Mode Toggle ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 28,
          background: 'var(--cm-surface-2)', borderRadius: 'var(--cm-radius-sm)', padding: 6,
          maxWidth: 580, margin: '0 auto 28px',
          border: '1px solid var(--cm-line)',
        }}>
          {modeButton('teleconsultation', 'Video Consultation',
            'var(--cm-active)',
            'none')}
          {modeButton('walkin', 'Walk-in Visit',
            'var(--cm-navy)',
            'none')}
          {modeButton('home', 'Home Visit',
            'var(--cm-done)',
            'none')}
        </div>

        {/* ── Search & Location Bar ───────────────────────────────── */}
        <div style={{ maxWidth: 640, margin: '0 auto var(--space-lg)' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by doctor name, specialization, or language..."
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
          {needsLocation && (locState || district) && filteredDoctors.length === 0 && filteredOrgs.length === 0 && !isLoading && (
            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>
              No {consultMode === 'walkin' ? 'walk-in' : 'home-visit'} providers registered in {district || locState}{district && locState ? `, ${locState}` : ''} yet.
              Video consultation is available from doctors anywhere in India.
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
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--cm-surface-2)', color: 'var(--cm-ink-3)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
                  <Search size={22} />
                </div>
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
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: 'var(--cm-surface-2)',
                        border: '1px solid var(--cm-line-strong)',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'var(--cm-navy)',
                      }}
                    >
                      <Building2 size={28} />
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
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              <MapPin size={12} /> {[org.city, org.state].filter(Boolean).join(', ')}
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
                            {consultMode === 'home' ? 'Book Home Visit' : 'Book Visit'}
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
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: 'var(--cm-surface-2)',
                        border: '1px solid var(--cm-line-strong)',
                        display: 'grid',
                        placeItems: 'center',
                        color: consultMode === 'teleconsultation' ? 'var(--cm-active)' : 'var(--cm-navy)',
                      }}
                    >
                      {consultMode === 'teleconsultation' ? <Video size={28} /> : consultMode === 'home' ? <Home size={28} /> : <Stethoscope size={28} />}
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
                            <span style={{ color: 'var(--cm-waiting)', display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 700 }}>
                              <Star size={12} fill="currentColor" /> {doc.rating}
                            </span>
                          )}
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-gray-400)' }}>
                            · {doc.languages.join(', ')}
                          </span>
                          {needsLocation && (doc.city || doc.district) && (
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              · <MapPin size={12} /> {[doc.city || doc.district, doc.state].filter(Boolean).join(', ')}
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
                              ? (doc.available ? 'Consult' : 'Unavailable')
                              : consultMode === 'home'
                                ? (doc.available ? 'Book Home Visit' : 'Unavailable')
                                : (doc.available ? 'Book Visit' : 'Unavailable')
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
          <p style={{ fontSize: '0.9rem', color: 'var(--color-gray-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <ShieldCheck size={16} style={{ color: 'var(--cm-done)' }} /> All consultations comply with NMC 2026 telemedicine guidelines · Prescriptions include
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
