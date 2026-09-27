# CallMedex Forensic Intelligence: Comprehensive Risk Registry & Threat Catalog

> **Analysis Scope**: Exhaustive risk registry detailing all identified vulnerabilities, architectural hazards, clinical risks, and operational failure points discovered during the forensic audit of the CallMedex repository.

---

## 1. Risk Priority Ranking

| Risk ID | Risk Category | Severity | Likelihood | Technical Title | Primary Affected File |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **SEC-01** | Security / Tenant Isolation | **CRITICAL** | High | Supabase Service-Role Key RLS Bypass | `backend/app/database.py` |
| **PAY-01** | Financial / Data Loss | **HIGH** | High | Missing Inbound Razorpay Webhook Handler | `backend/app/middleware/security.py` |
| **CLIN-01**| Clinical Privacy / DISHA | **HIGH** | Medium | Unauthenticated Public Jitsi Telemedicine Fallback | `backend/app/routers/telemedicine.py` |
| **SEC-02** | Fraud / Compliance | **HIGH** | High | Mock Government Registry Auto-Approval in Staging/Prod | `backend/app/services/gov_registry.py` |
| **OPS-01** | Operations / Dispatch | **HIGH** | Medium | Celery Worker Failure Stalls Home Collection Pipeline | `backend/app/workers/tasks/` |
| **SEC-03** | Telephony / Spoofing | **MEDIUM** | Medium | Unsigned Telephony Inbound Webhook | `backend/app/routers/communications.py` |
| **DATA-01**| Data Integrity / PostgREST | **MEDIUM** | High | Lack of Atomic Multi-Table SQL Transactions via REST | `backend/app/services/bookings.py` |
| **CLIN-02**| Clinical Safety / Diagnostics| **MEDIUM** | Low | Silent Sample Omission on Unmatched Catalog Tests | `backend/app/services/samples.py` |
| **SEC-04** | Supply Chain / RCE | **MEDIUM** | Low | Unpinned `Pillow` Dependency in Production Manifest | `backend/requirements.txt` |
| **OBS-01** | Observability / Incident Mgt| **MEDIUM** | High | Trace ID Disconnect Across Celery Async Tasks | `backend/app/middleware/security.py` |

---

## 2. Exhaustive Risk Breakdown & Remediation Guidance

### SEC-01: Supabase Service-Role Key RLS Bypass
- **Severity**: **CRITICAL** | **Category**: Security / Multi-Tenancy
- **Root Cause**: `backend/app/database.py` imports `settings.SUPABASE_SERVICE_KEY` and passes it to `create_client()`.
- **Failure Scenario**: The service-role key is a Postgres superuser credential that automatically bypasses all PostgreSQL Row Level Security (RLS) policies (`database/rls_policies.sql`). If a developer implements a new endpoint and queries `.table("patients").select("*")` without an explicit `.eq("organization_id", ...)` filter, the database will return records belonging to ALL healthcare organizations.
- **Blast Radius**: Cross-tenant data leaks; unauthorized access to patient PHI/PII across independent hospitals and clinics.
- **Remediation**:
  1. Enforce automated CI linting to mandate tenant filtering on all PostgREST select/update/delete calls.
  2. Implement an authenticated user client context that passes the user's JWT to Supabase for tenant-sensitive tables.

---

### PAY-01: Missing Inbound Razorpay Webhook Handler
- **Severity**: **HIGH** | **Category**: Financial & Booking Integrity
- **Root Cause**: `/webhooks/razorpay` is defined in `SKIP_SANITIZE_PATHS` in `backend/app/middleware/security.py`, but **no corresponding router or controller exists** in `backend/app/routers/`.
- **Failure Scenario**: A patient pays ₹1,500 for a home blood collection via UPI on Razorpay. The bank debits the patient's account and Razorpay captures the payment. Before the browser redirects back to the CallMedex success page, the patient's mobile phone drops network connection or the browser tab crashes. Because CallMedex has no webhook endpoint to receive Razorpay's asynchronous `payment.captured` event, the booking remains in `pending_payment` status and the phlebotomist is never dispatched.
- **Blast Radius**: Dropped bookings, patient frustration, customer support chargebacks, revenue reconciliation discrepancies.
- **Remediation**: Create `backend/app/routers/webhooks_payment.py` exposing `POST /webhooks/razorpay`, validating `X-Razorpay-Signature`, and confirming bookings asynchronously.

---

### CLIN-01: Unauthenticated Public Jitsi Telemedicine Fallback
- **Severity**: **HIGH** | **Category**: Clinical Privacy & Healthcare Compliance
- **Root Cause**: In `backend/app/routers/telemedicine.py`, when `DAILY_API_KEY` is not configured, the room generation logic falls back to:
  ```python
  room_url = f"https://meet.jit.si/callmedex-{consultation_id}"
  ```
- **Failure Scenario**: Anyone on the public internet who guesses or calculates `callmedex-{consultation_id}` can join the video call without a password, token, or authentication, eavesdropping on private doctor-patient telemedicine consultations.
- **Blast Radius**: Severe breach of DISHA / HIPAA / Telemedicine Practice Guidelines of India (2020).
- **Remediation**: In production (`APP_ENV=production`), immediately raise HTTP 503 Service Unavailable if Daily.co credentials are absent. Never default to unauthenticated public rooms.

---

### SEC-02: Mock Government Registry Auto-Approval in Staging/Prod
- **Severity**: **HIGH** | **Category**: Regulatory Compliance & Fraud Prevention
- **Root Cause**: `backend/app/services/gov_registry.py` checks `if settings.USE_MOCK_GOV_API: return MockDoctorVerification(...)`.
- **Failure Scenario**: A malicious actor registers as an MD Cardiologist or licensed pharmacist using a fictitious 4-digit registration number. If `USE_MOCK_GOV_API=true` is enabled on the server, the system auto-approves the registration, allowing unqualified individuals to write digital prescriptions and review diagnostic tests.
- **Blast Radius**: Illegal medical practice, patient harm, corporate criminal liability under Indian Medical Council Act.
- **Remediation**: Add an assertion in `lifespan` startup that refuses to boot in `production` if `USE_MOCK_GOV_API` is set to `true`.

---

### OPS-01: Celery Worker Failure Stalls Home Collection Pipeline
- **Severity**: **HIGH** | **Category**: Operational Reliability
- **Root Cause**: The 5-minute dispatch sweep (`trigger_dispatch_for_upcoming_bookings`), advance daily roster pass (`run_advance_roster_for_all_centres`), and offer expiration loops run exclusively in Celery Beat.
- **Failure Scenario**: If the `callmedex-celery-worker` container crashes due to an out-of-memory error or network timeout, the main API web service continues running and accepting patient bookings, but no phlebotomists will ever be dispatched, and pending offers will never expire.
- **Blast Radius**: Complete operational freeze of home healthcare logistics without raising a 500 error on the customer-facing frontend.
- **Remediation**: Implement container restart policies (`restart: always`), memory headroom monitoring, and a dead-man's-snitch heartbeat alerting operations if Celery Beat ticks are missed.
