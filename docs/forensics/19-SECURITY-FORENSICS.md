# 19 — APPLICATION SECURITY & VULNERABILITY FORENSICS

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Forensic Application Security Review  
**Verification Level:** STATICALLY VERIFIED against source code AST and configuration matrices  

---

## 1. SECURITY VULNERABILITY DOSSIER

### FINDING SEC-01: Universal Row Level Security (RLS) Bypass via Service-Role Key
- **Finding ID:** `SEC-01`
- **Category:** Broken Object Level Authorization (BOLA / Multi-Tenancy Failure)
- **Severity:** **HIGH**
- **Confidence:** HIGH
- **Subsystem:** Data Access & Persistence
- **Affected File:** `backend/app/database.py` (lines 33–38)
- **Affected Symbol:** `get_supabase_client()`
- **Entry Point:** Any authenticated or unauthenticated endpoint executing database queries.
- **Execution Path:**
  FastAPI Router -> Domain Service -> `from app.database import supabase` -> PostgREST query executed with `SUPABASE_SERVICE_KEY`.
- **Observed Behavior:**
  PostgreSQL Row Level Security (RLS) is completely bypassed for 100% of backend database operations.
- **Root Cause:**
  Architecture uses a single shared client initialized with the privileged Supabase service-role secret.
- **Impact:**
  Database engine enforces zero tenant or user boundaries. If an engineer introduces a query omitting `.eq("user_id", current_user["sub"])`, data from all patients and clinics is returned.
- **Existing Mitigation:** Python application-level filtering (`.eq(...)`).
- **Missing Mitigation:** A scoped database client adopting PostgreSQL user JWT claims (`supabase.auth.set_auth(token)`).
- **Required Verification:** Audit every `.select()`, `.update()`, and `.delete()` across all 37 router files to confirm strict presence of user/tenant filters.

---

### FINDING SEC-02: Missing Server-Side Payment Webhook (Orphaned Charges)
- **Finding ID:** `SEC-02`
- **Category:** Financial Integrity / Business Logic Flaw
- **Severity:** **HIGH**
- **Confidence:** HIGH
- **Subsystem:** Payment Processing
- **Affected File:** `backend/app/routers/payments.py` vs `backend/app/middleware/security.py`
- **Affected Symbol:** `verify_payment` / Missing `/webhooks/razorpay`
- **Entry Point:** Razorpay payment checkout completion.
- **Attack / Failure Scenario:**
  1. Patient is debited ₹1,500 via UPI on Razorpay.
  2. Mobile browser crashes or loses internet connection before redirecting to `POST /api/payments/verify`.
  3. Razorpay's asynchronous webhook fires to CallMedex, but receives HTTP 404 (route does not exist).
  4. Payment remains in `created` status in CallMedex. Booking remains in `pending` and is never dispatched.
- **Root Cause:** Payment capture relies exclusively on client-side redirect.
- **Impact:** Patient financial loss without healthcare service delivery; high customer dispute rate.
- **Missing Mitigation:** Implementation of an authenticated `POST /api/payments/webhook` listener and periodic Celery reconciliation.

---

### FINDING SEC-03: Provider Verification Auto-Approval in Mock Mode
- **Finding ID:** `SEC-03`
- **Category:** Improper Authentication / Clinical Safety Flaw
- **Severity:** **HIGH (when misconfigured in Staging/Prod)**
- **Confidence:** HIGH
- **Subsystem:** Provider Onboarding
- **Affected File:** `backend/app/services/gov_registry.py` (lines 45–68)
- **Affected Symbol:** `GovRegistryService._mock_verify`
- **Entry Point:** `POST /api/verification/verify`
- **Observed Behavior:**
  When `USE_MOCK_GOV_API=true`, any medical license number or pharmacy drug license string $\ge 4$ characters (not containing `TEST` or `FAKE`) is marked `verified` with the National Medical Council.
- **Root Cause:** Test scaffolding deployed without hard production environment assertion.
- **Impact:** Fraudulent practitioners can gain verified clinical status on the platform.
- **Existing Mitigation:** `main.py` lifespan emits a critical banner if `USE_MOCK_GOV_API` is set.
- **Missing Mitigation:** Hard refusal to boot in `main.py` if `APP_ENV in ('production', 'staging') and USE_MOCK_GOV_API is True`.

---

### FINDING SEC-04: Unsigned Telephony Webhook Ingress
- **Finding ID:** `SEC-04`
- **Category:** Missing Cryptographic Authentication
- **Severity:** **MEDIUM**
- **Confidence:** HIGH
- **Subsystem:** Telephony & Communications
- **Affected File:** `backend/app/routers/communications.py` (line 250)
- **Affected Symbol:** `telephony_webhook`
- **Entry Point:** `POST /api/communications/webhook/telephony`
- **Observed Behavior:**
  Accepts raw unauthenticated JSON dictionaries. Does not check `X-Twilio-Signature` or `X-Exotel-Signature`.
- **Root Cause:** Provider callback was implemented as a mock/stub.
- **Impact:** An attacker on the internet can spoof call completion logs, falsify doctor-patient consultation records, or inject fabricated call durations.
- **Missing Mitigation:** HMAC signature verification matching Twilio / Exotel provider secret tokens.

---

### FINDING SEC-05: Unauthenticated Jitsi Fallback for Telemedicine
- **Finding ID:** `SEC-05`
- **Category:** Information Disclosure / Unauthenticated Access
- **Severity:** **MEDIUM**
- **Confidence:** HIGH
- **Subsystem:** Telemedicine
- **Affected File:** `backend/app/services/telemedicine.py` (lines 85–102)
- **Affected Symbol:** `create_consultation_room`
- **Observed Behavior:**
  When `DAILY_API_KEY` is not set, the service falls back to `https://meet.jit.si/callmedex-{uuid}`.
- **Root Cause:** Local development fallback used in production code paths.
- **Impact:** Public Jitsi rooms have no token gates or access controls. Anyone guessing or intercepting the room URL can enter a private clinical doctor-patient video consultation.
- **Missing Mitigation:** Telemedicine must fail closed with an explicit 503 error if clinical encrypted WebRTC credentials (`DAILY_API_KEY`) are missing.
