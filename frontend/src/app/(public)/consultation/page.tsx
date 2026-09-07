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
import DoctorPresentationModal from '@/app/components/DoctorPresentationModal';
import {
  Video,
  Building2,
  Home,
  Search,
  MapPin,
  Star,
  ShieldCheck,
  Stethoscope,
  Sparkles,
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
  hospital_clinic_name?: string;
  bio?: string;
  fee_justification?: string;
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

const SPECIALTY_ALIASES: Record<string, string[]> = {
  cardiology: ['cardio', 'cardiac', 'heart', 'pgdcc', 'cardiologist'],
  'general medicine': ['general', 'physician', 'internal medicine', 'family medicine', 'gp', 'mbbs'],
  dermatology: ['derma', 'skin', 'dermatologist'],
  pediatrics: ['pediatric', 'paediatric', 'child', 'pediatrician'],
  gynecology: ['gynec', 'gynaec', 'obgyn', 'obstetric', 'women', 'gynecologist'],
  orthopedics: ['orthopedic', 'orthopaedic', 'ortho', 'bone', 'joint', 'orthopedist'],
  ent: ['ent', 'ear', 'nose', 'throat', 'otolaryngol'],
  neurology: ['neuro', 'brain', 'neurologist'],
  psychiatry: ['psych', 'mental', 'psychiatrist'],
  dentistry: ['dent', 'oral', 'dentist'],
  ophthalmology: ['ophthal', 'eye', 'vision', 'ophthalmologist'],
  pulmonology: ['pulmo', 'chest', 'respiratory', 'lung', 'pulmonologist'],
};

function matchesSpecialization(candidateSpec: string, selectedSpec: string): boolean {
  if (!selectedSpec || selectedSpec === 'All') return true;
  const cand = (candidateSpec || '').toLowerCase().replace(/[^a-z]/g, '');
  const sel = (selectedSpec || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!cand) return false;
  if (cand === sel || cand.includes(sel) || sel.includes(cand)) return true;

  for (const [category, aliases] of Object.entries(SPECIALTY_ALIASES)) {
    const catKey = category.toLowerCase().replace(/[^a-z]/g, '');
    const selMatchesCat = catKey.includes(sel) || sel.includes(catKey) || aliases.some((a) => sel.includes(a) || a.includes(sel));
    if (selMatchesCat) {
      if (aliases.some((a) => cand.includes(a)) || cand.includes(catKey)) {
        return true;
      }
    }
  }
  return false;
}

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
    hospital_clinic_name: d.hospital_clinic_name || d.location_name || '',
    bio: d.bio || '',
    fee_justification: d.fee_justification || '',
  };
}

// Defense-in-depth: Ensure master developer personas and test accounts are never displayed to patients
function isInternalTestDoctor(d: any): boolean {
  if (!d) return false;
  const email = (d.email || d.user_email || d.users?.email || '').toLowerCase();
  const ownerEmail = (d.owner_email || d.users?.owner_email || '').toLowerCase();
  const regRole = (d.registrant_role || d.users?.registrant_role || '').toLowerCase();
  if (email.endsWith('@callmedex.internal') || email.includes('.internal')) return true;
  if (regRole === 'master_persona' || regRole === 'test_persona' || regRole === 'sandbox') return true;
  if (ownerEmail === 'chaitanyakumarf11@gmail.com') return true;
  return false;
}

function isInternalTestOrg(o: any): boolean {
  if (!o) return false;
  const email = (o.email || o.official_email || o.users?.email || '').toLowerCase();
  const ownerEmail = (o.owner_email || o.users?.owner_email || '').toLowerCase();
  const regRole = (o.registrant_role || o.users?.registrant_role || '').toLowerCase();
  if (email.endsWith('@callmedex.internal') || email.includes('.internal')) return true;
  if (regRole === 'master_persona' || regRole === 'test_persona' || regRole === 'sandbox') return true;
  if (ownerEmail === 'chaitanyakumarf11@gmail.com') return true;
  return false;
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
  const [presentationDoctor, setPresentationDoctor] = useState<Doctor | null>(null);
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
        const docs = ((result.doctors || []) as Doctor[]).filter((d) => !isInternalTestDoctor(d));
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
          if (isInternalTestDoctor(d)) return;
          const nd = normalizeSearchDoctor(d);
          if (nd.doctor_id) seen.set(nd.doctor_id, nd);
        });
        const walkinOrgs: OrgCard[] = (orgResult.organizations || [])
          .filter((o: any) => WALKIN_ORG_TYPES.includes(o.organization_type) && !isInternalTestOrg(o))
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
        const docs = (homeDoctors.doctors || [])
          .filter((d: any) => !isInternalTestDoctor(d))
          .map(normalizeSearchDoctor);
        const homeOrgs: OrgCard[] = (physioResult.providers || [])
          .filter((p: any) => !isInternalTestOrg(p))
          .map((p: any) => ({
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
      docs = docs.filter((d) => matchesSpecialization(d.specialization, selectedSpec));
      facilities = facilities.filter(
        (o) =>
          matchesSpecialization(o.organization_type, selectedSpec) ||
          matchesSpecialization(o.name, selectedSpec)
      );
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

  const ModeSymbol3D = ({ mode, isOrg = false }: { mode: ConsultMode | 'org'; isOrg?: boolean }) => {
    if (isOrg) {
      return (
        <div
          className="glass-3d-symbol"
          style={{
            width: 68,
            height: 68,
            borderRadius: 20,
            flexShrink: 0,
            background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 249, 255, 0.75) 50%, rgba(224, 242, 254, 0.5) 100%)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1.5px solid rgba(255, 255, 255, 0.9)',
            boxShadow: '0 10px 24px -4px rgba(2, 132, 199, 0.25), inset 0 2px 4px rgba(255, 255, 255, 0.95), inset 0 -2px 5px rgba(2, 132, 199, 0.12)',
            display: 'grid',
            placeItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: 6,
              right: 6,
              height: '42%',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0) 100%)',
              borderRadius: '14px 14px 4px 4px',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 60%, #0c4a6e 100%)',
              display: 'grid',
              placeItems: 'center',
              color: '#ffffff',
              boxShadow: '0 6px 14px -2px rgba(2, 132, 199, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.6), inset 0 -2px 3px rgba(0, 0, 0, 0.25)',
            }}
          >
            <Building2 size={22} />
          </div>
        </div>
      );
    }

    if (mode === 'teleconsultation') {
      return (
        <div
          className="glass-3d-symbol"
          title="Video Consultation"
          style={{
            width: 68,
            height: 68,
            borderRadius: 20,
            flexShrink: 0,
            background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(224, 242, 254, 0.75) 50%, rgba(186, 230, 253, 0.5) 100%)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1.5px solid rgba(255, 255, 255, 0.9)',
            boxShadow: '0 10px 24px -4px rgba(2, 132, 199, 0.32), inset 0 2px 4px rgba(255, 255, 255, 0.95), inset 0 -2px 5px rgba(2, 132, 199, 0.15)',
            display: 'grid',
            placeItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: 6,
              right: 6,
              height: '42%',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0) 100%)',
              borderRadius: '14px 14px 4px 4px',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 60%, #0c4a6e 100%)',
              display: 'grid',
              placeItems: 'center',
              color: '#ffffff',
              boxShadow: '0 6px 14px -2px rgba(2, 132, 199, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.6), inset 0 -2px 3px rgba(0, 0, 0, 0.25)',
            }}
          >
            <Video size={22} />
          </div>
        </div>
      );
    }

    if (mode === 'home') {
      return (
        <div
          className="glass-3d-symbol"
          title="Home Visit"
          style={{
            width: 68,
            height: 68,
            borderRadius: 20,
            flexShrink: 0,
            background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(236, 253, 245, 0.75) 50%, rgba(209, 250, 229, 0.5) 100%)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1.5px solid rgba(255, 255, 255, 0.9)',
            boxShadow: '0 10px 24px -4px rgba(16, 185, 129, 0.25), inset 0 2px 4px rgba(255, 255, 255, 0.95), inset 0 -2px 5px rgba(16, 185, 129, 0.12)',
            display: 'grid',
            placeItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: 6,
              right: 6,
              height: '42%',
              background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0) 100%)',
              borderRadius: '14px 14px 4px 4px',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #059669 0%, #047857 60%, #064e3b 100%)',
              display: 'grid',
              placeItems: 'center',
              color: '#ffffff',
              boxShadow: '0 6px 14px -2px rgba(5, 150, 105, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.6), inset 0 -2px 3px rgba(0, 0, 0, 0.25)',
            }}
          >
            <Home size={22} />
          </div>
        </div>
      );
    }

    // Default: 'walkin' in-person visit
    return (
      <div
        className="glass-3d-symbol"
        title="Walk-in Visit"
        style={{
          width: 68,
          height: 68,
          borderRadius: 20,
          flexShrink: 0,
          background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(241, 245, 249, 0.8) 50%, rgba(226, 232, 240, 0.6) 100%)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1.5px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 10px 24px -4px rgba(15, 23, 42, 0.22), inset 0 2px 4px rgba(255, 255, 255, 0.95), inset 0 -2px 5px rgba(15, 23, 42, 0.12)',
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: 6,
            right: 6,
            height: '42%',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0) 100%)',
            borderRadius: '14px 14px 4px 4px',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #0284c7 100%)',
            display: 'grid',
            placeItems: 'center',
            color: '#ffffff',
            boxShadow: '0 6px 14px -2px rgba(15, 23, 42, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.6), inset 0 -2px 3px rgba(0, 0, 0, 0.25)',
          }}
        >
          <Stethoscope size={22} />
        </div>
      </div>
    );
  };

  const modeButton = (mode: ConsultMode, label: string, IconComp: any) => {
    const isActive = consultMode === mode;
    return (
      <button
        onClick={() => setConsultMode(mode)}
        style={{
          flex: 1,
          padding: '12px 18px',
          borderRadius: 12,
          border: isActive ? '1.5px solid rgba(255, 255, 255, 0.4)' : '1px solid transparent',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: '0.88rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: isActive
            ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
            : 'transparent',
          color: isActive ? '#ffffff' : 'var(--cm-navy, #0f172a)',
          boxShadow: isActive
            ? '0 6px 18px -2px rgba(2, 132, 199, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.45)'
            : 'none',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          whiteSpace: 'nowrap',
        }}
      >
        <IconComp size={18} style={{ opacity: isActive ? 1 : 0.7 }} />
        <span>{label}</span>
      </button>
    );
  };

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

        {/* ── Mode Toggle (Glassmorphic CallMedex Design) ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28,
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 16,
          padding: 8,
          maxWidth: 620,
          margin: '0 auto 28px',
          border: '1.5px solid rgba(2, 132, 199, 0.22)',
          boxShadow: '0 8px 32px -4px rgba(2, 132, 199, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
        }}>
          {modeButton('teleconsultation', 'Video Consultation', Video)}
          {modeButton('walkin', 'Walk-in Visit', Stethoscope)}
          {modeButton('home', 'Home Visit', Home)}
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

        {/* Specialization Filter (Glassmorphic CallMedex Design) */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
          {SPECIALIZATIONS.map((spec) => {
            const isActive = selectedSpec === spec;
            return (
              <button
                key={spec}
                onClick={() => setSelectedSpec(spec)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 22,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isActive
                    ? '1.5px solid rgba(255, 255, 255, 0.4)'
                    : '1px solid rgba(2, 132, 199, 0.16)',
                  background: isActive
                    ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                    : 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: isActive ? '#ffffff' : 'var(--cm-navy, #1e293b)',
                  boxShadow: isActive
                    ? '0 4px 14px rgba(2, 132, 199, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.35)'
                    : '0 2px 6px rgba(2, 132, 199, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {spec}
              </button>
            );
          })}
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
                    style={{
                      padding: 24,
                      display: 'flex',
                      gap: 20,
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.88)',
                      backdropFilter: 'blur(14px)',
                      WebkitBackdropFilter: 'blur(14px)',
                      border: '1.5px solid rgba(2, 132, 199, 0.16)',
                      borderRadius: 18,
                      boxShadow: '0 6px 20px -2px rgba(2, 132, 199, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <ModeSymbol3D mode="org" isOrg={true} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '1.02rem', fontWeight: 800, color: 'var(--cm-navy, #0f172a)', marginBottom: 4 }}>
                            {org.name}
                          </h4>
                          <div style={{ fontSize: '0.82rem', color: 'var(--color-gray-500)' }}>
                            {ORG_TYPE_LABEL[org.organization_type] || org.organization_type}
                            {consultMode === 'home' && org.home_service_enabled ? ' · Home service' : ''}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: 'rgba(34, 197, 94, 0.14)',
                          color: '#15803d',
                          border: '1px solid rgba(34, 197, 94, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          ● Verified
                        </span>
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
                            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-navy)' }}>
                              from ₹{org.min_price}
                            </span>
                          )}
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOrgBooking(org)}
                            style={{
                              minWidth: 110,
                              borderRadius: 10,
                              fontWeight: 700,
                              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                              border: 'none',
                              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                              color: '#ffffff',
                            }}
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
                    style={{
                      padding: 24,
                      display: 'flex',
                      gap: 20,
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.88)',
                      backdropFilter: 'blur(14px)',
                      WebkitBackdropFilter: 'blur(14px)',
                      border: '1.5px solid rgba(2, 132, 199, 0.16)',
                      borderRadius: 18,
                      boxShadow: '0 6px 20px -2px rgba(2, 132, 199, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <ModeSymbol3D mode={consultMode} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--cm-navy, #0f172a)', marginBottom: 4 }}>
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
                          {doc.hospital_clinic_name && (
                            <div style={{ fontSize: '0.78rem', color: '#0d9488', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                              <Building2 size={12} /> {doc.hospital_clinic_name}
                            </div>
                          )}
                          <div style={{ marginTop: 6 }}>
                            <button
                              type="button"
                              onClick={() => setPresentationDoctor(doc)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                background: 'rgba(13, 148, 136, 0.08)',
                                color: '#0d9488',
                                border: '1px solid rgba(13, 148, 136, 0.25)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <Sparkles size={12} style={{ color: '#0d9488' }} />
                              <span>View Profile & Tariff Justification</span>
                            </button>
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: doc.available ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                          color: doc.available ? '#15803d' : '#dc2626',
                          border: doc.available ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          ● {doc.available ? 'AVAILABLE' : 'BUSY'}
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
                          <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--color-navy)' }}>
                            ₹{doc.consultation_fee}
                          </span>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={!doc.available}
                            onClick={() => handleConsult(doc)}
                            style={{
                              minWidth: 110,
                              borderRadius: 10,
                              fontWeight: 700,
                              background: doc.available
                                ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                                : 'var(--cm-line)',
                              color: doc.available ? '#ffffff' : 'var(--cm-ink-4)',
                              border: 'none',
                              boxShadow: doc.available ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none',
                              cursor: doc.available ? 'pointer' : 'not-allowed',
                            }}
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

        {/* Doctor Professional Presentation Modal */}
        <DoctorPresentationModal
          isOpen={!!presentationDoctor}
          onClose={() => setPresentationDoctor(null)}
          doctor={presentationDoctor}
          onBook={(mode) => {
            if (presentationDoctor) {
              const doc = presentationDoctor;
              setPresentationDoctor(null);
              if (mode === 'teleconsultation') {
                router.push(`/consultation/${doc.doctor_id}?name=${encodeURIComponent(doc.name)}&spec=${encodeURIComponent(doc.specialization)}&fee=${doc.consultation_fee}`);
              } else if (mode === 'home') {
                router.push(`/booking?type=home_doctor&doctor=${doc.doctor_id}&name=${encodeURIComponent(doc.name)}&spec=${encodeURIComponent(doc.specialization)}&fee=${doc.consultation_fee}`);
              } else {
                router.push(`/booking?type=doctor&doctor=${doc.doctor_id}&name=${encodeURIComponent(doc.name)}&spec=${encodeURIComponent(doc.specialization)}&fee=${doc.consultation_fee}`);
              }
            }
          }}
        />

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
