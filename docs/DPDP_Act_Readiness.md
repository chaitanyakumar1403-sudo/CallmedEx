# DPDP Act 2023 Readiness Roadmap
**CallMedex: Data Protection & SDF Compliance**

## 1. Overview
The Digital Personal Data Protection (DPDP) Act 2023 entered phased enforcement starting November 2025. Given the scale and sensitivity of the health data processed by CallMedex, the platform is tracking toward classification as a **Significant Data Fiduciary (SDF)** ahead of the May 2027 deadline.

## 2. Current Compliance Status (As of Q3 2026)

### Consent Management (Stage 2 Focus)
- **Granular Consent:** Patient consent is captured not just at account creation, but at the field-level (e.g., specific consent to share a lab report with a specific doctor, or to query the NHCX for insurance eligibility).
- **Consent Revocation:** Patients have the right to instantly revoke consent via their ABHA-linked Health Records dashboard.

### Security Safeguards
- All at-rest database fields containing Protected Health Information (PHI) within Supabase are encrypted.
- Data residency is strictly maintained within Indian cloud regions (Render/AWS ap-south-1).

## 3. Path to SDF Classification (May 2027 Deadline)
To prepare for Stage 3 enforcement (May 14, 2027), CallMedex is executing the following:
1. **Data Protection Officer (DPO):** An India-based DPO has been appointed to serve as the point of contact for the Data Protection Board.
2. **Data Protection Impact Assessments (DPIA):** Bi-annual DPIAs are scheduled for all new AI processing pipelines (e.g., the auto-prescription generator).
3. **Breach Notification Pipeline:** Automated telemetry is in place to notify the Data Protection Board and affected Data Principals within 72 hours of any detected anomaly.
