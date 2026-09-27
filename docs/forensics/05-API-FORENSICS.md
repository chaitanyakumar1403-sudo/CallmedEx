# 05 — API FORENSICS & ROUTE INVENTORY

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Complete HTTP Route Architecture Audit  
**Verification Level:** STATICALLY VERIFIED against FastAPI route table and Pydantic schemas  

---

## 1. API SURFACE OVERVIEW

The CallMedex FastAPI application registers **505 distinct route definitions** (including method variations, HEAD handlers, and direct path aliases) across 37 APIRouter instances.

### Key Route Classification:
- **Public Unauthenticated Routes:** ~45 routes (Health checks, public provider directory search, test catalogs, tracking token resolver, MOU verification links, public login/signup/OTP).
- **Patient Authenticated Routes:** ~95 routes (`role='patient'`: booking management, longitudinal vitals, family members, payment initiation, telemedicine, SOS).
- **Clinical Provider Routes:** ~160 routes (`doctor`, `nurse`, `phlebotomist`, `pharmacy`, `dentist`, `dietitian`, `physiotherapist`: job dispatch queue, clinical notes, barcode binding, e-prescriptions, inventory, tariff configuration).
- **Processing Center & Lab Routes:** ~70 routes (`pc_operations.py`, `roster.py`, `lab_team.py`: specimen verification, tube intake, batch sealing, analyzer result uploads).
- **Administrative & Supervisor Routes:** ~85 routes (`admin.py`, `admin_analytics.py`, `admin_verification.py`, `processing_center_admin.py`: KPI analytics, user role updates, supervisor creation, credential audits).
- **Integration & Webhook Ingress:** ~12 routes (`mediassist_inbound.py`, `communications.py`: HMAC-signed callbacks, WhatsApp booking bridge, telephony events).
- **Direct Global Aliases:** 4 aliases defined on root `app` in `main.py` (`/api/track/{token}`, `/api/v1/patient/savings`, `/api/communications/notifications*`).

---

## 2. DETAILED ENDPOINT AUDIT BY MAJOR SUBSYSTEM

### A. Authentication & Account Lifecycle (`app/routers/auth.py`)

| Method | Route Path | Request Schema | Response Schema | Auth Required | Tenant / User Scope | Side Effects / Database Writes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | `UserSignup` | `APIResponse` | None (Public) | None | Inserts `users`, role profile table (`patients`, `doctors`, etc.), `family_members`. Dispatches MOU email if provider. |
| `POST` | `/api/auth/login` | `UserLogin` | `TokenResponse` | None (Public) | Scoped to email | Reads `users`, verifies bcrypt hash, validates `is_active`. Issues JWT + Refresh Token. |
| `POST` | `/api/auth/otp/send` | `SendOTPRequest` | `APIResponse` | None (Public) | Scoped to mobile | Generates 6-digit OTP, writes hashed OTP to `verification_otps`, calls MSG91 SMS API. |
| `POST` | `/api/auth/otp/verify` | `VerifyOTPRequest` | `TokenResponse` | None (Public) | Scoped to mobile | Validates OTP, creates headless user if new, marks user verified, issues session JWT. |
| `POST` | `/api/auth/refresh` | `RefreshTokenRequest` | `TokenResponse` | None (Public) | Scoped to token `sub` | Validates refresh token in `refresh_tokens` table, rotates refresh token, issues new access token. |
| `POST` | `/api/auth/biometric/challenge` | `BiometricChallengeRequest` | `BiometricChallengeResponse` | None (Public) | Scoped to `device_id` | Generates 32-byte random hex challenge with 2-minute expiry, stores in Redis/memory. |
| `POST` | `/api/auth/biometric/verify` | `BiometricVerifyRequest` | `TokenResponse` | None (Public) | Scoped to `device_id` | Verifies ECDSA/RSA signature of challenge against stored public key. Issues JWT on success. |
| `POST` | `/api/auth/logout` | None | `APIResponse` | Bearer JWT | `current_user['sub']` | Increments `users.token_version` to immediately revoke all issued tokens. |
| `POST` | `/api/auth/mou/accept` | `MOUAcceptRequest` | `APIResponse` | None (Token Bearer)| Cryptographic token | Validates token signature, updates `users.mou_accepted=true`, logs to `mou_acceptances`. |

### B. Bookings & Diagnostic Scheduling (`app/routers/bookings.py`)

| Method | Route Path | Request Schema | Response Schema | Auth Required | Tenant / User Scope | Side Effects / Database Writes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/bookings` | `BookingCreate` | `BookingResponse` | Bearer JWT | `patient_id=current_user['sub']` | Computes price from `home_services`, allocates PC, inserts `bookings`, `booking_subjects`, `booking_tests`, derives `samples`. |
| `GET` | `/api/bookings/my` | None | `List[BookingResponse]` | Bearer JWT | Filtered by `patient_id` or `provider_id` | Enriches booking rows with family member names, slot times, and report links. |
| `GET` | `/api/bookings/{id}` | None | `BookingResponse` | Bearer JWT | Enforces patient or assigned provider | Reads booking. Strips internal processing center identity for home collections. |
| `POST` | `/api/bookings/{id}/cancel` | `{ reason: str }` | `APIResponse` | Bearer JWT | Patient or provider | Cancels booking, releases slots, transitions linked samples to `cancelled`. |
| `POST` | `/api/bookings/{id}/allot-slot`| `SlotAllotment` | `APIResponse` | Bearer JWT (`organization`) | `provider_id=current_user['sub']` | Organization proposes specific appointment time. Updates booking status to `slot_allotted`. |
| `POST` | `/api/bookings/{id}/respond-slot`| `SlotAllotmentResponse`| `APIResponse` | Bearer JWT (`patient`) | `patient_id=current_user['sub']` | Patient accepts or rejects allotted slot. Updates status to `confirmed` or `cancelled`. |

### C. Universal Dispatch & Live Tracking (`app/routers/dispatch.py`)

| Method | Route Path | Request Schema | Response Schema | Auth Required | Tenant / User Scope | Side Effects / Database Writes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/dispatch/request` | `DispatchRequest` | `APIResponse` | Bearer JWT | Patient | Queries nearby on-duty providers within 15 km, creates `dispatch_requests` and `dispatch_offers`. |
| `GET` | `/api/dispatch/offers` | None | `List[DispatchOfferResponse]`| Bearer JWT (`phlebotomist`/`nurse`)| `provider_id=current_user['sub']` | Returns active pending job offers with countdown timers. |
| `POST` | `/api/dispatch/offers/{id}/accept`| None | `APIResponse` | Bearer JWT | Assigned provider | Locks offer, cancels competing offers, transitions request to `provider_accepted`. |
| `POST` | `/api/dispatch/offers/{id}/decline`| None | `APIResponse` | Bearer JWT | Assigned provider | Marks offer `declined`, triggers next provider rotation. |
| `POST` | `/api/dispatch/{id}/status` | `{ status: str, lat, lng }`| `APIResponse` | Bearer JWT | Assigned provider | Updates request status (`en_route`, `arrived`, `in_progress`), updates live GPS coordinates. |
| `GET` | `/api/dispatch/track/{token}` | None | `dict` | None (Public via Token) | Unguessable UUID token | Returns real-time provider location, ETA, and masked contact details. Strips sensitive PII. |
| `GET` | `/api/track/{token}` (Alias) | None | `dict` | None (Public via Token) | Root route alias | Direct forward to `get_public_guardian_track`. |

### D. MediAssist AI Integration Ingress (`app/routers/mediassist_inbound.py`)

| Method | Route Path | Request Schema | Response Schema | Auth Required | Tenant / User Scope | Side Effects / Database Writes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/integrations/mediassist/callbacks/report-processing`| `ReportCallback` | Flat JSON | HMAC-SHA256 Signature | `report_job_id` | Updates `report_jobs.status='processing'`. Logs audit record. |
| `POST` | `/api/v1/integrations/mediassist/callbacks/report-delivered` | `ReportDeliveredCallback` | Flat JSON | HMAC-SHA256 Signature | `report_job_id` | Stores AI interpretation, health score, and abnormal flags in `ai_report_analyses`. |
| `POST` | `/api/v1/integrations/mediassist/callbacks/report-failed` | `ReportFailedCallback` | Flat JSON | HMAC-SHA256 Signature | `report_job_id` | Records failure reason (`ocr_failed`, `bill_payment_pending`). Alerts operations. |
| `POST` | `/api/v1/integrations/mediassist/callbacks/notification-status`| `NotificationStatusCallback`| Flat JSON | HMAC-SHA256 Signature | `notification_id` | Updates notification status (`delivered`, `failed`) in notifications table. |
| `POST` | `/api/v1/integrations/mediassist/whatsapp-bookings` | Flat Booking Dict | Flat JSON | HMAC-SHA256 Signature | WhatsApp phone | Ingests WhatsApp booking, provisions headless patient, creates `bookings` and `samples`. |
| `GET` | `/api/v1/integrations/mediassist/patients/lookup` | Query: `phone` | Patient Metadata | HMAC-SHA256 (Query String) | Queried phone | Returns patient ID, name, existing bookings. Replay-protected via timestamp. |

### E. Payments & Financial Transactions (`app/routers/payments.py`)

| Method | Route Path | Request Schema | Response Schema | Auth Required | Tenant / User Scope | Side Effects / Database Writes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/payments/create-order` | `CreateOrderRequest` | `dict` | Bearer JWT (`patient`) | `patient_id=current_user['sub']` | Validates server booking price, creates Razorpay order, inserts row into `payments` table. |
| `POST` | `/api/payments/verify` | `VerifyPaymentRequest` | `dict` | Bearer JWT (`patient`) | `patient_id=current_user['sub']` | Validates HMAC signature, fetches Razorpay payment, updates `payments.status='captured'`, confirms booking. |
| `GET` | `/api/payments/my-transactions`| None | `dict` | Bearer JWT (`patient`) | `patient_id=current_user['sub']` | Returns patient billing history and receipts. |
| `GET` | `/api/payments/my-earnings` | None | `dict` | Bearer JWT (Provider) | `provider_id=current_user['sub']`| Returns provider earnings after 20% platform fee deduction. |

---

## 3. IDENTIFIED API ANOMALIES & CONTRACT RISKS

### Finding API-01: Absent Razorpay Webhook Endpoint
- **Location:** `app/routers/payments.py` vs `app/middleware/security.py` line 32.
- **Observed Behavior:** `/webhooks/razorpay` is declared in `SecurityMiddleware.SKIP_SANITIZE_PATHS`, but no router implements `POST /webhooks/razorpay`.
- **Impact:** Any client disconnection during post-payment redirect results in an orphaned transaction. The payment succeeds on Razorpay's ledger, but CallMedex remains in `created` status with no server-to-server webhook to reconcile it.

### Finding API-02: Public Tracking Gate Parameter Exposure
- **Location:** `app/routers/dispatch.py` (`get_public_guardian_track`).
- **Observed Behavior:** The tracking endpoint accepts a public token. While it scrubs patient full name and medical notes, it returns live provider GPS lat/lng and provider vehicle details. If tokens are leaked or brute-forced (mitigated by UUIDv4), provider physical location is exposed in real time.

### Finding API-03: City Supervisor Metric Masking
- **Location:** `app/routers/admin.py` lines 58–67.
- **Observed Behavior:** When a City Supervisor queries `GET /api/admin/metrics`, the handler returns `"N/A (City filter applied)"` for total bookings instead of performing a relational join with `processing_centers` or provider address.
