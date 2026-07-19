/**
 * PrescriptionView — AI-Generated E-Prescription Display
 * Post-consultation prescription with download and share options.
 */
'use client';

interface Medicine {
  generic_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: string;
}

interface PrescriptionData {
  summary: string;
  diagnosis?: string;
  medicines: Medicine[];
  investigations?: string[];
  advice?: string[];
  requires_followup: boolean;
  followup_in_days?: number;
  generated_eprescription_url?: string;
}

interface PrescriptionViewProps {
  prescription: PrescriptionData;
  doctorName: string;
  consultationId: string;
  consultationDate: string;
  onClose?: () => void;
  onDownload?: () => void;
}

export default function PrescriptionView({
  prescription,
  doctorName,
  consultationId,
  consultationDate,
  onClose,
  onDownload,
}: PrescriptionViewProps) {
  const handleShare = () => {
    const text = `📋 E-Prescription from ${doctorName}\n\n${prescription.summary}\n\n💊 Medicines:\n${prescription.medicines.map((m) => `• ${m.generic_name} — ${m.dosage}, ${m.frequency}, ${m.duration}`).join('\n')}\n\n📅 ${prescription.requires_followup ? `Follow-up in ${prescription.followup_in_days || 7} days` : 'No follow-up needed'}\n\nGenerated via CallMedex`;

    if (navigator.share) {
      navigator.share({ title: 'E-Prescription', text });
    } else {
      navigator.clipboard.writeText(text);
      alert('Prescription copied to clipboard!');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="prescription">
      {/* Header */}
      <div className="prescription__header">
        <div className="prescription__title">
          <h3>📋 AI-Generated E-Prescription</h3>
          <p>Consultation ID: {consultationId.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className="prescription__doctor">
          <strong>{doctorName}</strong>
          <span>{formatDate(consultationDate)}</span>
        </div>
      </div>

      {/* Clinical Summary */}
      <div className="prescription__section">
        <h4>📝 Clinical Summary</h4>
        <p>{prescription.summary}</p>
        {prescription.diagnosis && (
          <p style={{ marginTop: 8, fontWeight: 600, color: 'var(--color-navy)' }}>
            Diagnosis: {prescription.diagnosis}
          </p>
        )}
      </div>

      {/* Medicines */}
      <div className="prescription__section">
        <h4>💊 Prescribed Medicines</h4>
        <div className="prescription__note">
          ⚠️ All medicines listed with generic names as per BIS mandate
        </div>
        <div className="prescription__medicines">
          {prescription.medicines.map((med, i) => (
            <div key={i} className="prescription__med-card">
              <div className="prescription__med-number">{i + 1}</div>
              <div className="prescription__med-details">
                <strong>{med.generic_name}</strong>
                <div className="prescription__med-info">
                  <span>💊 {med.dosage}</span>
                  <span>⏰ {med.frequency}</span>
                  <span>📅 {med.duration}</span>
                  {med.route && <span>💉 {med.route}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Investigations */}
      {prescription.investigations && prescription.investigations.length > 0 && (
        <div className="prescription__section">
          <h4>🔬 Investigations Ordered</h4>
          <ul className="prescription__list">
            {prescription.investigations.map((inv, i) => (
              <li key={i}>{inv}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Advice */}
      {prescription.advice && prescription.advice.length > 0 && (
        <div className="prescription__section">
          <h4>💡 Advice & Recommendations</h4>
          <ul className="prescription__list">
            {prescription.advice.map((adv, i) => (
              <li key={i}>{adv}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Follow-up */}
      <div className="prescription__followup">
        {prescription.requires_followup ? (
          <div className="prescription__followup-yes">
            <span>📅</span>
            <div>
              <strong>Follow-up Required</strong>
              <p>Schedule a follow-up in {prescription.followup_in_days || 7} days</p>
            </div>
            <a href="/consultation" className="btn btn-teal btn-sm">
              Book Follow-up
            </a>
          </div>
        ) : (
          <div className="prescription__followup-no">
            <span>✅</span>
            <p>No follow-up needed. Contact us if symptoms persist.</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="prescription__actions">
        <button className="btn btn-primary" onClick={onDownload}>
          📥 Download PDF
        </button>
        <button className="btn btn-secondary" onClick={handleShare}>
          📤 Share via WhatsApp
        </button>
        {onClose && (
          <button className="btn btn-secondary" onClick={onClose}>
            ← Back to Dashboard
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <div className="prescription__disclaimer">
        <p>
          ⚕️ This e-prescription was generated using AI assistance and reviewed by {doctorName}.
          It complies with NMC 2026 telemedicine guidelines. All medicine names are in generic form
          per BIS mandate. This prescription is valid for the consultation date mentioned above.
        </p>
      </div>
    </div>
  );
}
