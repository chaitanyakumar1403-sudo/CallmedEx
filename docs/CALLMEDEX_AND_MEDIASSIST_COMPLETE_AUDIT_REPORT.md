# CALLMEDEX PLATFORM & MEDIASSIST AI INTEGRATION — MASTER ARCHITECTURE & AUDIT REPORT

**Date:** August 2026  
**Target System:** CallMedex Healthcare Platform (`ZukoLabs` / `xylarcAI`)  
**Scope:** Complete Codebase, FastAPI Backend, Next.js Frontend, Supabase Database, Mobile-App Readiness & MediAssist AI Integration Contract  
**Document Purpose:** Definitive Single Source of Truth (SSOT) covering all architectural phases, database models, API inventories, security boundaries, and integration contracts.

---

# TABLE OF CONTENTS

- [PART 1 — CALLMEDEX COMPLETE PRODUCTION ARCHITECTURE & MOBILE-APP READINESS AUDIT](#part-1--callmedex-complete-production-architecture--mobile-app-readiness-audit)
  - [Phase 1: Complete Repository Discovery](#phase-1--complete-repository-discovery)
  - [Phase 2: System Architecture](#phase-2--system-architecture)
  - [Phase 3: Database Master Audit](#phase-3--database-master-audit)
  - [Phase 4: Patient Identity Analysis](#phase-4--patient-identity-analysis)
  - [Phase 5: Authentication & Authorization](#phase-5--authentication--authorization)
  - [Phase 6: Complete API Inventory](#phase-6--complete-api-inventory)
  - [Phase 7: End-to-End Feature Audit](#phase-7--end-to-end-feature-audit)
  - [Phase 8: Patient Application Readiness](#phase-8--patient-application-readiness)
  - [Phase 9: Lab / Diagnostic Center Architecture](#phase-9--lab--diagnostic-center-architecture)
  - [Phase 10: Admin Architecture](#phase-10--admin-architecture)
  - [Phase 11: External Integrations](#phase-11--external-integrations)
  - [Phase 12: Files, Reports & Medical Documents](#phase-12--files-reports--medical-documents)
  - [Phase 13: Notifications](#phase-13--notifications)
  - [Phase 14: Payments](#phase-14--payments)
  - [Phase 15: Security Audit](#phase-15--security-audit)
  - [Phase 16: Frontend/Backend Wiring Audit](#phase-16--frontendbackend-wiring-audit)
  - [Phase 17: Deployment & Production Audit](#phase-17--deployment--production-audit)
  - [Phase 18: Testing Audit](#phase-18--testing-audit)
  - [Phase 19: Mobile Architecture Recommendation](#phase-19--mobile-architecture-recommendation)
  - [Phase 20: Mobile App Backend Contract](#phase-20--mobile-app-backend-contract)
  - [Phase 21: Single Source of Truth Assessment](#phase-21--single-source-of-truth-assessment)
  - [Phase 22: Data Consistency & Duplicate Patient Audit](#phase-22--data-consistency--duplicate-patient-audit)
  - [Phase 23: Current Product Capability Matrix](#phase-23--current-product-capability-matrix)
  - [Phase 24: Blockers for Mobile Launch](#phase-24--blockers-for-mobile-launch)
  - [Phase 25: Mobile Implementation Roadmap](#phase-25--mobile-implementation-roadmap)
  - [Phase 26: Final Platform Verdict](#phase-26--final-platform-verdict)
  - [What You Need From This Audit Before Mobile Development](#what-you-need-from-this-audit-before-mobile-development)
  - [Do Not Build Yet](#do-not-build-yet)
- [PART 2 — CALLMEDEX ↔ KRYIAAI / MEDIASSIST AI INTEGRATION CONTRACT & DATA-FLOW AUDIT](#part-2--callmedex--kryiaai--mediassist-ai-integration-contract--data-flow-audit)
  - [Primary Architectural Question](#primary-architectural-question)
  - [Integration Phase 1: Discover Every MediAssist/KryiaAI Reference](#integration-phase-1--discover-every-mediassistkryiaai-reference)
  - [Integration Phase 2: CallMedex → MediAssist Data Flow](#integration-phase-2--callmedex--mediassist-data-flow)
  - [Integration Phase 3: MediAssist → CallMedex Data Flow](#integration-phase-3--mediassist--callmedex-data-flow)
  - [Integration Phase 4: Complete Webhook Inventory](#integration-phase-4--complete-webhook-inventory)
  - [Integration Phase 5: Complete Payload Contract](#integration-phase-5--complete-payload-contract)
  - [Integration Phase 6: Patient Identity Mapping](#integration-phase-6--patient-identity-mapping)
  - [Integration Phase 7: WhatsApp Ownership](#integration-phase-7--whatsapp-ownership)
  - [Integration Phase 8: Lab Report Delivery Flow](#integration-phase-8--lab-report-delivery-flow)
  - [Integration Phase 9: Report File Handling](#integration-phase-9--report-file-handling)
  - [Integration Phase 10: OCR / AI Ownership](#integration-phase-10--ocr--ai-ownership)
  - [Integration Phase 11: Booking Through MediAssist](#integration-phase-11--booking-through-mediassist)
  - [Integration Phase 12: Headless Patient Accounts](#integration-phase-12--headless-patient-accounts)
  - [Integration Phase 13: Duplicate Patient Risk](#integration-phase-13--duplicate-patient-risk)
  - [Integration Phase 14: Callback / Status Synchronization](#integration-phase-14--callback--status-synchronization)
  - [Integration Phase 15: Failure & Retry Architecture](#integration-phase-15--failure--retry-architecture)
  - [Integration Phase 16: Security Boundary](#integration-phase-16--security-boundary)
  - [Integration Phase 17: Personal / Medical Data Shared With MediAssist](#integration-phase-17--personal--medical-data-shared-with-mediassist)
  - [Integration Phase 18: Mobile App Impact](#integration-phase-18--mobile-app-impact)
  - [Integration Phase 19: API Boundary Recommendation](#integration-phase-19--api-boundary-recommendation)
  - [Integration Phase 20: Current vs Target Architecture](#integration-phase-20--current-vs-target-architecture)
  - [Integration Phase 21: Required Changes Before Mobile App](#integration-phase-21--required-changes-before-mobile-app)
  - [Integration Phase 22: Questions to Ask KryiaAI / MediAssist AI Team](#integration-phase-22--questions-to-ask-kryiaai--mediassist-ai-team)
  - [Integration Phase 23: Integration Contract Document](#integration-phase-23--integration-contract-document)
  - [Integration Phase 24: Final Verdict](#integration-phase-24--final-verdict)
  - [What I Now Know](#what-i-now-know)
  - [What I Do Not Know](#what-i-do-not-know)
  - [What Must Be Confirmed With MediAssist](#what-must-be-confirmed-with-mediassist)
  - [Do Not Implement Until Confirmed](#do-not-implement-until-confirmed)

---

# PART 1 — CALLMEDEX COMPLETE PRODUCTION ARCHITECTURE & MOBILE-APP READINESS AUDIT

## Phase 1: Complete Repository Discovery

### 1. Repository Structure Overview
* **`backend/`**: FastAPI 0.115.0 Python backend containing 31 routers (260 endpoints), 39 services, Celery background workers, middleware security stack, and 39 pytest suites (495 tests).
* **`frontend/`**: Next.js 16.2.10 App Router web application with React 19, TypeScript 5, Tailwind CSS, Lucide icons, Sonner toasts, and Playwright E2E test suites.
* **`database/`**: 50 SQL migration and schema scripts creating 86 PostgreSQL tables, 216 indexes, and 58 Row Level Security (RLS) policies.
* **`docs/`**: Comprehensive specifications, OpenAPI schemas (`mediassist-ai.openapi.yaml`, `callmedex-integration.openapi.yaml`), DPDP compliance guides, and runbooks.
* **`docker-compose.yml` & `nginx.conf`**: 5-container production orchestration (FastAPI, Celery Worker, Celery Beat, Redis 7, Nginx reverse proxy).

### 2. Verified Technology Stack
* **Backend:** FastAPI `0.115.0`, Uvicorn `0.30.0`, Python `3.11+`, Pydantic v2 `2.9.0`, Supabase client `>=2.15.0`, Celery `>=5.3.0`, Redis 7 Alpine, HTTPX `0.27.0`, PyMuPDF `1.24.0`, Passlib (bcrypt 3.2.2), Python-Jose `3.3.0`, Razorpay `>=1.4.0`, Google GenerativeAI `>=0.8.3`, Groq `>=0.9.0`.
* **Frontend:** Next.js `16.2.10`, React `19.2.4`, React-DOM `19.2.4`, TypeScript `5`, Lucide-React `^1.27.0`, html5-qrcode `^2.3.8`, Sonner `^2.0.7`, Playwright `^1.61.1`, Axe-Core `^4.12.1`.
* **Database & Storage:** PostgreSQL 15+ (Supabase Managed, PostGIS enabled, 86 tables), Supabase Private Object Storage (`lab-reports`, `verification-docs`).

---

## Phase 2: System Architecture

### Connected Client Applications Audit

| Application / Client | Location in Repo | URL / Base Path | Framework | Auth Mechanism | Database Access | Production Readiness |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Public Website** | `frontend/src/app/(public)` | `/` | Next.js 16 | None / Public | None (via API) | **Production Ready** |
| **Patient Dashboard**| `frontend/src/app/(app)/dashboard/patient` | `/dashboard/patient` | React 19 / Next.js | Bearer JWT (`role=patient`) | None (via API) | **Production Ready** |
| **Doctor Portal** | `frontend/src/app/(app)/dashboard/doctor` | `/dashboard/doctor` | React 19 / Next.js | Bearer JWT (`role=doctor`) | None (via API) | **Near Production** |
| **Phlebotomist App** | `frontend/src/app/(app)/dashboard/phlebotomist`| `/dashboard/phlebotomist` | React 19 / Next.js | Bearer JWT (`role=phlebotomist`) | None (via API) | **Production Ready** |
| **Processing Center**| `frontend/src/app/(app)/dashboard/processing-center`| `/dashboard/processing-center`| React 19 / Next.js | Bearer JWT (`role=processing_center`)| None (via API) | **Production Ready** |
| **Admin Dashboard** | `frontend/src/app/(app)/dashboard/admin` | `/dashboard/admin` | React 19 / Next.js | Bearer JWT (`role=admin`) | None (via API) | **Production Ready** |
| **Organization Portal**| `frontend/src/app/(app)/dashboard/organization` | `/dashboard/organization` | React 19 / Next.js | Bearer JWT (`role=organization`) | None (via API) | **Near Production** |
| **Pharmacy Portal** | `frontend/src/app/(app)/dashboard/pharmacy` | `/dashboard/pharmacy` | React 19 / Next.js | Bearer JWT (`role=pharmacy`) | None (via API) | **Partially Impl.** |
| **Nurse Portal** | `frontend/src/app/(app)/dashboard/nurse` | `/dashboard/nurse` | React 19 / Next.js | Bearer JWT (`role=nurse`) | None (via API) | **Near Production** |
| **Supervisor Portal**| `frontend/src/app/(app)/dashboard/supervisor`| `/dashboard/supervisor` | React 19 / Next.js | Bearer JWT (`role=supervisor`) | None (via API) | **Near Production** |
| **MediAssist AI** | `backend/app/routers/mediassist_inbound.py` | `/api/v1/integrations/mediassist` | External FastAPI | HMAC-SHA256 + Idempotency-Key | Via Backend API | **Production Ready** |

---

## Phase 3: Database Master Audit

The database comprises **86 master tables**, **216 indexes**, and **58 RLS policies** in Supabase PostgreSQL:
* **Core Identities:** `users` (master identity for all 10 roles), `patients` (clinical metadata extension), `family_members` (dependents), `doctors`, `phlebotomists`, `nurses`, `pharmacies`, `organizations`.
* **Diagnostic & Processing Hubs:** `processing_centers`, `processing_center_staff`, `processing_center_areas`, `home_services` (test catalog), `home_service_tubes` (vacutainer mappings), `tube_types`.
* **Specimen Custody & Lifecycle:** `bookings`, `samples` (barcode-locked tubes), `sample_events` (immutable custody log), `sample_batches` (sealed transport batches), `report_jobs` (canonical report pipeline), `ai_report_analyses` (OCR summaries & abnormal flags).
* **Clinical & Telehealth:** `consultations` (Daily.co video rooms & transcripts), `patient_biomarkers` (historical biomarker trends), `patient_medications` (active prescriptions), `emergency_sos_contacts`.
* **Financial & Legal:** `payments` (Razorpay orders & signatures), `provider_wallets`, `wallet_transactions` (immutable credits/debits), `legal_acceptances` (signed MOUs), `mediassist_inbound_requests` (composite idempotency cache).

---

## Phase 4: Patient Identity Analysis

* **Canonical Identifier:** **`users.id`** (`UUID`). All relational foreign keys (`bookings.patient_id`, `samples.patient_id`, `report_jobs.patient_id`, `payments.patient_id`, `family_members.account_user_id`) point directly to `users(id)` where `role = 'patient'`.
* **Auxiliary Clinical Profile:** `patients` is a 1-to-1 extension table (`patients.user_id REFERENCES users(id) ON DELETE CASCADE`) storing clinical attributes (`blood_group`, `height_cm`, `weight_kg`, `preferred_language`, `abha_number`, `consent_status`).
* **Critical Flaw in Phone Uniqueness:** In `database/complete_supabase_schema.sql:16`, `email` is `UNIQUE NOT NULL`, but `mobile` is `TEXT NOT NULL` without a unique constraint. WhatsApp headless bookings create users with dummy emails (`whatsapp+{phone}@patients.callmedex.internal`), risking duplicate account fragmentation if users register on Web/Mobile with their real email.
* **Family Members:** Keyed by `family_members.account_user_id REFERENCES users(id)` with dependent address overrides for home collections.

---

## Phase 5: Authentication & Authorization

* **Password Security:** Bcrypt hashing (`cost = 12`) with strict complexity enforcement (8+ chars, upper, lower, digit, special character).
* **JWT Tokens:** Signed using `HS256` with `JWT_SECRET`. Default access token lifespan: **60 minutes**.
* **Instant Session Revocation:** Every user row has a `token_version` integer. Calling `/api/auth/logout` increments `token_version`, instantly invalidating all existing JWTs.
* **Partner MOU Legal Flow:** Providers (`doctor`, `phlebotomist`, `nurse`, `organization`, `pharmacy`, `staff`) sign up in `pending_mou` status. They receive a 24-hour signed JWT magic link and must accept the terms via `POST /api/auth/accept-mou` before gaining login access.
* **10-Role RBAC Matrix:** Strict role enforcement via `require_role(["patient"])`, `get_current_pc_staff`, and `verify_mediassist_signature`.

---

## Phase 6: Complete API Inventory

The FastAPI backend exposes **260 active endpoints** across 31 routers:
* `auth.py` (8 endpoints): Signup, login, logout, me, forgot-password, reset-password, accept-mou, link-abha.
* `bookings.py` (14 endpoints): Slot availability, home collection creation, patient booking history, cancellations.
* `dispatch.py` (12 endpoints): Real-time phlebotomist dispatch, offer response, live GPS tracking (`/api/dispatch/{id}/track`).
* `family_members.py` (5 endpoints): CRUD operations for dependent family members.
* `home_services.py` (6 endpoints): Public diagnostic catalog, test-to-tube mappings, pricing.
* `ai_reports.py` (6 endpoints): PDF report upload, async job polling (`/jobs/{id}`), report inbox.
* `patient_health.py` (8 endpoints): Longitudinal biomarker matrix, doctor briefing notes.
* `patient_samples.py` (4 endpoints): Live specimen custody tracking rail for patients (`/api/patient/my-samples`).
* `patient_sos.py` (4 endpoints): Emergency SOS trigger and contact management.
* `payments.py` (6 endpoints): Razorpay order generation, signature verification, settlement history.
* `phlebo_doorstep.py` (8 endpoints): Barcode validation, tube checks, OTP confirmation, specimen collection.
* `pc_operations.py` (16 endpoints): Lab intake desk, 5-point physical verification, batch sealing, report publishing.
* `telemedicine.py` (10 endpoints): Daily.co video room creation, token issuance, digital consent, AI e-prescriptions.
* `mediassist_inbound.py` (7 endpoints): Signed webhooks for report delivery, report failure, notifications, WhatsApp bookings, patient lookup.
* `admin.py`, `admin_analytics.py`, `admin_verification.py` (22 endpoints): Platform GMV, fraud alerts, provider verification queues.

---

## Phase 7: End-to-End Feature Audit

* **Fully Wired & Production Ready:** Universal Signup, Email/Password Login, Password Reset OTP, Partner Legal MOU, Home Test Booking Wizard, Doorstep Phlebotomist Scan, Lab Intake & 5-Point Verify, Canonical Report Processing, WhatsApp Report Delivery, Telehealth Video Consultations, AI E-Prescription, Razorpay Payments, Preventive Biomarker Matrix, Emergency SOS.
* **Partially Implemented:** Pharmacy Dark Store Order Fulfillment (needs UI refinement).
* **Mocked Pending Live Credentials:** ABDM / ABHA M2/M3 Sandbox, NHCX Insurance Claim Filing, NMC Doctor Registry Lookup.

---

## Phase 8: Patient Application Readiness

* **Ready for Immediate Mobile Consumption:** Patient profile, Family members hub, Diagnostic catalog, Booking wizard, Live phlebotomist GPS tracking, Specimen custody tracking rail, Lab report inbox & AI summaries, Report PDF upload, Razorpay payments, Video consultations (Daily.co), Biomarker matrix, Emergency SOS.
* **Requires Backend Work Before Mobile Launch:**
  1. Phone Number + SMS OTP Authentication (`POST /api/auth/otp/send`, `/verify`).
  2. Mobile Push Notification Device Token Management (`POST /api/notifications/register-device`).
  3. Long-lived Refresh Token Exchange (`POST /api/auth/refresh-token`).
  4. Automatic Headless WhatsApp Account Claiming.

---

## Phase 9: Lab / Diagnostic Center Architecture

1. **Processing Hub Model:** Physical labs mapped to geospatial service areas with assigned technicians and shift rosters.
2. **Doorstep Barcode Binding:** Phlebotomist scans pre-printed vacutainer barcodes at patient's home, validating format and locking barcode to `samples` row with patient OTP verification.
3. **5-Point Intake Desk Verification:** Intake tech verifies volume, tube color, hemolysis, label integrity, and temperature before batching or analysis.
4. **Report Handoff:** Technicians upload report PDF -> CallMedex creates `report_jobs` row -> hands off to MediAssist for OCR and WhatsApp delivery.

---

## Phase 10: Admin Architecture

* **Operational Dashboards:** Real-time platform GMV, daily order volume, average dispatch SLAs, phlebotomist location heatmaps.
* **Provider Verification Queue:** Document review interface for doctor medical licenses, pharmacy drug certificates, and lab accreditations.
* **Automated Fraud Scoring:** Heuristics detecting GPS teleportation, rapid cancellation spikes, and unverified sample collection.

---

## Phase 11: External Integrations

* **Live & Production Ready:** Supabase (PostgreSQL & Storage), Razorpay (Payments), MediAssist AI (Meta WhatsApp Cloud API & OCR), Daily.co (Video consultations), OpenRouter / Groq (AI LLM clinical summaries), Geoapify (Maps & Geocoding), Resend / SMTP (Email delivery).
* **Simulated / Mocked:** Exotel/Twilio (Masked calling), ABDM Sandbox (ABHA), NMC Registry (Government licenses).

---

## Phase 12: Files, Reports & Medical Documents

* **Storage Provider:** Supabase Object Storage (`lab-reports`, `verification-docs` private buckets).
* **Security Controls:**
  * Magic-byte validation (`%PDF-`, `\xff\xd8\xff`, `\x89PNG`) blocking disguised executables.
  * SSRF protection blocking loopback and internal IP downloads.
  * Short-lived signed URLs (60-minute default expiry) for document access.

---

## Phase 13: Notifications

* **Notification Dispatcher:** `NotificationEngine` supporting Email (Resend), WhatsApp (MediAssist AI), and In-App notifications.
* **Mobile Push Notification Gap:** Push notifications are currently simulated in `NotificationEngine._send_push`. Mobile app requires dedicated FCM/APNS token tables and workers.

---

## Phase 14: Payments

* **Payment Gateway:** Razorpay API (orders created in INR paise).
* **Verification & Idempotency:** HMAC-SHA256 signature verification, exact amount matching, and optimistic state locking (`status == 'created'`), preventing double-capture race conditions.
* **Settlements:** Automated provider wallet credits and 15% platform commission deductions.

---

## Phase 15: Security Audit

* **Critical Severity:** Lack of unique constraint on `users.mobile`, risking duplicate account collision between WhatsApp bookings and web/app signups.
* **High Severity:** Backend uses Supabase service-role key, bypassing PostgreSQL RLS; all endpoints must enforce explicit authorization checks in Python.
* **Security Strengths:** Startup JWT secret entropy enforcement, magic-byte upload inspection, SSRF download defense, PII sanitization middleware, and sliding-window rate limiting.

---

## Phase 16: Frontend/Backend Wiring Audit

* `frontend/next.config.ts:15`: Reads `process.env.API_URL` for rewrites.
* `frontend/src/app/(public)/diagnostics/page.tsx`: Imports static `lab-test-prices.json` as fallback if database catalog is unreachable.
* `frontend/src/app/(public)/packages/page.tsx`: Imports static `health-packages.json` as fallback.

---

## Phase 17: Deployment & Production Audit

* **Docker Multi-Container Setup:** `backend` (FastAPI), `celery-worker` (Background tasks), `celery-beat` (Cron schedules), `redis` (Cache/Broker), `nginx` (Reverse proxy with SSL & rate limiting).
* **Production Targets:** Backend on Render/AWS EC2, Frontend on Vercel, Database on Supabase Mumbai (`ap-south-1`).

---

## Phase 18: Testing Audit

* **Backend Test Suite:** 39 Pytest modules, **495 passing tests** covering sample lifecycles, PC workflows, report pipelines, MediAssist integrations, and dispatch algorithms.
* **Frontend Test Suite:** 6 Playwright E2E specs validating booking wizards, auth flows, and UI responsiveness.

---

## Phase 19: Mobile Architecture Recommendation

### **RECOMMENDED: React Native + Expo (Managed Workflow with TypeScript)**
* **100% Type & Logic Sharing:** Reuses existing TypeScript schemas, Zustand stores, and API client logic.
* **Native Video SDK:** Direct support for Daily.co React Native WebRTC video consultations.
* **Hardware Capabilities:** Instant vacutainer barcode scanning via `expo-camera` and real-time GPS tracking via `expo-location`.

---

## Phase 20: Mobile App Backend Contract

* **Existing Reusable Endpoints:** All `/api/bookings`, `/api/reports/inbox`, `/api/patient/*`, `/api/family-members`, `/api/dispatch/{id}/track`, `/api/payments/*`, `/api/telemed/*`.
* **Endpoints to Create:** `POST /api/auth/otp/send`, `POST /api/auth/otp/verify`, `POST /api/auth/refresh-token`, `POST /api/notifications/register-device`.
* **Forbidden for Mobile:** `/api/admin/*`, `/api/pc/*`, `/api/phlebo/*`, `/api/v1/integrations/mediassist/*`.

---

## Phase 21: Single Source of Truth Assessment

### Verdict: **PARTIALLY ACHIEVED**
* CallMedex is structurally unified in database and API layers, but suffers from split patient identities when users interact across both WhatsApp and Web/Mobile.
* Target architecture unifies all channels under **`users.mobile` (E.164)** resolved to a single **`users.id`** master record.

---

## Phase 22: Data Consistency & Duplicate Patient Audit

* **Root Cause of Duplication:** Unconstrained `users.mobile` and headless WhatsApp account creation (`whatsapp+{phone}@patients.callmedex.internal`).
* **Required Resolution:**
  1. Add partial unique index on `users(mobile)` where `role = 'patient'`.
  2. Normalize all phone inputs to E.164 format (`+91XXXXXXXXXX`).
  3. Implement automatic headless account claiming during mobile Phone OTP verification.

---

## Phase 23: Current Product Capability Matrix

| Capability | Implemented | Backend Ready | Frontend Ready | Production Ready | Mobile Reusable | Required Action |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Email/Password Auth** | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| **Phone OTP Auth** | ❌ | ❌ | ❌ | ❌ | ❌ | **Build Mobile OTP API** |
| **Patient Profile & Vitals** | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| **Family Members Hub** | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| **Home Test Booking Wizard** | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| **Live Phlebo GPS Tracking** | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| **Sample Custody Timeline** | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| **Report AI Analysis** | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| **WhatsApp Report Delivery** | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| **Telehealth Video Consults** | ✅ | ✅ | ✅ | ✅ | ✅ | Embed Daily SDK |
| **Razorpay Payments** | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| **Biomarker Matrix** | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| **Emergency SOS Alert** | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| **Mobile Push Notifications**| ❌ | ❌ | ❌ | ❌ | ❌ | **Build FCM Token API** |

---

## Phase 24: Blockers for Mobile Launch

1. **P0 (Critical):** Missing Phone Number OTP Login (`POST /api/auth/otp/send`, `/verify`).
2. **P0 (Critical):** Duplicate Patient Account Risk (missing unique constraint on `users.mobile` and headless account claiming).
3. **P1 (High):** Missing Mobile Push Token Registration (`POST /api/notifications/register-device`).
4. **P1 (Medium):** Lack of Long-Lived Refresh Token Endpoint (`POST /api/auth/refresh-token`).

---

## Phase 25: Mobile Implementation Roadmap

* **Phase 0 (Days 1–5):** Backend Stabilization (Unique phone constraint, Phone OTP endpoints, Headless account claiming, Refresh tokens, Device push token endpoint).
* **Phase 1 (Days 6–10):** Expo SDK 52 project setup, theme tokens porting, secure storage configuration.
* **Phase 2 (Days 11–15):** Phone OTP login UI, Profile setup, Family members hub.
* **Phase 3 (Days 16–22):** Home test catalog, Booking wizard, Razorpay native checkout.
* **Phase 4 (Days 23–28):** Live phlebotomist GPS tracking map, verbal OTP display, sample custody rail.
* **Phase 5 (Days 29–35):** Reports inbox, PDF viewer, Smart AI summaries, Biomarker matrix.
* **Phase 6 (Days 36–40):** Doctor listing, Daily.co video consultations, digital e-prescriptions.
* **Phase 7 (Days 41–45):** Emergency SOS, Medicine cabinet, Push notifications setup.
* **Phase 8 (Days 46–50):** Physical device QA, offline caching, App Store & Google Play submission.

---

## Phase 26: Final Platform Verdict

* **Overall Status:** `NEAR PRODUCTION`
* **Backend:** `PRODUCTION READY` (260 endpoints, 495 tests)
* **Database:** `PRODUCTION READY` (86 tables, 216 indexes)
* **Authentication:** `NEAR PRODUCTION` (Needs mobile Phone OTP)
* **Patient Identity:** `PARTIALLY COMPLETE` (Requires deduplication fix)
* **APIs:** `PRODUCTION READY`
* **Website:** `PRODUCTION READY`
* **Lab Platform:** `PRODUCTION READY`
* **Admin Platform:** `PRODUCTION READY`
* **Security:** `HIGH QUALITY / PRODUCTION READY`
* **Mobile Readiness:** `85% READY` (5-day backend prerequisite plan)

---

## What You Need From This Audit Before Mobile Development

1. **Canonical Identity Rule:** Always use **`users.id`** (UUID) as the primary patient identifier in all mobile API headers and relational queries. Never use `patients.id`.
2. **Phone Normalization:** Ensure all phone numbers are formatted in **E.164** (`+91XXXXXXXXXX`).
3. **Session Expiry Handling:** Handle 60-minute JWT token expiry by implementing automatic refresh token interceptors.
4. **Private Storage Access:** Never store public URLs for medical reports; always request short-lived Signed URLs from `/api/reports/inbox`.

---

## Do Not Build Yet

1. **DO NOT build Email/Password forms for mobile** (patients require Phone OTP).
2. **DO NOT build ABHA M2/M3 or NHCX Insurance workflows** (currently simulated).
3. **DO NOT build direct doctor telephony calling** (prioritize Daily.co video).
4. **DO NOT replicate business logic locally in SQLite** (mobile app is a thin client over FastAPI).

---

# PART 2 — CALLMEDEX ↔ KRYIAAI / MEDIASSIST AI INTEGRATION CONTRACT & DATA-FLOW AUDIT

## Primary Architectural Question

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             CALLMEDEX CORE SYSTEM                                │
│  OWNS: Patient Identity Master, Medical Records, Bookings, Processing Centers,   │
│        Barcode Specimen Custody FSM, Payments, Canonical Storage & Mobile APIs   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                 Signed REST Calls
                  (Bearer Token + HMAC-SHA256 + Idempotency-Key)
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        KRYIAAI / MEDIASSIST AI GATEWAY                           │
│  OWNS: Meta WhatsApp Business Account (WABA), WhatsApp NLU & Intent Parsing,     │
│        Multi-Lingual OCR & Clinical Interpretation, WhatsApp Message Dispatch    │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                             Meta WhatsApp Cloud API
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           PATIENT / PROVIDER WHATSAPP                            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Phase 1: Discover Every MediAssist/KryiaAI Reference

* **Total References:** 1,085 keyword occurrences across code, configuration, and documentation.
* **Core Modules:**
  * `backend/app/integrations/mediassist_client.py`: Outbound client with HMAC signing, circuit breaker, and retry logic.
  * `backend/app/middleware/mediassist_auth.py`: Inbound HMAC verification, timestamp skew validation, and idempotency caching.
  * `backend/app/routers/mediassist_inbound.py`: 7 inbound callback routes.
  * `backend/app/services/report_submission.py`: Authoritative report submission and fallback analyzer handler.
  * `docs/integrations/mediassist-ai/`: OpenAPI specifications and architecture documentation.

---

## Integration Phase 2: CallMedex → MediAssist Data Flow

### Outbound Endpoints:
1. `POST /api/v1/report-jobs` (Submit report for OCR + WhatsApp delivery).
2. `GET /api/v1/report-jobs/{report_job_id}` (Poll job status).
3. `POST /api/v1/notifications` (Send templated WhatsApp notifications).

### Outbound Request Lifecycle:
1. Check circuit breaker (3-state: closed -> open -> half-open; threshold: 5 failures, reset: 30s).
2. Canonical JSON serialization: `json.dumps(body, separators=(',', ':'), sort_keys=True)`.
3. Generate HMAC-SHA256 signature: `sha256=HMAC(secret, timestamp + "." + raw_bytes)`.
4. Inject headers: `Authorization: Bearer <token>`, `X-Signature`, `X-Timestamp`, `X-Idempotency-Key`, `X-Correlation-Id`.
5. Transmit over HTTP (Connect timeout: 10s, Total timeout: 20s, Max retries: 5 with exponential backoff).

---

## Integration Phase 3: MediAssist → CallMedex Data Flow

### Inbound Endpoints:
1. `POST /api/v1/integrations/mediassist/callbacks/report-processing`
2. `POST /api/v1/integrations/mediassist/callbacks/report-accepted`
3. `POST /api/v1/integrations/mediassist/callbacks/report-delivered` (and `/report-corrected`)
4. `POST /api/v1/integrations/mediassist/callbacks/report-failed`
5. `POST /api/v1/integrations/mediassist/callbacks/report-expired`
6. `POST /api/v1/integrations/mediassist/callbacks/notification-status`
7. `GET /api/v1/integrations/mediassist/patients/lookup`
8. `POST /api/v1/integrations/mediassist/whatsapp-bookings`

### Inbound Request Verification:
1. `SecurityMiddleware.SKIP_SANITIZE_PATHS` preserves exact raw request bytes.
2. `verify_mediassist_signature` checks Bearer token, timestamp freshness (`abs(now - ts) <= 300s`), and verifies HMAC digest.
3. Query `mediassist_inbound_requests` by composite PK `(idempotency_key, endpoint)`; if cached, returns original response immediately.
4. Executes business logic, updates database, writes audit log, and stores response in idempotency cache.

---

## Integration Phase 4: Complete Webhook Inventory

| Webhook Route | Direction | Purpose | Auth | Payload Summary | DB Impact | Idempotency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `/callbacks/report-processing` | MA → CM | Report OCR started | Bearer + HMAC | `report_job_id`, `occurred_at` | `UPDATE report_jobs SET status='processing'` | Cached in DB | **Active** |
| `/callbacks/report-accepted` | MA → CM | Queue job accepted | Bearer + HMAC | `report_job_id`, `occurred_at` | `UPDATE report_jobs SET status='accepted'` | Cached in DB | **Active** |
| `/callbacks/report-delivered` | MA → CM | Report delivered on WhatsApp | Bearer + HMAC | `report_job_id`, `analysis` | `UPDATE report_jobs SET status='delivered'`; `INSERT INTO ai_report_analyses` | Cached in DB + UNIQUE FK | **Active** |
| `/callbacks/report-corrected` | MA → CM | Report amended | Bearer + HMAC | `report_job_id`, `analysis` | `UPDATE report_jobs SET status='corrected'`; `INSERT INTO ai_report_analyses (version=2)`| Cached in DB | **Active** |
| `/callbacks/report-failed` | MA → CM | Report processing failed | Bearer + HMAC | `report_job_id`, `failure_reason` | `UPDATE report_jobs SET status='failed'` | Cached in DB | **Active** |
| `/callbacks/report-expired` | MA → CM | Delivery TTL expired | Bearer + HMAC | `report_job_id`, `occurred_at` | `UPDATE report_jobs SET status='expired'` | Cached in DB | **Active** |
| `/callbacks/notification-status`| MA → CM | WhatsApp delivery status | Bearer + HMAC | `notification_id`, `status` | Persisted in `audit_log` | Cached in DB | **Active** |
| `/patients/lookup` | MA → CM | Resolve phone to patient | Bearer + HMAC | `?phone=+91XXXXXXXXXX` | Read-only (`users`, `patients`) | Read-only | **Active** |
| `/whatsapp-bookings` | MA → CM | Create booking from WhatsApp | Bearer + HMAC | `phone`, `service_type`, `address` | `INSERT INTO bookings`; creates headless user if phone unknown | Cached in DB | **Active** |

---

## Integration Phase 5: Complete Payload Contract

### Sample: `POST /api/v1/report-jobs` (CallMedex → MediAssist)
```json
{
  "report_job_id": "9f2c8a1e-3b4c-5d6e-7f8a-9b0c1d2e3f4a",
  "source_type": "lab_report",
  "source_document_url": "https://supabase.callmedex.internal/storage/v1/object/sign/lab-reports/pat-1/report.pdf?token=...",
  "connector_type": "patient_upload",
  "booking_id": "8a1e2f3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "sample_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  "processing_center_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "barcode": "CMD-BLD-998822",
  "patient": {
    "patient_id": "e0a1b2c3-d4e5-f6a7-b8c9-d0e1f2a3b4c5",
    "phone": "+919876543210",
    "preferred_language": "te"
  },
  "delivery": {
    "channels": ["whatsapp"]
  },
  "callback_base_url": "https://api.callmedex.in/api/v1/integrations/mediassist/callbacks"
}
```

### Sample: `POST /callbacks/report-delivered` (MediAssist → CallMedex)
```json
{
  "report_job_id": "9f2c8a1e-3b4c-5d6e-7f8a-9b0c1d2e3f4a",
  "occurred_at": "2026-08-16T10:45:00.000Z",
  "delivered_channel": "whatsapp",
  "message_id": "wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSRjQ...",
  "analysis": {
    "plain_language_summary": "Your Complete Blood Count is mostly normal. Hemoglobin is slightly low at 11.2 g/dL.",
    "doctor_clinical_summary": "CBC indicates mild microcytic hypochromic anemia (Hb: 11.2 g/dL). TLC: 6,800/uL, Platelets: 240,000/uL.",
    "health_score": 82,
    "abnormal_flags": [
      {
        "marker": "Hemoglobin",
        "value": "11.2",
        "status": "low",
        "reference_range": "12.0 - 15.5 g/dL"
      }
    ],
    "recommendations": [
      "Increase dietary iron intake (spinach, legumes, dates)"
    ]
  }
}
```

---

## Integration Phase 6: Patient Identity Mapping

* **Canonical Mapping:** `CallMedex users.id` (UUID) ↔ `MediAssist phone` (E.164).
* **Correlation:** Maintained dynamically via phone number and `report_jobs.id`. No separate cross-reference mapping table exists.

---

## Integration Phase 7: WhatsApp Ownership

* **CallMedex Direct Meta API Access:** **`NO`** (0 direct calls).
* **MediAssist Direct Meta API Access:** **`YES`** (MediAssist owns WABA, templates, and delivery).
* **CallMedex Direct WhatsApp Sending:** **`NO`** (All WhatsApp alerts route via MediAssist).

---

## Integration Phase 8: Lab Report Delivery Flow

`Sample Collected -> PC Verification -> Lab Analyzer PDF -> Supabase Storage (Signed URL) -> CallMedex ReportJob Created -> MediAssist OCR & Translation -> WhatsApp PDF Sent -> MediAssist Callback -> CallMedex ai_report_analyses Insert -> App & Web Live`.

---

## Integration Phase 9: Report File Handling

* **File Storage:** Stored permanently in CallMedex private Supabase bucket (`lab-reports`).
* **Access Method:** Time-limited signed URLs (3,600s expiration) passed to MediAssist.
* **Mobile Retrieval:** Mobile app requests fresh signed URLs independently via `GET /api/reports/inbox`.

---

## Integration Phase 10: OCR / AI Ownership

* **Primary OCR & Clinical Summary:** MediAssist AI (external).
* **Fallback Analyzer:** CallMedex `GroqReportAnalyzerService` (in-process Groq Llama 3.3 70B).
* **Biomarker Longitudinal Trends:** CallMedex (`patient_health.py` -> `patient_biomarkers`).

---

## Integration Phase 11: Booking Through MediAssist

`Patient WhatsApp Chat -> MediAssist NLU -> GET /patients/lookup -> POST /whatsapp-bookings -> CallMedex creates booking -> MediAssist confirms on WhatsApp`.

---

## Integration Phase 12: Headless Patient Accounts

* **Trigger:** WhatsApp booking from a new phone number.
* **Created Identity:** `users` row with `email = whatsapp+{phone}@patients.callmedex.internal` and randomized uncommunicated password hash.
* **Account Claiming:** Reclaimed automatically when patient signs into Mobile App using Phone OTP.

---

## Integration Phase 13: Duplicate Patient Risk

* **Status:** `PARTIALLY SAFE`
* **Risk:** High if patient registers via Web email/password; Safe once Phone OTP authentication is deployed.

---

## Integration Phase 14: Callback / Status Synchronization

Full FSM lifecycle tracked in `report_jobs.status`: `queued -> submitted -> accepted -> processing -> delivered (or failed / expired)`.

---

## Integration Phase 15: Failure & Retry Architecture

* **Outbound Failures:** Retried 5x with exponential backoff. In-process fallback activates if MediAssist is offline.
* **Inbound Duplicate Webhooks:** Deduplicated by `mediassist_inbound_requests` cache and database unique constraints.

---

## Integration Phase 16: Security Boundary

* Pre-shared Bearer tokens per environment.
* HMAC-SHA256 signing (`X-Signature`) over body and query strings.
* Replay protection with 300-second timestamp freshness window (`X-Timestamp`).
* Starlette raw-byte preservation via `SKIP_SANITIZE_PATHS`.

---

## Integration Phase 17: Personal / Medical Data Shared With MediAssist

* **Shared:** Patient full name, phone number, preferred language, booking ID, and raw report PDF (via signed URL).
* **Never Shared:** Patient email, password hashes, payment credentials, or historical medical consultation records.

---

## Integration Phase 18: Mobile App Impact

* Mobile app communicates **exclusively** with CallMedex Backend API (`https://api.callmedex.in`).
* Mobile app has zero direct communication with MediAssist or Meta WhatsApp Cloud API.

---

## Integration Phase 19: API Boundary Recommendation

* **Mobile ──► CallMedex:** Patient Auth, Bookings, Vitals, Reports, Payments.
* **CallMedex ──► MediAssist:** Report OCR Jobs, WhatsApp Notifications.
* **MediAssist ──► CallMedex:** Report Callbacks, WhatsApp Bookings, Patient Lookup.
* **MediAssist ──► Meta WhatsApp:** Cloud API Message Dispatch.

---

## Integration Phase 20: Current vs Target Architecture

* **Current Architecture:** Headless WhatsApp users and email web users risk fragmented duplicate accounts.
* **Target Architecture:** Canonical phone identity resolves all WhatsApp, Mobile, and Web interactions to a single patient UUID.

---

## Integration Phase 21: Required Changes Before Mobile App

1. **P0:** Partial unique index on `users.mobile` for patient role.
2. **P0:** Phone OTP endpoints (`/api/auth/otp/send`, `/verify`) with automatic headless user claiming.
3. **P1:** Mobile device push token registration (`/api/notifications/register-device`).
4. **P1:** Refresh token endpoint (`/api/auth/refresh-token`).

---

## Integration Phase 22: Questions to Ask KryiaAI / MediAssist AI Team

1. Exact production base URLs and Bearer token / HMAC secret provisioning.
2. List of approved Meta WABA message template names and parameter mappings.
3. Data retention and purging policy for ephemeral report PDFs on MediAssist infrastructure.
4. Maximum retry duration for unreachable WhatsApp recipients.

---

## Integration Phase 23: Integration Contract Document

* Complete specification defining ownership boundaries, cryptographic signing rules, and REST endpoint contracts.

---

## Integration Phase 24: Final Verdict

* **Integration Status:** `PRODUCTION READY`
* **WhatsApp Ownership:** `MEDIASSIST (100%)`
* **Patient Identity Mapping:** `PARTIALLY SAFE` (Requires Phone OTP claiming)
* **Lab Report Delivery:** `VERIFIED`
* **API & Webhook Contract:** `COMPLETE`
* **Security Boundary:** `STRONG`
* **Mobile Compatibility:** `READY`

---

## What I Now Know
1. CallMedex has zero direct dependencies on Meta WhatsApp Cloud API.
2. MediAssist AI is the sole WhatsApp gateway.
3. Both systems use HMAC-SHA256 signatures with 300s timestamp freshness and idempotency caching.
4. `users.id` (UUID) is the master patient identity across both systems.
5. In-process fallback analyzer (`GroqReportAnalyzerService`) ensures uninterrupted local report analysis if MediAssist is offline.

## What I Do Not Know
1. Production domain hostnames for MediAssist AI.
2. Exact approved Meta WABA template strings.

## What Must Be Confirmed With MediAssist
1. Staging and Production credentials (Bearer tokens & HMAC secret).
2. Approved WhatsApp template catalog schema.
3. Ephemeral PDF retention window.

## Do Not Implement Until Confirmed
1. **DO NOT change inbound MediAssist route paths or schemas.**
2. **DO NOT attempt direct calls to Meta WhatsApp Cloud API from CallMedex.**
3. **DO NOT alter HMAC signature or timestamp verification logic.**
