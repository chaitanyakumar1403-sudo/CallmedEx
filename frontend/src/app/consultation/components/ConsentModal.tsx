/**
 * ConsentModal — NMC 2026 Digital Consent Capture
 * Required before starting any video consultation.
 */
'use client';

import { useState } from 'react';

interface ConsentModalProps {
  doctorName: string;
  onConsent: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConsentModal({ doctorName, onConsent, onCancel, isLoading }: ConsentModalProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="consent-overlay">
      <div className="consent-modal">
        <div className="consent-modal__header">
          <div className="consent-modal__icon">🛡️</div>
          <h3>Digital Consent Required</h3>
          <p>NMC 2026 Telemedicine Guidelines</p>
        </div>

        <div className="consent-modal__body">
          <div className="consent-modal__section">
            <h4>Before your consultation with {doctorName}, please confirm:</h4>
            <ul>
              <li>
                <span className="consent-check">✓</span>
                I consent to a <strong>video-based telemedicine consultation</strong> as per NMC 2026 guidelines.
              </li>
              <li>
                <span className="consent-check">✓</span>
                I understand the session may be <strong>transcribed by AI</strong> for generating an accurate e-prescription.
              </li>
              <li>
                <span className="consent-check">✓</span>
                All prescriptions will use <strong>generic drug names</strong> per BIS mandate.
              </li>
              <li>
                <span className="consent-check">✓</span>
                My health data is processed under <strong>DPDP Act 2023</strong> protections and will not be shared without consent.
              </li>
              <li>
                <span className="consent-check">✓</span>
                This consultation is <strong>end-to-end encrypted</strong>. No recording is stored without explicit consent.
              </li>
            </ul>
          </div>

          <label className="consent-modal__checkbox">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              I have read and agree to the above terms. I give my digital consent for this telemedicine session.
            </span>
          </label>
        </div>

        <div className="consent-modal__actions">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="btn btn-teal btn-lg"
            onClick={onConsent}
            disabled={!checked || isLoading}
            style={{ minWidth: 200 }}
          >
            {isLoading ? (
              <span className="spinner-inline" />
            ) : (
              '✅ I Agree & Join Call'
            )}
          </button>
        </div>

        <div className="consent-modal__footer">
          <span>🔒 Compliant with NMC 2026 · DPDP Act 2023 · FHIR R4</span>
        </div>
      </div>
    </div>
  );
}
