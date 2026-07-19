/**
 * Consultation Page — Doctor Listing for Video Consultation
 * API-connected with search, filter, and real-time availability.
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { telemedAPI } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

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

export default function ConsultationPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [selectedSpec, setSelectedSpec] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

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

    setFilteredDoctors(filtered);
  }, [doctors, selectedSpec, searchQuery]);

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
    router.push(`/consultation/${doctor.doctor_id}?name=${encodeURIComponent(doctor.name)}&spec=${encodeURIComponent(doctor.specialization)}&fee=${doctor.consultation_fee}`);
  };

  return (
    <div className="section">
      <div className="container">
        <div className="section-title">
          <h1>Video Consultation</h1>
          <p>Connect with verified doctors via HD video call — with AI-generated e-prescriptions</p>
        </div>

        {/* Search Bar */}
        <div style={{ maxWidth: 500, margin: '0 auto var(--space-lg)', position: 'relative' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search by doctor name, specialization, or language..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 16, fontSize: '0.95rem' }}
          />
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
                        background: 'linear-gradient(135deg, var(--color-navy) 0%, var(--color-navy-light) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.8rem',
                        color: '#fff',
                      }}
                    >
                      👨‍⚕️
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
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
                            ₹{doc.consultation_fee}
                          </span>
                          <button
                            className="btn btn-teal btn-sm"
                            disabled={!doc.available}
                            onClick={() => handleConsult(doc)}
                            style={{ minWidth: 100 }}
                          >
                            {doc.available ? '📹 Consult' : 'Unavailable'}
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
