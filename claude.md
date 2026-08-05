# CLAUDE.md — CallMedex Platform (ZukoLabs)

> Several subsystem specs formerly in this file (originally numbered sections below) now live as on-demand skills under `.claude/skills/`, loaded only when working on that subsystem: `abha-abdm-integration` (Sections 4/4.1/4.2), `ai-verification-and-reports-spec` (Sections 6/11), `dispatch-diagnostic-booking-spec` (Sections 7/8/12), `pharmacy-delivery-model` (Section 9), `video-consultation-spec` (Section 10), `patient-dashboard-and-insurance-spec` (Sections 13/13A), `tier2-3-expansion-strategy` (Section 13B). Section 2 (Visual/Brand Replication) moved to `frontend/CLAUDE.md`. Section numbers below are kept as historical references even where content has moved.

## Project Identity

**Name:** CallMedex (working name — to be finalized/rebranded if desired)
**Owner:** Chaitanya, ZukoLabs
**Reference site:** https://callmedex-v1.vercel.app/
**Type:** Multi-sided healthcare services marketplace (Uber/Swiggy model applied to medical services)
**Positioning:** India's most advanced AI-native healthcare orchestration platform — ABHA-first, WhatsApp-native, real-time dispatch for home healthcare services.
**Competitive thesis (2026):** The market is shifting from discount-led aggregation (Practo, PharmEasy) to full-stack healthcare integrators that own the longitudinal patient journey. Practo faces growing provider churn (clinics resent marketplace dependency, want data ownership and white-label autonomy). PharmEasy is restructuring toward B2B/Thyrocare margins. Neither offers ABDM-native interoperability, real-time dispatch, or multilingual AI — the three pillars CallMedex is built on. The window is now.

---

## 1. Core Concept

CallMedex is **not** a single clinic's booking app. It is the connective layer between fragmented healthcare supply (doctors, diagnostic centers, pharmacies, phlebotomists, clinical staff, polyclinics/organizations) and patient demand, with AI handling verification, matching, and repetitive operational work.

**Analogy stack:**
- Phlebotomist dispatch → Uber/Ola (nearest available, live tracking, ETA)
- Lab-mandatory test booking → OpenTable/slot-based reservation
- Pharmacy delivery → Blinkit/dark-store model (nearest registered pharmacy fulfills)
- Video consultation → Practo/Teladoc (critical for NRI patients across timezones)

---

## 2. Visual/Brand Replication

Moved to `frontend/CLAUDE.md` (frontend-only guidance, loads when working under `frontend/`).

---

## 3. Account System — Role-Based Signup

**Important build note:** The entire signup/account-creation flow must be a **native, custom-built form on the website itself** (React/Next.js frontend submitting to the FastAPI backend → Supabase) — **not** a Google Form, Typeform, or any third-party form embed/redirect. Reasons: third-party forms can't do conditional role-based branching cleanly, can't match the site's exact theme, and critically can't create actual authenticated user accounts/sessions tied to your database and ABHA linkage. Every field, section, and file-upload box shown in Section 3 below is part of one continuous in-site form component tree.

Single signup form, common fields first, then **role selector forks the form** into role-specific sections. Roles observed:

### Common fields (all roles)
Full Name, Gender, Date of Birth, Email, Mobile Number, Password/Confirm, Address block (Address, City, District, State, Pincode, Country)

### Role: Patient
- Medical History (multi-select chips: BP, Sugar, Thyroid, Anemia, Asthma, Heart Disease, None, Other)
- Physical Information: Blood Group, Height (cm), Weight (kg)
- Preferred language (feeds translation layer — see Section 10)
- **NEW: ABHA linkage step (see Section 4) — mandatory before dashboard access**

### Role: Doctor
- Professional Information: Medical License Number, Specialization, Qualification, Years of Experience, Hospital/Clinic Name, Consultation Fee
- Consultation Information: Available Timings, Consultation Mode, "Available for Online Consultation" checkbox
- Languages spoken (for translation-layer fallback routing)
- Documents Upload: Medical Certificate, Medical License, ID Proof
- MOU acceptance checkbox (mandatory, gates submit)
- **NEW: NMC API auto-verification (see Section 6)**

### Role: Phlebotomist
- Phlebo Type: Part Time / Full Time (radio)
- Professional Details: Qualification, Specialization, Years of Experience, Certification Number
- Document Uploads: Aadhaar card, MLT/DMLT Certificate
- MOU acceptance
- **NEW: Live location permission + duty-status toggle for dispatch eligibility**

### Role: Organization (Polyclinic/Hospital/Diagnostic Center)
- Professional Information: Organization Name, Organization Type, License Number, Establishment Year, Ownership Type
- Contact Information: Alternate Phone, Emergency Phone
- Administration Information: Head of Institution, Total Departments, Total Staff, Total Branches, Operating Hours, Status
- Verification Documents: Registration Certificate, Municipal/Health License, Authorized Person ID Proof
- MOU acceptance

### Role: Staff
- Professional Information: Organization Name (linked dropdown), Staff Role, Department, Experience (Years)
- Additional Contact: Alternate Phone
- Documents: Aadhaar Upload, Medical Degree Upload
- MOU acceptance

### Role: Pharmacy
- Pharmacy Information: Pharmacy Name, Pharmacy Type (Retail/Hospital/Clinic), Owner Name, Pharmacist In Charge, Years of Operation, Operating Hours
- License Information: Registration Number, Drug License Number, GST Number
- Pharmacy Services: Home Delivery (checkbox), 24×7 Availability (checkbox)
- Upload Documents: Drug License Document, GST Certificate, Pharmacist Certificate, Pharmacy Images, Owner ID Proof
- MOU acceptance
- **NEW: geofenced service radius for dark-store-style delivery assignment**

---

## 4. ABHA Integration

Moved to skill `abha-abdm-integration` (ABHA linkage flow, M1/M2/M3 milestone roadmap, DHIS incentives).

---

## 5. WhatsApp Channel (Dual Front-Door)

Same backend serves two interfaces, both writing to the same Supabase tables keyed by `patient_id`/`abha_number`:

- **Website/App:** full dashboard, document uploads, detailed history, dispatch map view
- **WhatsApp (existing ZukoLabs stack — FastAPI + Meta WhatsApp Cloud API + Groq Llama 3.3-70b):** booking initiation, appointment reminders, phlebotomist arrival notifications, report delivery, prescription delivery, consultation summaries

A booking can start on WhatsApp and complete payment on web, or vice versa — session/state must be shared, not siloed per channel.

---

## 6. AI-Automated Verification Pipeline

Moved to skill `ai-verification-and-reports-spec` (also covers Section 11, AI Report Interpretation).

---

## 7. Diagnostic Services — Two-Tier Model

Moved to skill `dispatch-diagnostic-booking-spec` (also covers Section 8 Dispatch Engine and Section 12 Fraud/Quality Scoring).

---

## 8. Dispatch Engine (Phlebotomist Matching)

Moved to skill `dispatch-diagnostic-booking-spec` — see Section 7.

---

## 9. Pharmacy Delivery (Dark-Store Model)

Moved to skill `pharmacy-delivery-model`.

---

## 10. Video Consultation

Moved to skill `video-consultation-spec` (core flow, NMC 2026 compliance, live captions, AI summary/prescription pipeline, additional features).

---

## 11. AI Report Interpretation Layer

Moved to skill `ai-verification-and-reports-spec` — see Section 6.

---

## 12. Fraud/Quality Scoring (Provider Trust Layer)

Moved to skill `dispatch-diagnostic-booking-spec` — see Section 7/8.

---

## 13. Patient Dashboard

Moved to skill `patient-dashboard-and-insurance-spec` (also covers Section 13A NHCX Insurance & Claims Integration).

---

## 13B. Tier 2/3 City Expansion Strategy

Moved to skill `tier2-3-expansion-strategy`.

---

## 14. Tech Stack (carried forward from existing ZukoLabs stack + additions)

- **Backend:** Python FastAPI (near-optimal for this stack — genuine speed gains would require leaving Python for Go/Rust, not worth it given Groq/Supabase/WhatsApp SDK dependencies and existing MediAssist codebase; actual bottlenecks are I/O-bound — LLM calls, API round-trips — not framework-bound)
- **Database:** Supabase (Postgres) — multi-tenant, `clinic_id`/`org_id` scoped queries throughout
- **LLM:** Groq (Llama 3.3-70b-versatile) — WhatsApp NLU, report interpretation, translation, consultation summarization, system prompt generation per tenant
- **Messaging:** Meta WhatsApp Cloud API
- **Hosting:** Render.com (backend), Vercel (frontend reference already on Vercel)
- **Geospatial:** PostGIS extension (Supabase) for radius/distance queries
- **Maps/ETA:** Google Distance Matrix API or Mapbox
- **Payments:** Razorpay (payment links, slot-hold + refund logic — already built for MediAssist, reusable)
- **Video:** Daily.co or Twilio Video — NOT Google Meet (Meet's REST API only exposes recordings/transcripts after a call ends, requires Google Workspace sign-in and a lengthy OAuth security review for sensitive scopes, and ties meetings to the creator's calendar — all poor fits for an embedded, patient-friction-free consult flow)
- **Speech/Translation:** Streaming STT (e.g., Google Cloud Speech-to-Text streaming or Azure Speech) + Groq/Llama for translation, feeding both live captions and the post-call summary pipeline
- **National health integration:** ABDM/ABHA APIs (HIP/HIU registration required)
- **Verification:** NMC registry API, state pharmacy/drug license APIs, OCR (Claude Vision or Groq vision-capable model)

---

## 15. Compliance Requirements

### 15.1 DPDP Act 2023 — Enforcement Timeline (Updated July 2026)

The DPDP Act and Rules are now in phased enforcement. CallMedex processes sensitive health data at scale — non-compliance carries penalties up to **₹250 Crore per violation**.

| Stage | Effective Date | Requirement | CallMedex Action |
|---|---|---|---|
| **Stage 1** | Nov 13, 2025 ✅ | Data Protection Board established; definitions in force | Ensure internal data taxonomy aligns with DPDP definitions (Data Fiduciary, Data Principal, etc.) |
| **Stage 2** | Nov 13, 2026 ⏳ | Consent Manager registration and operationalization | Implement granular, revocable consent management for all patient data — ties into ABDM Consent Manager Phase 3 |
| **Stage 3** | May 14, 2027 | Full compliance: notice, informed consent, security safeguards, breach notification, SDF obligations | Appoint DPO (India-based), conduct DPIAs, implement breach notification pipeline, regular security audits |

**Key penalties:**
- Failure to implement security safeguards: up to ₹250 Cr
- Failure to notify breaches: up to ₹200 Cr
- Non-compliance with SDF obligations: up to ₹150 Cr
- Failure to obtain valid consent: up to ₹50 Cr

**Action:** PII sanitization middleware (already built for MediAssist) must be extended and hardened. All health data flows (WhatsApp messages, lab reports, prescriptions, video transcripts) must have consent tracking at the field level, not just the session level.

### 15.2 ABDM HIP/HIU Registration
- Register with NHA as both HIP (push health events) and HIU (pull cross-facility records)
- Enroll in Health Facility Registry (HFR) and Healthcare Professionals Registry (HPR)
- Full ABDM milestone compliance (M1/M2/M3) — see Section 4.1

### 15.3 FHIR R4
- Mandatory for ABDM M2/M3 and NHCX claims (already explored in MediAssist context, now strictly enforced)

### 15.4 Clinical Liability Firewall
- AI-generated summaries, translations, and prescriptions must be clearly labeled as decision-support, not diagnosis, with mandatory doctor sign-off before anything reaches the patient
- Must comply with NMC 2026 Professional Conduct Regulations (see Section 10.1.1)

### 15.5 SAHI & BODH Alignment (NEW — AI Governance)

In February 2026, the government launched:
- **SAHI (Strategy for Artificial Intelligence in Healthcare for India)** — ethical AI framework for clinical deployment
- **BODH (Benchmarking Open Data Platform for Health AI)** — secure environments for training AI models without compromising patient privacy

CallMedex's AI layers (report interpretation, consultation summarization, prescription extraction, translation, fraud scoring) should align with SAHI guidelines from the start — this becomes a **trust differentiator** when pitching to hospitals and government partnerships. Document AI model provenance, bias testing, and human-in-the-loop safeguards.

---

## 16. Open Strategic Questions (carry forward from MediAssist context)

- Should this evolve as a standalone new ZukoLabs product, or as MediAssist AI's network-layer evolution (single-clinic automation → multi-provider marketplace)?
- Billing/invoicing module and FHIR/ABDM positioning — identified gaps to close early given this platform's ABHA-first design
- Pricing model: commission-based (per booking/delivery), subscription (family health plans), or hybrid — needs modeling against MediAssist's existing four-tier structure (SoloClinic, DiagStream, Essential, Enterprise)
- Speech-to-speech (full voice dubbing) vs. captions-only for translation — revisit once caption feature has real usage data
- **NEW: NHCX monetization model** — per-claim processing fee vs. bundled into organization subscription? What's the right margin structure when competing with standalone TPA software?
- **NEW: Tier 2/3 launch city sequencing** — Vizag (home base) → which cities next? Visakhapatnam district saturation first, or jump to another AP/Telangana city for state-level network effects?
- **NEW: AB-PMJAY empanelment** — should CallMedex itself get empanelled as a telemedicine provider under PMJAY, or only facilitate claims for empanelled partner organizations?
- **NEW: Significant Data Fiduciary (SDF) classification** — CallMedex will likely qualify as an SDF under DPDP given health data volume. Plan DPO appointment and DPIA processes before the May 2027 deadline, not after.

---

## 17. Build Priority (Suggested Sequence — Updated July 2026)

**Phase 1 — Foundation (Weeks 1–6)**
1. Replicate reference site theme/logo/layout + role-based signup forms (Sections 2–3)
2. ABHA integration for patient signup — **target M1 milestone** (Section 4)
3. DPDP consent management infrastructure — field-level consent tracking (Section 15.1)
4. Core booking flow — Tier B (slot-based) first, as it's structurally simpler than dispatch

**Phase 2 — Supply Onboarding (Weeks 7–12)**
5. AI verification pipeline for doctor/pharmacy onboarding (Section 6)
6. ABDM M2 — HIP role, push health records as FHIR R4 (Section 4.1)
7. Phlebotomist dispatch engine + live tracking (Section 8) — most complex, sequence after core flows are stable
8. WhatsApp channel parity (Section 5)

**Phase 3 — Full Service Stack (Weeks 13–20)**
9. Pharmacy delivery matching (Section 9)
10. Video consultation core flow + **NMC 2026 compliance baked in** (Sections 10.1, 10.1.1)
11. Live translated captions (Section 10.2)
12. AI summary + prescription pipeline with generic-name mandate (Section 10.3)

**Phase 4 — Moat Features (Weeks 21–28)**
13. **Insurance eligibility + NHCX claims integration (Section 13A)** — the single biggest revenue differentiator; sequence here because it requires M1 ABDM as prerequisite
14. ABDM M3 — HIU role, cross-facility health record pull (Section 4.1)
15. AI report interpretation (Section 11)
16. Video consultation additional features (Section 10.4)
17. Fraud/quality scoring (Section 12)

**Phase 5 — Scale (Weeks 29+)**
18. **Tier 2/3 city expansion** — Vizag saturation → regional rollout (Section 13B)
19. AB-PMJAY cashless booking flow (Section 13A.1)
20. SAHI/BODH AI governance documentation (Section 15.5)
21. SDF compliance preparation — DPO, DPIAs (ahead of May 2027 deadline)