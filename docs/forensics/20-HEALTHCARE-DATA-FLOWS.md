# 20 — HEALTHCARE DATA FLOWS, PRIVACY & COMPLIANCE

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** PHI/PII Data Flow, DPDP Act 2023 & ABDM Regulatory Audit  
**Verification Level:** STATICALLY VERIFIED against data schemas, storage buckets, and privacy services  

---

## 1. PHI & PII INVENTORY ACROSS THE PLATFORM

The CallMedex platform ingests, stores, and transmits Protected Health Information (PHI) and Personally Identifiable Information (PII) across multiple operational layers:

| Data Category | Specific Data Elements | Primary Table / Storage Location | Sensitivity Level | External Sharing Destination |
| :--- | :--- | :--- | :--- | :--- |
| **Patient Demographics** | Full name, mobile phone, gender, date of birth, address, district | `users`, `patients`, `family_members` | **High (PII)** | MediAssist AI (Phone & Name), MSG91 (Phone) |
| **Longitudinal Clinical Vitals** | Blood pressure, blood glucose, SpO2, height, weight, medical history chips | `patients.medical_history`, `patient_biomarkers` | **Critical (PHI)**| None (Internal only) |
| **Diagnostic Lab Reports** | Raw analyzer outputs, PDF report documents, abnormal marker flags | `lab_reports`, Supabase Bucket `lab-reports` | **Critical (PHI)**| MediAssist AI (PDF URL & Abnormal Flags) |
| **Clinical Consultation Data** | Video audio transcript, clinical diagnosis, prescribed drugs, doctor notes | `consultations`, `prescriptions`, `ai_report_analyses` | **Critical (PHI)**| Groq Cloud (Transcripts for Scribing), OpenRouter |
| **Government Identity Proofs** | Aadhaar numbers, selfie liveness photos, medical council licenses | `documents`, Supabase Bucket `verification-docs`| **Critical (PII)**| Google Gemini Vision API (Document OCR) |
| **Financial & Payment Data** | Razorpay payment ID, bank account details for settlements | `payments`, `settlements` | **High (Financial)**| Razorpay Payment Gateway |

---

## 2. DATA ENCLAVE & EXTERNAL THIRD-PARTY EXPOSURE MATRIX

CallMedex shares sensitive data with 8 third-party services over HTTPS:

```text
┌─────────────────────────┐
│     CALLMEDEX CORE      │
└────────────┬────────────┘
             │
             ├──> MediAssist AI (ZukoLabs): Receives patient phone, name, and lab report PDF presigned URL
             ├──> Google Gemini API: Receives raw uploaded provider certificates, Aadhaar photos, and selfies
             ├──> OpenRouter / Groq: Receives medical report images & doctor-patient teleconsultation transcripts
             ├──> MSG91 (India DLT): Receives raw mobile numbers and OTP / notification templates
             ├──> Exotel / Twilio: Receives patient & provider phone numbers to bridge masked calls
             ├──> Resend / SMTP: Receives doctor / partner email addresses for digital MOU delivery
             ├──> Daily.co: Receives doctor/patient session identifiers for WebRTC video room creation
             └──> Razorpay: Receives order amount, booking ID, and patient identifier
```

### Risk Assessment on External Exposure:
1. **Clinical Transcripts to Groq Cloud:** Consultation audio transcripts sent to `ai_voice_scribe.py` contain patient names, chief complaints, and symptoms. While Groq operates over TLS, transmitting raw clinical dialogue to third-party LLM endpoints requires explicit DPDP consent.
2. **Provider Aadhaar Cards to Gemini Vision:** `app/services/ai_ocr.py` transmits provider Aadhaar cards to Google Gemini Vision for OCR extraction. Under Indian Aadhaar regulations (UIDAI), storing or transmitting unmasked Aadhaar numbers requires strict vault compliance.

---

## 3. DIGITAL PERSONAL DATA PROTECTION ACT (DPDP 2023) COMPLIANCE AUDIT

### A. Digital Consent Framework (`app/models/schemas.py`, `consent_records` table)
- **Implementation:** `database/consent_records.sql` and `app/routers/telemedicine.py`.
- **Enforcement:**
  - Before a telemedicine video consultation begins or clinical records are recorded, `POST /api/telemed/rooms` asserts `consent_given: true`.
  - Consent records are logged to the `consent_records` table with `user_id`, `consent_type` (`teleconsultation_recording`, `health_records`, `data_processing`), `granted_at`, and `revoked_at`.
- **Verdict:** **COMPLIANT with DPDP Section 6 (Consent Requirements).**

### B. Right to Erasure / Universal Account Deletion Engine
- **Implementation:** Documented in `docs/sessions/SESSION_02_UNIVERSAL_ACCOUNT_DELETION_ENGINE.md` and verified in `backend/tests/test_account_deletion.py`.
- **Enforcement:**
  - `DELETE /api/auth/account`: Available to all 12 platform roles in the `DashboardShell` footer.
  - Cascading deletion permanently wipes user rows from `users`, `patients`, `family_members`, `slots`, and `device_tokens`.
  - Immutable audit logs are anonymized via `database/audit_log_anonymize.sql` (replaces personal identifiers with `ANONYMIZED_USER`).
- **Verdict:** **COMPLIANT with DPDP Section 12 (Right to Correction and Erasure).**

---

## 4. AYUSHMAN BHARAT DIGITAL MISSION (ABDM / ABHA) STATUS

- **Source File:** `backend/app/services/abdm.py` (120 lines).
- **Current Technical Reality:**
  - Implements endpoint stubs for ABHA generation (`generate_abha_otp`, `verify_abha_otp`), and FHIR health record bundling (`create_fhir_bundle`).
  - **Verdict:** **NOT PRODUCTION CERTIFIED.**
    The service connects to `ABDM_SANDBOX_URL` (`https://sandbox.abdm.gov.in`).
    Milestones M1 (ABHA Creation), M2 (Health Facility Registry / Provider Registry), and M3 (HIP/HIU Health Information Exchange) are in sandbox prototype status and cannot issue live ABDM incentives or query production Indian health records.
