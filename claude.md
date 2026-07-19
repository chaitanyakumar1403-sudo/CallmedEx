# CLAUDE.md — CallMedex Platform (ZukoLabs)

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

## 2. Visual/Brand Replication (from reference screenshots)

Replicate exactly, then allow future re-skinning:

- **Logo:** "callmedex" wordmark, heart-with-pulse-line icon in blue/red, positioned top-left of navbar
- **Top utility bar:** dark navy background, white text — Emergency number, Ambulance (108), Blood Bank number, right-aligned tagline badge ("Vizag's #1 Healthcare Platform" → replace with actual city/regional claim)
- **Navbar:** white background, nav items — About, Health Packages, Diagnostics, Consultation, Pharmacy, Blog, Login (dropdown chevrons on multi-item menus)
- **Primary color:** deep navy blue (`#1a2b4a`-ish) for headers, CTAs, borders
- **Typography:** serif/display font for headings ("Create Your Account", section titles), clean sans-serif for body/inputs
- **Form card style:** white card, rounded corners, soft shadow, generous padding, section-grouped (Address Information, Professional Information, etc. each in their own bordered sub-card)
- **CTA buttons:** full-width, navy filled, white bold text, rounded corners
- **Chat widget:** floating circular button, bottom-right, teal/blue

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

## 4. ABHA Integration (Foundational — Day One)

**Rationale:** Reduces ZukoLabs' data storage cost/liability by not duplicating the national health record; ABDM already stores longitudinal health data. CallMedex stores pointers + consent artifacts, not the full record.

**Scale context (July 2026):** 93.95 crore ABHA IDs created, 105+ crore health records linked, ~10 lakh registered healthcare professionals, 5+ lakh registered facilities. ABHA integration is no longer optional — it's a competitive necessity and, for NABH-accredited/state-empanelled facilities, a regulatory mandate.

**Flow:**
1. On patient signup, prompt: "Do you have an ABHA (Ayushman Bharat Health Account)?"
2. **If yes:** link via mobile/Aadhaar OTP verification against ABDM's ABHA lookup API → pull demographics to prefill form
3. **If no:** create ABHA inline via ABDM's ABHA-creation API (OTP-based via Aadhaar or mobile, no separate app/portal needed)
4. Store only: `abha_number`, `abha_ref_id`, consent status — in `patients` table
5. Every health event (phlebotomist collection, lab report, prescription, video consult summary) is pushed as a **Health Information** record to ABDM via HIP (Health Information Provider) flow, linked to the patient's ABHA
6. Dashboard "Health Records" tab pulls from ABDM (via HIU/consent flow) rather than storing full documents locally

### 4.1 ABDM Milestone Compliance Roadmap

ABDM compliance is now structured into three clear technical milestones. CallMedex must target all three:

| Milestone | Scope | CallMedex Implementation |
|---|---|---|
| **M1 — Patient Identity** | ABHA creation, verification, and linking | Patient signup flow (already planned in Section 4 above) |
| **M2 — HIP Role** | Sharing health records in FHIR R4 format, handling consent requests from other facilities | Every health event (lab report, prescription, consultation summary) pushed as FHIR R4 bundle to ABDM gateway |
| **M3 — HIU Role** | Bidirectional data exchange — accessing patient history from other ABDM-registered facilities | Dashboard "Health Records" tab pulls cross-facility history via consent flow — the key differentiator vs. siloed competitors |

**Compliance note:** Registering CallMedex as an HIP/HIU with the National Health Authority (NHA) is a formal onboarding process, not just an API key. As of 2026, all facilities must register with the **Health Facility Registry (HFR)** and ensure professionals are on the **Healthcare Professionals Registry (HPR)**. Use the official ABDM Sandbox (sandbox.abdm.gov.in) for API testing and FHIR R4 certification.

### 4.2 Digital Health Incentive Scheme (DHIS)

**Revenue/cost offset opportunity:** The NHA's DHIS program offers financial incentives to healthcare providers and digital solution companies that achieve specific digital transaction targets on ABDM. Over ₹100 crore has been disbursed to hospitals alone by mid-2026. Revised policy (Corrigendum 7) is effective April–September 2026.

- CallMedex should track ABDM transaction volumes per enrolled facility to help partners claim DHIS incentives — this becomes a **sales pitch to onboard organizations** ("Join CallMedex and earn DHIS incentives automatically")
- Builds goodwill with onboarded organizations and creates a data-driven argument for platform adoption

---

## 5. WhatsApp Channel (Dual Front-Door)

Same backend serves two interfaces, both writing to the same Supabase tables keyed by `patient_id`/`abha_number`:

- **Website/App:** full dashboard, document uploads, detailed history, dispatch map view
- **WhatsApp (existing ZukoLabs stack — FastAPI + Meta WhatsApp Cloud API + Groq Llama 3.3-70b):** booking initiation, appointment reminders, phlebotomist arrival notifications, report delivery, prescription delivery, consultation summaries

A booking can start on WhatsApp and complete payment on web, or vice versa — session/state must be shared, not siloed per channel.

---

## 6. AI-Automated Verification Pipeline

Goal: remove human bottleneck from document review. Each uploaded document triggers a background verification job with status `pending → verified / flagged / rejected`.

| Role | Verification source |
|---|---|
| Doctor | National Medical Council (NMC) registry API — license number cross-check |
| Pharmacy | State Pharmacy Council / Drug License validation API |
| Phlebotomist | MLT/DMLT certificate OCR + certification number cross-check |
| Organization | Municipal/health license registry check where API available |
| All roles | Aadhaar-linked ID proof OCR + face-match against selfie (optional future step) |

- Use OCR (or Claude/Groq vision) to extract fields from uploaded documents, then call the relevant government API/registry
- Flag mismatches for manual review rather than blocking outright — reduces false rejections
- Store verification status + timestamp + source reference for audit trail (important for a healthcare compliance context)

---

## 7. Diagnostic Services — Two-Tier Model

### Tier A: Home-serviceable (dispatch model)
Sample collection, ECG, basic vitals, select rapid tests.
- Patient books via web/WhatsApp → dispatch engine assigns nearest available, on-duty phlebotomist
- **Live tracking UI** (Swiggy/Uber-style): map with moving pin, distance remaining, live ETA countdown
- **Chain-of-custody:** photo + QR/barcode scan at collection, at transit handoff, and at lab receipt — prevents sample mishandling/mix-up disputes
- Sample routed to a registered diagnostic center's queue
- **Future-forward additions:**
  - AI-predicted demand heatmaps (which localities need more on-duty phlebotomists at which hours) to pre-position staff
  - Auto-scheduling of routine/recurring tests (e.g., monthly diabetes panel) with one-tap re-book
  - Cold-chain temperature logging for samples requiring refrigerated transit (IoT sensor tag on collection kit, optional)

### Tier B: Lab-mandatory (slot-booking model)
Imaging (X-ray, MRI, CT), specialized panels requiring lab equipment.
- Patient selects diagnostic center + available time slot (capacity-aware inventory, no dispatch needed)
- Standard appointment confirmation + reminder flow
- **Future-forward addition:** AI-based prep-instruction reminders specific to the test (e.g., fasting requirement countdown sent via WhatsApp before an early-morning slot)

---

## 8. Dispatch Engine (Phlebotomist Matching) — Technical Spec

**New components required beyond current MediAssist stack:**

1. **`phlebotomist_locations` table** — live lat/long pings every 10–15s while on duty (Supabase Realtime channel, or lightweight Redis if latency becomes an issue)
2. **Matching query:** on booking, find on-duty phlebotomists within radius
   - Use PostGIS `ST_DWithin` (add PostGIS extension to Supabase) for accurate radius queries, or haversine formula in plain SQL for a leaner MVP
   - Rank candidates by: distance → current load (active job count) → rating
3. **ETA calculation:** Google Distance Matrix API or Mapbox Directions API for real routing ETA (not straight-line) — display "Arriving in ~14 mins, 2.3 km away"
4. **Live tracking screen:** Supabase Realtime subscription pushing phlebotomist location updates to patient's map view
5. **Duty/availability toggle:** phlebotomist app-side on/off switch controlling dispatch eligibility
6. **Surge/load-aware assignment (future):** avoid overloading a single phlebotomist during high-demand windows

This is the single most engineering-heavy new module — a genuine dispatch system, not CRUD.

---

## 9. Pharmacy Delivery (Dark-Store Model)

- Prescription/OTC order placed by patient (web or WhatsApp)
- System matches to nearest registered pharmacy with the item in stock and within geofenced service radius (from pharmacy's `service_radius` field set at signup)
- Pharmacy fulfills and dispatches for delivery — either pharmacy's own rider or a shared delivery pool (future)
- Order status tracked similarly to phlebotomist dispatch (simpler — no live GPS required initially, just status states: confirmed → preparing → out for delivery → delivered)
- **Future-forward additions:**
  - Direct e-prescription → pharmacy handoff from video consultation (see Section 10) — one tap from prescription card to order
  - Real-time stock-check across nearby pharmacies before confirming order, to avoid "out of stock" cancellations
  - Auto-refill reminders for chronic-condition patients (e.g., BP/diabetes medication) with one-tap reorder via WhatsApp
  - Generic-medicine substitution suggestion (with pharmacist/doctor approval) for cost savings — relevant to India's price-sensitive market

---

## 10. Video Consultation — Full Spec

### 10.1 Core Flow
- Doctor sets "Available for Online Consultation" flag + available timings + languages spoken at signup/profile
- Patient books video slot → video session via **Daily.co or Twilio Video** (embeddable directly in CallMedex UI, no external app/account needed — see prior analysis on why Google Meet's API is unsuitable here)
- Primary use case: NRI patients across timezones, plus general telemedicine convenience for domestic patients

### 10.1.1 NMC 2026 Telemedicine Compliance (NEW — Mandatory)

The NMC's **Registered Medical Practitioners (Professional Conduct) Regulations, 2026** introduce stricter rules that directly affect CallMedex's video consultation module:

| Requirement | Impact on CallMedex |
|---|---|
| **Mandatory generic-name prescriptions** | AI prescription extraction (Section 10.3) must auto-flag brand names and suggest generic equivalents; e-prescription PDF must display generic names legibly |
| **Identity verification for Schedule H/H1 drugs** | If doctor prescribes Schedule H/H1 via teleconsult for a first-time patient, system must prompt patient to upload government-issued ID before prescription is finalized |
| **Digital consent — 3-year retention** | Explicit digital consent (recorded verbal or secure e-signature) must be captured before consultation starts and stored for minimum 3 years; build consent artifact storage tied to `consultation_id` |
| **Advertising ethics prohibition** | Doctor profiles on CallMedex must not include endorsements of commercial health products or nutraceuticals — enforce at profile review stage |
| **Prescription drug restrictions** | System must block prescribing Schedule X, narcotics, and psychotropic substances via teleconsult — hard-coded validation in the prescription pipeline |

### 10.2 Real-Time Translated Captions (Option B — recommended MVP approach)
Rather than full speech-to-speech dubbing (higher latency, more disruptive), launch with **live translated captions**:
- Doctor speaks in English/Hindi/any language → streaming speech-to-text → Groq/Llama translation → translated caption overlay appears on **patient's** screen in their preferred language (set once in patient profile, no doctor-side setup needed)
- Patient still hears the doctor's actual voice — captions supplement rather than replace, which feels more natural and trustworthy than a synthesized dub
- **Bidirectional option:** doctor can also see live translated captions of what the patient says, if doctor doesn't share the patient's language — often more valuable than one-directional translation alone
- Architecture: audio stream from call → streaming STT → Groq/Llama translation → push translated text via WebSocket to the relevant client
- This same transcript pipeline (original + translated) feeds directly into the AI summary/prescription pipeline below — not throwaway infrastructure
- Speech-to-speech (full voice dubbing) can be evaluated as a v2 feature once live-caption demand is validated

### 10.3 AI Summary + Prescription Pipeline
1. **Recording/transcription** during the call (Daily.co/Twilio session recording + transcript, reusing the streaming STT from 10.2)
2. **Post-call AI processing** (Groq/Llama):
   - Structured **consultation summary** — chief complaint, symptoms discussed, doctor's assessment, advice given
   - **Prescription extraction** — parses medicines mentioned into a structured list (generic name, dosage, frequency, duration), not just prose. **Must comply with NMC 2026 generic-name mandate** (see 10.1.1)
   - **Follow-up flag** — auto-detects if doctor mentioned a follow-up date or a recommended test, converts into a suggested next action/reminder
3. **Doctor review/edit step (mandatory)** — AI drafts the summary + prescription; doctor reviews, edits, and confirms before anything is finalized and sent. AI never auto-sends an unverified prescription — this is a non-negotiable compliance/liability safeguard.
4. **Delivery** — finalized prescription + summary sent to patient via WhatsApp (PDF) in the patient's **preferred language**, and saved to their ABHA-linked health record

### 10.4 Additional Features
- **E-prescription → pharmacy handoff:** patient taps "Order these medicines" directly from the prescription card, routing straight into the pharmacy delivery flow (Section 9)
- **Pre-consult intake form:** short symptom questionnaire sent via WhatsApp before the call so the doctor starts with context instead of history-taking from scratch
- **In-call vitals sharing:** patient can enter readings from a connected BP monitor/glucometer/oximeter during the call, timestamped into the record
- **Multi-language summary generation:** patient-facing summary generated in their preferred regional language regardless of the language the consult was conducted in
- **Consultation history timeline:** all past video consults, summaries, and prescriptions in one scrollable view on the patient dashboard, ABHA-linked
- **Second-opinion request:** patient can share a consult record with another doctor on the platform for review, with explicit consent
- **No-show/reschedule automation:** WhatsApp reminder ~30 min before the call, one-tap reschedule if either party can't make it
- **Consultation quality flagging:** if AI detects the call ended unusually short, or key fields (diagnosis/prescription) are empty, flag for admin follow-up — protects patients from a rushed/incomplete consult slipping through

---

## 11. AI Report Interpretation Layer

- When a lab report is delivered (PDF/structured data), run it through Groq/Llama pipeline:
  - Auto-flag abnormal values against reference ranges
  - Generate a plain-language explanation for the patient (WhatsApp-deliverable), in their preferred language
  - Surface a structured summary to the reviewing doctor *before* they open the raw report
- This does not replace doctor review — it accelerates it and improves patient comprehension
- **Future-forward addition:** trend view across a patient's historical reports (e.g., HbA1c over the last 12 months) auto-charted and flagged if trending in a concerning direction

---

## 12. Fraud/Quality Scoring (Provider Trust Layer)

- Track per-provider (phlebotomist, pharmacy, doctor): no-show rate, late-arrival rate, patient complaint rate, rating
- Feed into dispatch ranking (Section 8) and into a visible trust badge on provider profiles
- Flag providers below threshold for manual review/suspension
- **Future-forward addition:** anomaly detection on consultation patterns (e.g., a doctor prescribing the same medication to an unusually high share of patients) surfaced for admin review — a light clinical-integrity safeguard, not an accusation engine

---

## 13. Patient Dashboard

- Upcoming/past appointments (all types: phlebotomist collection, lab visit, video consult, pharmacy order)
- Health Records tab (ABDM-sourced, consent-gated)
- Family member management (subscription/family health plans — future monetization lever)
- Active order/dispatch tracking (live map when applicable)
- Consultation history with AI summaries, prescriptions, and translated transcripts (Section 10)
- Medication reminders (from active prescriptions, tied into pharmacy refill flow)
- Preferred language setting (drives translation layer + WhatsApp delivery language across all services)
- **NEW: Insurance claims dashboard** — real-time claim status, documents, and reimbursement tracking (see Section 13A)

---

## 13A. Insurance & Claims Integration — NHCX (NEW — High-Impact Revenue Lever)

**Why this matters now:** The National Health Claims Exchange (NHCX) is live and expanding. It uses FHIR R4 standards to enable real-time, standardized claims exchange between providers, insurers/TPAs, and government schemes (AB-PMJAY). No major healthtech marketplace has nailed seamless claims-from-booking yet. This is CallMedex's opportunity to be the first.

### 13A.1 Core Capability
- **Pre-consultation insurance eligibility check:** Before a patient books a video consult, lab test, or home collection, CallMedex queries NHCX to verify active coverage and policy limits — patient sees "Covered by [Insurer Name]" or "Out-of-pocket: ₹X" upfront, eliminating bill-shock
- **Automated claim submission:** After a consultation or diagnostic service, CallMedex auto-generates the NHCX-compliant FHIR claim bundle (diagnosis codes, procedure codes, prescription data) and submits it to the insurer/TPA via NHCX gateway
- **Real-time claim tracking:** Patient dashboard shows claim status (submitted → under review → approved/rejected → disbursed) pulled from NHCX callbacks
- **AB-PMJAY integration:** For Ayushman Bharat beneficiaries, CallMedex can handle cashless claims processing through the Transaction Management System (TMS) — massive Tier 2/3 acquisition channel

### 13A.2 Technical Architecture
- NHCX uses an **asynchronous callback architecture** for claim lifecycle (eligibility → pre-auth → claim → settlement)
- Build a **FHIR-converter middleware layer** that maps CallMedex's internal data (from Supabase) to NHCX-compliant bundles
- Requires M1 ABDM integration as a prerequisite (already planned in Section 4)
- Use NHCX Sandbox for testing before production go-live

### 13A.3 Revenue Impact
- **Commission on claims processed** — per-transaction fee model similar to payment gateways
- **Premium tier for organizations** — "Insurance-ready" badge + automated claims as a paid feature for enrolled diagnostic centers/hospitals
- **Patient acquisition** — "Book with insurance" is a powerful conversion driver, especially in Tier 2/3 cities where AB-PMJAY coverage is highest
- **Data moat** — claims data (anonymized, aggregated) provides unique insights into disease burden, cost patterns, and demand forecasting

---

## 13B. Tier 2/3 City Expansion Strategy (NEW — Growth Engine)

**Why this matters:** 65% of India's population lives in Tier 2/3 cities and rural areas. These markets have the fastest-growing health insurance adoption (Tier-3 outpaced Tier-1 in FY26-27 for high-value policy purchases), rising chronic disease burden, and critically low specialist density — exactly the conditions CallMedex is built to serve.

### 13B.1 Bharat-First Approach
- **Vernacular-everything:** All patient-facing surfaces (WhatsApp flows, web dashboard, reports, prescriptions, consent forms) must be available in regional languages — not just Hindi/English. Priority languages: Telugu (Vizag base), Tamil, Kannada, Marathi, Bengali
- **Voice-first WhatsApp:** Many new internet users in these regions are more comfortable with voice than text. WhatsApp voice-note booking (STT → intent extraction → booking confirmation via text) should be a first-class flow, not an afterthought
- **Hyper-local trust signals:** City-specific landing pages, local doctor profiles, regional health package naming ("Vizag Wellness Panel"), local emergency numbers

### 13B.2 Supply-Side Onboarding
- **DHIS as a sales pitch** (see Section 4.2) — "Join CallMedex, earn government incentives for going digital"
- **e-Sushrut Clinic integration** — NHA's plug-and-play HMIS for smaller clinics is being rolled out; CallMedex can offer a complementary marketplace layer on top
- **Franchise phlebotomist model** — recruit and train local phlebotomists in Tier 2/3 towns with lower cost-per-hire than metro markets; supply grows ahead of demand

### 13B.3 Demand-Side Acquisition
- **AB-PMJAY cashless booking** (Section 13A) as the primary hook — "Book free with your Ayushman card"
- **Preventive health packages** priced for non-metro disposable incomes (₹199/₹399/₹799 tiers)
- **WhatsApp referral loops** — "Share with family" one-tap referral from booking confirmation; referral credits for both parties

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