'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { discoveryAPI } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import DoctorPresentationModal from '@/app/components/DoctorPresentationModal';
import NRISpecializationSelect from './components/NRISpecializationSelect';
import {
  Globe,
  Video,
  ShieldCheck,
  Search,
  Clock,
  MapPin,
  Award,
  Building,
  CheckCircle2,
  Filter,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Calendar,
  FileText,
  AlertCircle,
  X,
} from 'lucide-react';

interface NRIDoctor {
  id: string;
  doctor_id?: string;
  name: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  country: string;
  timezone: string;
  license_body: string;
  hospital_clinic_name?: string;
  bio?: string;
  fee_justification?: string;
  consultation_fee: number;
  online_fee: number;
  profile_photo_url?: string;
  languages?: string[];
  available: boolean;
}

const COUNTRIES = [
  { id: 'All', label: 'All Overseas', code: 'GLOBAL' },
  { id: 'USA', label: 'United States', code: 'US' },
  { id: 'UK', label: 'United Kingdom', code: 'UK' },
  { id: 'UAE', label: 'UAE / Dubai', code: 'UAE' },
  { id: 'Australia', label: 'Australia', code: 'AU' },
  { id: 'Canada', label: 'Canada', code: 'CA' },
  { id: 'Singapore', label: 'Singapore', code: 'SG' },
  { id: 'Germany', label: 'Germany', code: 'DE' },
];

const SPECIALIZATIONS = [
  'All',
  'Cardiology',
  'Neurology',
  'Oncology',
  'Pediatrics',
  'Orthopedics',
  'Internal Medicine',
  'Endocrinology',
  'Gastroenterology',
  'Dermatology',
];

function NRIDoctorAvatar({ doc }: { doc: NRIDoctor }) {
  const [imgError, setImgError] = useState(false);
  const initials = doc.name
    ? doc.name.replace(/^Dr\.?\s+/i, '').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DR';

  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      {doc.profile_photo_url && !imgError ? (
        <img
          src={doc.profile_photo_url}
          alt={`Dr. ${doc.name}`}
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2.5px solid #0284c7',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.22)',
            background: '#f8fafc',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0f1d33 0%, #1a2b4a 60%, #0369a1 100%)',
            border: '2.5px solid #0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '1.25rem',
            letterSpacing: '0.04em',
            boxShadow: '0 4px 12px rgba(15, 29, 51, 0.25)',
          }}
        >
          {initials}
        </div>
      )}

      {/* Online Teleconsult status dot */}
      <span
        title={doc.available ? "Doctor is available for online consultation" : "Currently offline"}
        style={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          backgroundColor: doc.available ? '#10b981' : '#94a3b8',
          border: '2.5px solid #ffffff',
          boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
        }}
      />
    </div>
  );
}

function NRIConsultationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [selectedSpec, setSelectedSpec] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [doctors, setDoctors] = useState<NRIDoctor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [presentationDoctor, setPresentationDoctor] = useState<any | null>(null);

  useEffect(() => {
    const countryParam = searchParams.get('country');
    if (countryParam && COUNTRIES.some((c) => c.id.toLowerCase() === countryParam.toLowerCase())) {
      setSelectedCountry(countryParam.toUpperCase());
    }
    const specParam = searchParams.get('spec');
    if (specParam) setSelectedSpec(specParam);
  }, [searchParams]);

  useEffect(() => {
    fetchNRIDoctors();
  }, [selectedCountry, selectedSpec]);

  const fetchNRIDoctors = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await discoveryAPI.getNRIDoctors({
        country: selectedCountry !== 'All' ? selectedCountry : undefined,
        specialization: selectedSpec !== 'All' ? selectedSpec : undefined,
      });

      if (res && res.doctors) {
        setDoctors(res.doctors);
      } else {
        setDoctors([]);
      }
    } catch (err: any) {
      console.error('Failed to load NRI doctors:', err);
      setError(err?.message || 'Unable to fetch overseas doctor directory. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) return doctors;
    const q = searchQuery.toLowerCase();
    return doctors.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.specialization?.toLowerCase().includes(q) ||
        d.country?.toLowerCase().includes(q) ||
        d.hospital_clinic_name?.toLowerCase().includes(q) ||
        d.license_body?.toLowerCase().includes(q)
    );
  }, [doctors, searchQuery]);

  const specialtyDoctorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    doctors.forEach((d) => {
      const s = d.specialization;
      if (s) {
        counts[s] = (counts[s] || 0) + 1;
      }
    });
    return counts;
  }, [doctors]);

  const handleBookVideo = (doc: NRIDoctor) => {
    if (!isAuthenticated) {
      router.push(`/auth/login?redirect=${encodeURIComponent('/nri-consultation')}`);
      return;
    }
    const docId = doc.doctor_id || doc.id;
    const fee = doc.online_fee || doc.consultation_fee || 1200;
    router.push(
      `/consultation/${docId}?name=${encodeURIComponent(doc.name)}&spec=${encodeURIComponent(
        doc.specialization
      )}&fee=${fee}&mode=teleconsultation&nri=true`
    );
  };

  const handleOpenPresentation = (doc: NRIDoctor) => {
    // Adapter matching DoctorPresentationModal props
    const adapted = {
      doctor_id: doc.doctor_id || doc.id,
      name: doc.name,
      specialization: doc.specialization,
      qualification: doc.qualification,
      experience_years: doc.experience_years,
      consultation_fee: doc.consultation_fee,
      online_fee: doc.online_fee,
      profile_photo_url: doc.profile_photo_url,
      languages: doc.languages || ['English'],
      city: doc.country,
      state: 'Overseas',
      available: doc.available,
      consultation_mode: 'online',
      hospital_clinic_name: doc.hospital_clinic_name,
      bio: doc.bio,
      fee_justification: doc.fee_justification,
      license_number: doc.license_body,
    };
    setPresentationDoctor(adapted);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cm-surface-2)', paddingBottom: 64 }}>
      {/* ─── Hero Section with Signature CallMedex Royal Blue Gradient ─────────── */}
      <section
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #0369a1 50%, #0284c7 100%)',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          padding: '64px 20px 60px',
          borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
        }}
      >
        {/* Ambient background glows */}
        <div
          style={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56,189,248,0.25) 0%, rgba(255,255,255,0) 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -50,
            left: -50,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(2,132,199,0.2) 0%, rgba(255,255,255,0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: 999,
              padding: '6px 16px',
              marginBottom: 20,
              boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            }}
          >
            <Globe size={15} style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#38bdf8' }}>
              Global Telemedicine · NMC &amp; International Board Compliant
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.1rem, 4.5vw, 3.25rem)',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              lineHeight: 1.18,
              marginBottom: 16,
              maxWidth: 860,
              color: '#ffffff',
              textShadow: '0 2px 20px rgba(0,0,0,0.35)',
            }}
          >
            Consult Premier Indian Doctors{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #38bdf8 0%, #e0f2fe 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
              }}
            >
              Practicing Overseas
            </span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(1.05rem, 1.8vw, 1.15rem)',
              lineHeight: 1.65,
              color: 'rgba(240, 249, 255, 0.95)',
              maxWidth: 780,
              marginBottom: 32,
              textShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}
          >
            Connect via secure end-to-end video with verified Non-Resident Indian medical specialists practicing in top healthcare systems worldwide. Get global second opinions, specialized treatment advice, and continuity of care for your loved ones in India.
          </p>

          {/* Quick value props */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              maxWidth: 920,
            }}
          >
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.45)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 14,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              }}
            >
              <ShieldCheck size={26} style={{ color: '#10b981', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#ffffff' }}>Verified Overseas Licenses</div>
                <div style={{ fontSize: '0.8rem', color: '#e0f2fe', marginTop: 2 }}>USMLE, GMC, DHA, AMC Certified</div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.45)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 14,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              }}
            >
              <Award size={26} style={{ color: '#38bdf8', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#ffffff' }}>Transparent INR Tariffs</div>
                <div style={{ fontSize: '0.8rem', color: '#e0f2fe', marginTop: 2 }}>Zero forex markup or conversion fees</div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.45)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 14,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              }}
            >
              <Clock size={26} style={{ color: '#38bdf8', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#ffffff' }}>Timezone Aligned Slots</div>
                <div style={{ fontSize: '0.8rem', color: '#e0f2fe', marginTop: 2 }}>Scheduled around Indian &amp; local hours</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Search & Country Filter Navigation ──────────────────── */}
      <div style={{ maxWidth: 1200, margin: '-24px auto 0', padding: '0 20px', position: 'relative', zIndex: 10 }}>
        <div
          style={{
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 10px 25px -5px rgba(15, 29, 51, 0.08), 0 4px 6px -2px rgba(15, 29, 51, 0.04)',
            border: '1px solid #e2e8f0',
            padding: '20px 24px',
          }}
        >
          {/* Search Input Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search by doctor name, specialty, hospital or board..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 42px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.92rem',
                  outline: 'none',
                  background: '#f8fafc',
                }}
              />
            </div>

            <NRISpecializationSelect
              value={selectedSpec}
              onChange={(spec) => setSelectedSpec(spec)}
              options={SPECIALIZATIONS}
              doctorCounts={specialtyDoctorCounts}
              totalDoctors={doctors.length}
            />
          </div>

          {/* Country Filter Pills */}
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} style={{ color: '#0284c7' }} /> Filter by Country of Practice
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {COUNTRIES.map((c) => {
                const isActive = selectedCountry === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCountry(c.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 999,
                      fontSize: '0.84rem',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      border: isActive ? '1px solid #0284c7' : '1px solid #e2e8f0',
                      background: isActive ? '#0284c7' : '#ffffff',
                      color: isActive ? '#ffffff' : '#334155',
                      boxShadow: isActive ? '0 2px 8px rgba(2, 132, 199, 0.25)' : 'none',
                      transition: 'all 0.15s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Doctors Directory Grid ───────────────────────────────── */}
      <main style={{ maxWidth: 1200, margin: '36px auto 0', padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
              Available Overseas Specialists
            </h2>
            <div style={{ fontSize: '0.86rem', color: '#64748b', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>
                Showing {filteredDoctors.length} verified {selectedCountry !== 'All' ? `${selectedCountry} ` : ''}{selectedSpec !== 'All' ? `${selectedSpec} ` : ''}NRI doctor{filteredDoctors.length === 1 ? '' : 's'}
              </span>
              {(selectedSpec !== 'All' || selectedCountry !== 'All' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSpec('All');
                    setSelectedCountry('All');
                    setSearchQuery('');
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: 999,
                    padding: '2px 9px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: '#0284c7',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e0f2fe';
                    e.currentTarget.style.borderColor = '#0284c7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                >
                  <span>Reset filters</span>
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: '#ffffff',
                  borderRadius: 16,
                  padding: 24,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  minHeight: 260,
                }}
              >
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 20, background: '#e2e8f0', borderRadius: 4, width: '70%', marginBottom: 8 }} />
                    <div style={{ height: 14, background: '#e2e8f0', borderRadius: 4, width: '45%', marginBottom: 6 }} />
                    <div style={{ height: 14, background: '#e2e8f0', borderRadius: 4, width: '60%' }} />
                  </div>
                </div>
                <div style={{ height: 38, background: '#e2e8f0', borderRadius: 8, marginTop: 32 }} />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 12,
              padding: 24,
              textAlign: 'center',
              color: '#991b1b',
            }}
          >
            <AlertCircle size={28} style={{ margin: '0 auto 8px', color: '#dc2626' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px' }}>Directory Temporary Unavailable</h3>
            <p style={{ fontSize: '0.88rem', margin: '0 0 16px', color: '#b91c1c' }}>{error}</p>
            <button
              onClick={fetchNRIDoctors}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                background: '#dc2626',
                color: '#ffffff',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredDoctors.length === 0 && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px dashed #cbd5e1',
              padding: '60px 24px',
              textAlign: 'center',
            }}
          >
            <Globe size={48} style={{ margin: '0 auto 16px', color: '#94a3b8' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
              No Doctors Matching Your Selection
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: 460, margin: '0 auto 20px' }}>
              We are actively onboarding more verified Indian doctors from {selectedCountry !== 'All' ? selectedCountry : 'overseas regions'}. Try resetting filters or exploring all regions.
            </p>
            <button
              onClick={() => {
                setSelectedCountry('All');
                setSelectedSpec('All');
                setSearchQuery('');
              }}
              style={{
                padding: '10px 20px',
                background: '#0284c7',
                color: '#ffffff',
                fontWeight: 600,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Show All Overseas Specialists
            </button>
          </div>
        )}

        {/* Doctor Cards Grid */}
        {!isLoading && !error && filteredDoctors.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: 24,
            }}
          >
            {filteredDoctors.map((doc) => {
              const fee = doc.online_fee || doc.consultation_fee || 1200;
              return (
                <div
                  key={doc.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: 16,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 16px rgba(15, 29, 51, 0.05)',
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  <div>
                    {/* Header Row: Avatar + Info */}
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
                      <NRIDoctorAvatar doc={doc} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                          <h3
                            style={{
                              fontSize: '1.12rem',
                              fontWeight: 700,
                              color: '#0f172a',
                              margin: 0,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            Dr. {doc.name.replace(/^Dr\.?\s+/i, '')}
                          </h3>
                        </div>

                        <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0284c7', marginBottom: 4 }}>
                          {doc.specialization}
                        </div>

                        <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                          {doc.qualification} {doc.experience_years ? `· ${doc.experience_years} yrs exp` : ''}
                        </div>

                        {/* Country & Timezone Chip */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              border: '1px solid #bfdbfe',
                            }}
                          >
                            <MapPin size={11} /> {doc.country}
                          </span>

                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#f8fafc',
                              color: '#475569',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 6,
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <Clock size={11} /> {doc.timezone}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Affiliation / Board */}
                    <div
                      style={{
                        background: '#f8fafc',
                        borderRadius: 10,
                        padding: '10px 14px',
                        border: '1px solid #f1f5f9',
                        marginBottom: 16,
                        fontSize: '0.78rem',
                        color: '#475569',
                      }}
                    >
                      {doc.hospital_clinic_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontWeight: 600, color: '#1e293b' }}>
                          <Building size={13} style={{ color: '#0284c7' }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.hospital_clinic_name}
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Award size={13} style={{ color: '#10b981' }} />
                        <span>License: {doc.license_body || 'Verified International Board'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing & CTAs */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 12,
                        borderTop: '1px solid #f1f5f9',
                        marginBottom: 14,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                          Video Consultation
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                          ₹{fee.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenPresentation(doc)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0284c7',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '4px 6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        View Profile & Tariff
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={!doc.available}
                      onClick={() => handleBookVideo(doc)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        background: doc.available
                          ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                          : '#e2e8f0',
                        color: doc.available ? '#ffffff' : '#94a3b8',
                        border: 'none',
                        boxShadow: doc.available ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none',
                        cursor: doc.available ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        minHeight: 44,
                      }}
                    >
                      <Video size={16} />
                      {doc.available ? 'Book Video Consultation' : 'Currently Offline'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Compliance & Trust Notice Banner */}
        <div
          style={{
            marginTop: 48,
            padding: 24,
            borderRadius: 14,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={24} style={{ color: '#10b981' }} />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <h4 style={{ margin: '0 0 4px', fontSize: '0.96rem', fontWeight: 700, color: '#0f172a' }}>
              Full Compliance with NMC 2026 & Telemedicine Practice Guidelines
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
              Overseas Indian physicians on CallmedEx possess verified primary Indian medical registrations (MBBS) or accredited reciprocal postgraduate board qualifications. All video consultations generate cryptographically signed e-prescriptions compliant with BIS generic medicine guidelines, and any diagnostic follow-ups can be fulfilled right at your doorstep in India through CallmedEx certified phlebotomists.
            </p>
          </div>
        </div>
      </main>

      {/* Doctor Presentation Modal */}
      {presentationDoctor && (
        <DoctorPresentationModal
          isOpen={!!presentationDoctor}
          onClose={() => setPresentationDoctor(null)}
          doctor={presentationDoctor}
          onBook={(mode) => {
            const doc = presentationDoctor;
            setPresentationDoctor(null);
            handleBookVideo({
              id: doc.doctor_id,
              name: doc.name,
              specialization: doc.specialization,
              qualification: doc.qualification,
              experience_years: doc.experience_years,
              country: doc.city,
              timezone: 'UTC',
              license_body: doc.license_number || 'Medical Board',
              consultation_fee: doc.consultation_fee,
              online_fee: doc.online_fee || doc.consultation_fee,
              available: doc.available,
            });
          }}
        />
      )}
    </div>
  );
}

export default function NRIConsultationPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#64748b' }}>Loading NRI consultation directory...</p>
        </div>
      }
    >
      <NRIConsultationContent />
    </Suspense>
  );
}
