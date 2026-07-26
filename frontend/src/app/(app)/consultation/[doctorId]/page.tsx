/**
 * Video Call Room Page — /consultation/[doctorId]
 * Full video consultation flow:
 * 1. Pre-call: Consent capture + waiting room
 * 2. In-call: Jitsi Meet embed with controls
 * 3. Post-call: AI prescription display
 */
'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { telemedAPI } from '@/lib/api';
import ConsentModal from '../components/ConsentModal';
import VideoRoom from '../components/VideoRoom';
import PrescriptionView from '../components/PrescriptionView';

type CallPhase = 'consent' | 'connecting' | 'in_call' | 'ended' | 'prescription';

function VideoCallPageContent({ params }: { params: Promise<{ doctorId: string }> }) {
  const { doctorId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const doctorName = searchParams.get('name') || 'Doctor';
  const specialization = searchParams.get('spec') || '';
  const fee = searchParams.get('fee') || '499';

  const [phase, setPhase] = useState<CallPhase>('consent');
  const [consultationId, setConsultationId] = useState('');
  const [roomUrl, setRoomUrl] = useState('');
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [prescription, setPrescription] = useState<any>(null);
  const [transcript, setTranscript] = useState('');

  // Auth gate
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/auth/login?redirect=/consultation/${doctorId}`);
    }
  }, [authLoading, isAuthenticated, router, doctorId]);

  const handleConsent = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await telemedAPI.startConsultation(doctorId, true);
      setConsultationId(result.consultation_id);
      setRoomUrl(result.video_url);
      setRoomName(result.room_name);
      setPhase('connecting');

      // Join the room
      await telemedAPI.joinRoom(result.consultation_id);
      setPhase('in_call');
    } catch (err: any) {
      setError(err.message || 'Failed to start consultation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallEnd = async () => {
    setPhase('ended');

    try {
      await telemedAPI.endConsultation(consultationId);
    } catch (err) {
      console.error('Failed to end consultation:', err);
    }
  };

  const handleFinalize = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await telemedAPI.finalizeConsultation(
        consultationId,
        transcript || 'Patient presented for a general consultation. Doctor examined and prescribed medications as needed.'
      );
      setPrescription(result.ai_analysis);
      setPhase('prescription');
    } catch (err: any) {
      setError(err.message || 'Failed to generate prescription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPrescription = () => {
    if (prescription?.generated_eprescription_url) {
      window.open(prescription.generated_eprescription_url, '_blank');
    }
  };

  if (authLoading) {
    return (
      <div className="section" style={{ textAlign: 'center', padding: '80px 0' }}>
        <div className="spinner-lg" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--color-gray-500)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="consultation-room">
      {/* ── Phase 1: Consent ────────────────────────────────────────── */}
      {phase === 'consent' && (
        <>
          {/* Doctor info bar */}
          <div className="precall-header">
            <div className="container">
              <div className="precall-header__content">
                <button className="btn btn-secondary btn-sm" onClick={() => router.push('/consultation')}>
                  ← Back
                </button>
                <div className="precall-header__doctor">
                  <div className="precall-header__avatar">👨‍⚕️</div>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.1rem', margin: 0 }}>
                      {doctorName}
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', margin: 0 }}>
                      {specialization} · ₹{fee}
                    </p>
                  </div>
                </div>
                <div className="badge badge-success">● Ready</div>
              </div>
            </div>
          </div>

          <ConsentModal
            doctorName={doctorName}
            onConsent={handleConsent}
            onCancel={() => router.push('/consultation')}
            isLoading={isLoading}
          />

          {error && (
            <div className="container" style={{ marginTop: 16 }}>
              <div className="card" style={{ padding: 16, background: '#fef2f2', border: '1px solid var(--color-red-light)', textAlign: 'center' }}>
                <p style={{ color: 'var(--color-red)' }}>❌ {error}</p>
                <button className="btn btn-sm btn-primary" onClick={() => setError('')} style={{ marginTop: 8 }}>
                  Try Again
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Phase 2: Connecting ─────────────────────────────────────── */}
      {phase === 'connecting' && (
        <div className="section" style={{ textAlign: 'center', padding: '120px 0' }}>
          <div className="spinner-lg" style={{ margin: '0 auto 24px' }} />
          <h2 style={{ marginBottom: 8 }}>Connecting to Video Room</h2>
          <p style={{ color: 'var(--color-gray-500)' }}>
            Setting up your secure consultation with {doctorName}...
          </p>
          <p style={{ color: 'var(--color-gray-400)', fontSize: '0.85rem', marginTop: 8 }}>
            🔒 End-to-end encrypted · NMC 2026 compliant
          </p>
        </div>
      )}

      {/* ── Phase 3: In Call ─────────────────────────────────────────── */}
      {phase === 'in_call' && roomUrl && (
        <VideoRoom
          roomName={roomName}
          roomUrl={roomUrl}
          userName={user?.full_name || 'Patient'}
          userEmail={user?.email}
          consultationId={consultationId}
          onCallEnd={handleCallEnd}
          onError={(err) => setError(err)}
        />
      )}

      {/* ── Phase 4: Call Ended ──────────────────────────────────────── */}
      {phase === 'ended' && (
        <div className="section">
          <div className="container" style={{ maxWidth: 600 }}>
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
              <h2 style={{ marginBottom: 8 }}>Consultation Complete</h2>
              <p style={{ color: 'var(--color-gray-500)', marginBottom: 24 }}>
                Your consultation with {doctorName} has ended.
              </p>

              {/* Transcript input (optional for AI) */}
              <div className="form-group" style={{ textAlign: 'left', marginBottom: 24 }}>
                <label className="form-label">
                  📝 Consultation Notes (optional — helps AI generate a better prescription)
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Add any notes about symptoms discussed, medications mentioned, or advice given..."
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {error && (
                <p style={{ color: 'var(--color-red)', marginBottom: 16 }}>❌ {error}</p>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-teal btn-lg"
                  onClick={handleFinalize}
                  disabled={isLoading}
                  style={{ minWidth: 240 }}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-inline" /> Generating Prescription...
                    </>
                  ) : (
                    '🤖 Generate AI E-Prescription'
                  )}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => router.push('/consultation')}
                >
                  Skip & Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 5: Prescription ───────────────────────────────────── */}
      {phase === 'prescription' && prescription && (
        <div className="section">
          <div className="container" style={{ maxWidth: 700 }}>
            <PrescriptionView
              prescription={prescription}
              doctorName={doctorName}
              consultationId={consultationId}
              consultationDate={new Date().toISOString()}
              onClose={() => router.push('/consultation')}
              onDownload={handleDownloadPrescription}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function VideoCallPage({ params }: { params: Promise<{ doctorId: string }> }) {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}>Loading...</div>}>
      <VideoCallPageContent params={params} />
    </Suspense>
  );
}
