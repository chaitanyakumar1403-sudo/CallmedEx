# 01 — REPOSITORY CURRENT-STATE MODEL

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Evaluation Date:** 2026-09-22  
**Verification Level:** STATICALLY VERIFIED with Test Suite Corroboration  

---

## 1. EXECUTIVE SUMMARY OF CODEBASE REALITY

CallMedex is an **orchestration marketplace for Indian healthcare**, transitioning from a web-first prototype toward a full multi-channel ecosystem (Web, Mobile, WhatsApp, and Partner APIs).

Rather than an isolated clinic management system, it implements:
- A **multi-sided supply network**: Patients, Doctors, Phlebotomists, Nurses, Dietitians, Physiotherapists, Dentists, Diagnostic Centers, Polyclinics, Hospitals, and Pharmacies.
- An **on-demand dispatch engine** (Uber/Swiggy model) for home health collections and nursing visits.
- A **sample custody lifecycle** tracking blood/specimen tubes from patient draw to Processing Center to partner reference lab.
- An **externalized AI & WhatsApp bridge**: OCR, WhatsApp messaging, and report interpretation are outsourced via signed REST contracts to an external microservice called **MediAssist AI** (`ZukoLabs` / `KriyaAI`).

---

## 2. SUBSYSTEM CAPABILITY MATRIX

| Domain / Subsystem | Implementation Status | Static Confidence | Runtime Confidence | Primary Implementation File(s) | Primary Risk or Gap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication & Users** | `VERIFIED` | High | High | `app/routers/auth.py`, `app/middleware/auth.py` | OTP spoofing in dev; weak JWT in default env. |
| **Provider Onboarding & MOU** | `VERIFIED` | High | Moderate | `app/services/legal.py`, `app/routers/auth.py` | Unsigned MOU bypass in older accounts. |
| **Appointment & Slot Booking** | `VERIFIED` | High | High | `app/routers/bookings.py`, `app/services/marketplace.py` | Partner-blind allocation relies on static district mapping. |
| **Universal Dispatch Engine** | `VERIFIED` | High | High | `app/services/dispatch_engine.py`, `app/routers/dispatch.py` | Celery beat must run continuously for sweeps. |
| **Processing Center Operations**| `VERIFIED` | High | High | `app/services/processing_center.py`, `app/routers/pc_operations.py` | Relies on manual batching if automations stall. |
| **Sample Custody & Barcodes** | `VERIFIED` | High | High | `app/services/samples.py`, `app/routers/samples.py` | Tube barcode collision mitigation limited to 6 retries. |
| **Telemedicine & Video Calls** | `PARTIALLY IMPLEMENTED` | High | Low | `app/services/telemedicine.py`, `app/routers/telemedicine.py` | Daily.co integration works; Jitsi fallback is unauthenticated. |
| **Pharmacy Orders & Inventory** | `IMPLEMENTED` | High | Moderate | `app/routers/pharmacy_orders.py`, `app/services/pharmacy.py` | No live drug database API; relies on local inventory table. |
| **Payment Orders & Verification**| `PARTIALLY IMPLEMENTED` | High | Moderate | `app/routers/payments.py`, `app/services/payment.py` | **No server-side Razorpay webhook**; client verify only. |
| **MediAssist AI Integration** | `VERIFIED` | High | High | `app/integrations/mediassist_client.py`, `app/routers/mediassist_inbound.py` | Single point of failure for WhatsApp and lab OCR. |
| **Direct WhatsApp Handling** | `DEAD / OUTSOURCED` | High | N/A | `app/routers/communications.py` | CallMedex does not call Meta Cloud API directly. |
| **MocDoc Connector Automation**| `CONFIGURED ONLY` | High | N/A | `app/routers/mediassist_inbound.py` | Browser scraping executed by MediAssist, not CallMedex. |
| **ABDM / ABHA Integration** | `STUBBED / MOCKED` | High | Zero | `app/services/abdm.py` | Sandbox stubs only; M1/M2/M3 milestone incomplete. |
| **NHCX Insurance Integration**| `STUBBED / MOCKED` | High | Zero | `app/services/nhcx.py`, `app/routers/insurance.py` | Returns hardcoded Star Health ₹5,00,000 policy data. |
| **Government Registry Checks** | `STUBBED / MOCKED` | High | Moderate | `app/services/gov_registry.py` | `USE_MOCK_GOV_API=true` auto-approves 4+ char IDs. |
| **Background Tasks (Celery)** | `IMPLEMENTED` | High | Moderate | `app/workers/celery_app.py`, `app/workers/tasks/` | Requires independent Redis and worker containers. |
| **Web Frontend (Next.js 16)** | `VERIFIED` | High | High | `frontend/src/app/` | Uses React 19 canary patterns; large monolithic CSS. |
| **Mobile App (Expo 52)** | `IMPLEMENTED` | High | Moderate | `mobile/app/`, `mobile/src/` | 11 role screen layouts; requires EAS build testing. |

---

## 3. WHAT EXISTS (STATICALLY VERIFIED IN CODE)

### A. Core Platform Engines
1. **Universal Dispatch Engine (`app/services/dispatch_engine.py`, 2,112 lines):**
   - Real-time geospatial search (`find_nearby_providers`) within 15 km (expanded to 30 km for urgent work).
   - Multi-round offer rotation (10-minute contractual response window per provider).
   - Real-time tracking gate with secure, expirable, unguessable public tracking tokens (`/api/track/{token}`).
   - Service fee calculation honoring an 80/20 platform split.

2. **Processing Center & Chain of Custody (`app/services/samples.py`, 1,183 lines):**
   - Minting unique human-readable barcodes (`CMX-YYMMDD-XXXXXX`).
   - Finite State Machine (FSM) enforcing 13 physical states from `pending_collection` to `completed`.
   - Tube allocation engine matching tests to required vacuum collection tubes (K2 EDTA, Fluoride, Serum, Sodium Citrate).
   - Batch creation, sealing, custody transfer, and laboratory result ingest.

3. **Multi-Role User & Signup System (`app/routers/auth.py`, 2,538 lines):**
   - Supports 12 distinct system roles with role-specific profile tables (`patients`, `doctors`, `phlebotomists`, `nurses`, `pharmacies`, `organizations`, `staff`, `dietitians`, `physiotherapists`, `dentists`, `ambulance`, `admin`).
   - Digital MOU dispatch and verification engine requiring cryptographic email token acceptance before activating partner accounts.
   - Dual authentication modes: Email + Password (with complexity validation) and SMS OTP (via MSG91 with rate limits and 5-minute expiries).
   - Biometric public-key challenge/response authentication endpoints for mobile clients (`BiometricRegisterRequest`, `BiometricVerifyRequest`).

4. **MediAssist AI Integration Bridge (`app/routers/mediassist_inbound.py`, 676 lines):**
   - 7 inbound endpoints sitting behind `verify_mediassist_signature` (HMAC-SHA256 signature verification over `timestamp.body` with 5-minute replay prevention).
   - Idempotency caching on `X-Idempotency-Key` via `mediassist_inbound_requests` table.
   - WhatsApp-originated headless patient registration and booking ingest (`POST /api/v1/integrations/mediassist/whatsapp-bookings`).

---

## 4. WHAT IS PARTIALLY IMPLEMENTED

1. **Payment Processing (`app/routers/payments.py`):**
   - Razorpay order creation (`/api/payments/create-order`) validates server-side prices against bookings and published provider fees.
   - Payment verification (`/api/payments/verify`) validates HMAC signatures and fetches payment status directly from Razorpay.
   - **Gap:** Entirely reliant on client-side redirect/callback. No server-to-server webhook handler (`/webhooks/razorpay` is absent from router code). If the patient closes their mobile app or browser before the callback completes, the transaction remains in `created` status indefinitely.

2. **Telemedicine (`app/services/telemedicine.py`):**
   - Daily.co API integration creates video rooms and returns room URLs and tokens.
   - **Gap:** When `DAILY_API_KEY` is not configured, it falls back to generating public, unauthenticated Jitsi Meet URLs (`https://meet.jit.si/callmedex-{room_id}`), which lacks clinical encryption and access controls.

3. **Provider Settlement Engine (`app/workers/tasks/payments.py`):**
   - Daily 2:00 AM Celery cron moves `captured` payments to `settled` and writes ledger rows in `settlements`.
   - **Gap:** The actual automated payout via Razorpay Route API (`client.transfer.create`) is commented out with a `# In production:` comment. Settlements are ledger-only records requiring manual bank disbursements.

---

## 5. WHAT IS MOCKED / STUBBED

1. **Government Registry Licensing Checks (`app/services/gov_registry.py`):**
   - When `USE_MOCK_GOV_API=true` (which is forced in development and can be accidentally toggled in staging):
     - National Medical Council (NMC) doctor licenses are verified via `_mock_verify`.
     - Pharmacy drug licenses (Form 20/21) are auto-verified.
     - Any alphanumeric string $\ge 4$ characters that does not contain `TEST`, `FAKE`, or `INVALID` is approved as a genuine medical professional.

2. **ABDM / ABHA Sandbox (`app/services/abdm.py`):**
   - ABHA number generation, OTP verification, and health record linking return synthetic data without interacting with the National Health Authority (NHA) gateway.

3. **NHCX Insurance Gateway (`app/services/nhcx.py`):**
   - `fetch_patient_policy(abha_number)` returns a static Star Health comprehensive policy with ₹5,00,000 coverage.
   - Claim settlement calls store mock claim references with no insurance TPA communication.

---

## 6. WHAT IS DEAD / UNUSED

1. **Legacy WhatsApp Webhook Route (`app/routers/communications.py`):**
   - Contains routes and references to legacy Meta WhatsApp Cloud API webhooks.
   - Dead because CallMedex shifted all WhatsApp ingress and egress exclusively to MediAssist AI (`docs/integrations/mediassist-ai/README.md`).

2. **Direct Browser Automation Scraping Scripts:**
   - Root-level artifacts in `app/integrations/callmedex/browser/` represent stale traces of earlier local Playwright attempts to scrape MocDoc. Playwright is not listed in backend `requirements.txt` and is not executed by the API container.

3. **Duplicate Processing Center Dashboard Directories in Frontend:**
   - `frontend/src/app/(app)/dashboard/processing-center/` vs `frontend/src/app/(app)/dashboard/processing_center/`.
   - Both directories exist in the filesystem, causing route ambiguity if not strictly aliased.

---

## 7. WHAT IS BROKEN OR HIGH RISK

1. **Database Service Key Usage (Complete RLS Bypass):**
   - `app/database.py` initializes the primary Supabase client using `SUPABASE_SERVICE_KEY`.
   - **Consequence:** PostgreSQL Row Level Security (RLS) is 100% disabled for all backend operations. Tenant isolation relies solely on Python developers remembering to append `.eq("user_id", ...)` or `.eq("organization_id", ...)` to every query.

2. **Vulnerability to Post-Payment Network Drops:**
   - Without an asynchronous Razorpay webhook listener, any network failure immediately after payment completion results in the patient being billed while the booking remains unconfirmed and undispatched.

3. **Admin Hierarchy City-Filtering Gap:**
   - In `app/routers/admin.py`, City Supervisors managing specific municipalities have city filters applied to user listings, but `metrics['total_bookings']` returns `'N/A (City filter applied)'` because bookings are not natively keyed to a city column.

---

## 8. WHAT REQUIRES RUNTIME OR CREDENTIALED VERIFICATION

1. **MediAssist AI Inbound Webhooks:** Requires live HMAC shared secret (`MEDIASSIST_HMAC_SECRET`) and reachable callback URL to test replay protection and signature enforcement under network delay.
2. **Push Delivery Service (FCM v1 & APNs):** Requires deployment of `FCM_SERVICE_ACCOUNT_JSON` and Apple `.p8` private keys on a live server to verify push token receipt on physical iOS and Android hardware.
3. **Daily.co WebRTC Performance:** Clinical video latency and recording stability cannot be statically evaluated without live room connections.
4. **Celery Beat Execution:** Verifying that scheduled dispatch sweeps fire every 5 minutes in production without worker memory degradation.
