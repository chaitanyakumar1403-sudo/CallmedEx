"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LocationPicker from '../../../../components/LocationPicker';
import { HeartPulse, Bell, Search, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';

const NURSING_SERVICES = [
  { id: 'wound_dressing', name: 'Wound Dressing', icon: '🩹', desc: 'Post-surgical or injury wound care', duration: '30-60 min' },
  { id: 'injection', name: 'Injection', icon: '💉', desc: 'IM, IV, or subcutaneous injections', duration: '15-30 min' },
  { id: 'iv_infusion', name: 'IV Infusion', icon: '💧', desc: 'IV drip setup and monitoring', duration: '1-3 hours' },
  { id: 'post_operative', name: 'Post-Op Care', icon: '🏥', desc: 'Post-surgery recovery assistance', duration: '2-4 hours' },
  { id: 'catheter_care', name: 'Catheter Care', icon: '🧴', desc: 'Urinary catheter management', duration: '30-60 min' },
  { id: 'elderly_care', name: 'Elderly Care', icon: '👵', desc: 'Companion care, medication management', duration: '4-8 hours' },
  { id: 'pediatric', name: 'Pediatric Care', icon: '👶', desc: 'Infant and child healthcare', duration: '1-4 hours' },
  { id: 'general', name: 'General Nursing', icon: '👩‍⚕️', desc: 'Vitals, basic care, assessments', duration: '1-2 hours' },
];

export default function NurseBookingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [addressDetails, setAddressDetails] = useState({ house: '', landmark: '', floor: '' });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  // Get location
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const handleBook = async () => {
    if (!selectedService || !address || !location) return;
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/dispatch/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider_type: 'nurse',
          service_subtype: selectedService,
          patient_lat: location.lat,
          patient_lng: location.lng,
          patient_address: address,
          patient_address_details: addressDetails,
          notes,
        }),
      });
      const data = await res.json();
      if (data.success || data.dispatch_id) {
        // Hand the dispatch to the dashboard's live tracker. Without this the
        // patient was left on a dead "Searching for Nurses…" screen with no
        // way back to the request — the dashboard only picks up tracking from
        // this localStorage key.
        if (data.dispatch_id && typeof window !== 'undefined') {
          localStorage.setItem('activeDispatchId', data.dispatch_id);
        }
        if (data.booking_id && typeof window !== 'undefined') {
          localStorage.setItem('activeBookingId', data.booking_id);
        }
        setResult(data);
        setStep(4);
      } else {
        setError(data.detail || 'Booking failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedServiceData = NURSING_SERVICES.find(s => s.id === selectedService);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', padding: 20 }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #ec4899 0%, #9333ea 100%)',
          borderRadius: 16,
          padding: '30px 40px',
          color: 'white',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <HeartPulse size={28} />
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Book a Home Nurse</h1>
          </div>
          <p style={{ margin: '8px 0 0 0', opacity: 0.85, fontSize: '0.9rem' }}>
            Professional nurses at your doorstep within minutes
          </p>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
          {['Select Service', 'Your Location', 'Confirm', 'Tracking'].map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', margin: '0 auto 6px',
                backgroundColor: step > i ? '#059669' : step === i + 1 ? '#2563eb' : '#e5e7eb',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700,
              }}>{step > i ? '✓' : i + 1}</div>
              <div style={{ fontSize: '0.7rem', color: step === i + 1 ? '#2563eb' : '#9ca3af', fontWeight: step === i + 1 ? 700 : 400 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Step 1: Select Service */}
        {step === 1 && (
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1a2b4a' }}>What service do you need?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {NURSING_SERVICES.map(service => (
                <div
                  key={service.id}
                  onClick={() => setSelectedService(service.id)}
                  style={{
                    padding: 16, borderRadius: 10, cursor: 'pointer',
                    border: selectedService === service.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    backgroundColor: selectedService === service.id ? '#eff6ff' : 'white',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{service.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1a2b4a' }}>{service.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>{service.desc}</div>
                  <div style={{ fontSize: '0.7rem', color: '#2563eb', marginTop: 6, fontWeight: 500 }}>⏱ {service.duration}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => selectedService && setStep(2)}
              disabled={!selectedService}
              style={{
                width: '100%', marginTop: 20, padding: '14px', borderRadius: 10,
                border: 'none', fontSize: '1rem', fontWeight: 700, cursor: selectedService ? 'pointer' : 'not-allowed',
                backgroundColor: selectedService ? '#2563eb' : '#d1d5db',
                color: selectedService ? 'white' : '#9ca3af',
              }}
            >Continue →</button>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1a2b4a' }}>📍 Your Location</h3>
            <div style={{ marginBottom: 16 }}>
              <LocationPicker
                label="Full Address"
                required
                initialAddress={address}
                onLocationSelect={(loc) => {
                  setAddress(loc.address);
                  setLocation({ lat: loc.lat, lng: loc.lng });
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <input placeholder="House/Flat No." value={addressDetails.house} onChange={e => setAddressDetails({ ...addressDetails, house: e.target.value })} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
              <input placeholder="Landmark" value={addressDetails.landmark} onChange={e => setAddressDetails({ ...addressDetails, landmark: e.target.value })} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
              <input placeholder="Floor" value={addressDetails.floor} onChange={e => setAddressDetails({ ...addressDetails, floor: e.target.value })} style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Additional Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any specific instructions for the nurse..."
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #d1d5db', minHeight: 60, fontSize: '0.9rem' }}
              />
            </div>
            {location && (
              <div style={{ fontSize: '0.75rem', color: '#059669', marginBottom: 16 }}>
                📍 GPS Location captured: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>← Back</button>
              <button onClick={() => address && setStep(3)} disabled={!address} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', backgroundColor: address ? '#2563eb' : '#d1d5db', color: 'white', cursor: address ? 'pointer' : 'not-allowed', fontWeight: 700 }}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && selectedServiceData && (
          <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1a2b4a' }}>Confirm Your Booking</h3>
            <div style={{ backgroundColor: '#f8fafc', borderRadius: 10, padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '2rem' }}>{selectedServiceData.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#1a2b4a' }}>{selectedServiceData.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>⏱ {selectedServiceData.duration}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: 8 }}>📍 {address}</div>
              {notes && <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>📝 {notes}</div>}
            </div>

            <div style={{ backgroundColor: '#eff6ff', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: '0.85rem', color: '#1e40af' }}>
              💡 <strong>How it works:</strong> We&apos;ll find the nearest available nurse and dispatch them to your location. You&apos;ll see real-time tracking once assigned.
            </div>

            {error && <div style={{ color: '#dc2626', marginBottom: 12, fontWeight: 600 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>← Back</button>
              <button
                onClick={handleBook}
                disabled={loading}
                style={{
                  flex: 2, padding: '14px', borderRadius: 10, border: 'none',
                  background: loading ? '#d1d5db' : 'linear-gradient(135deg, #ec4899, #9333ea)',
                  color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem',
                }}
              >{loading ? 'Finding nearest nurse...' : 'Confirm Nurse Visit'}</button>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 4 && result && (
          <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 32, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            {result.all_candidates > 0 ? (
              <>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                  <Bell size={32} />
                </div>
                <h2 style={{ color: '#0f172a', fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>Request Sent to Nearby Nurses</h2>
                <div style={{ backgroundColor: '#f0fdf4', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid #bbf7d0' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#166534', marginBottom: 6 }}>
                    {result.all_candidates} verified {result.all_candidates === 1 ? 'nurse' : 'nurses'} near you {result.all_candidates === 1 ? 'has' : 'have'} been notified
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#15803d' }}>
                    The first available nurse to accept is assigned to your visit. Live confirmation usually takes 1-3 minutes.
                  </div>
                </div>

                {result.booking_id && (
                  <div style={{ marginBottom: 20, padding: '10px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={16} color="#0284c7" />
                    <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                      Booking Reference: <strong style={{ color: '#0f172a' }}>{result.booking_id}</strong>
                    </span>
                  </div>
                )}

                <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px auto' }}>
                  You&apos;ll be notified the moment a nurse accepts. You can track their en-route progress live, verify credentials, and review this appointment anytime in My Bookings.
                </p>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => router.push('/dashboard/patient')}
                    style={{ padding: '12px 24px', borderRadius: 10, border: 'none', backgroundColor: '#059669', color: 'white', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    Track My Request Live <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/patient?tab=bookings')}
                    style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <Calendar size={16} /> View in My Bookings
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                  <Search size={32} />
                </div>
                <h2 style={{ color: '#d97706', marginBottom: 8, fontSize: '1.4rem', fontWeight: 800 }}>No Nurse Available Right Now</h2>
                <p style={{ color: '#6b7280', marginBottom: 12 }}>{result.message}</p>
                {result.booking_id && (
                  <div style={{ marginBottom: 16, padding: '8px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'inline-block' }}>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      Booking Queued Reference: <strong style={{ color: '#0f172a' }}>{result.booking_id}</strong>
                    </span>
                  </div>
                )}
                <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: 12, maxWidth: 500, margin: '12px auto 20px auto' }}>
                  We&apos;re widening the search perimeter. If no immediate provider accepts, our dispatch desk will follow up directly.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button
                    onClick={() => router.push('/dashboard/patient')}
                    style={{ padding: '12px 24px', borderRadius: 10, border: 'none', backgroundColor: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Go to Dashboard
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/patient?tab=bookings')}
                    style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 700 }}
                  >
                    My Bookings
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
