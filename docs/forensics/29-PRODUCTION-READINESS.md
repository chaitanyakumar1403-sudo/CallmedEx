# CallMedex Forensic Intelligence: Production Readiness Scorecard & Domain Audit

> **Analysis Scope**: Comprehensive 12-domain evaluation assessing operational maturity, clinical safety, security resilience, data integrity, and release readiness of CallMedex for high-volume healthcare production deployment.

---

## 1. Executive Readiness Matrix (12 Domains)

| # | Subsystem / Functional Domain | Production Status | Confidence Grade | Critical Gating Issues / Caveats |
| :-: | :--- | :--- | :---: | :--- |
| **01** | **Authentication & RBAC** | `READY WITH CAVEATS` | **B+** | Strong 12-role RBAC and JWT revocation; caveat: `mock_verification_warning` if `USE_MOCK_GOV_API` is left true. |
| **02** | **Booking & Marketplace** | `READY` | **A-** | Full test-first discovery, slot locking, transparent pricing, and partner lab catalog mapping. |
| **03** | **Universal Dispatch & Roster** | `READY WITH CAVEATS` | **B+** | 3-tier fan-out and roster passes work; **hard dependency on Celery Worker + Beat**; requires `GEOAPIFY_API_KEY` for GPS-less users. |
| **04** | **Specimen Custody Chain** | `READY` | **A** | Implemented 13-state FSM, barcode verification, tube derivation, centrifuge timing, duplicate payout prevention. |
| **05** | **Telemedicine & Consultations** | `READY WITH CAVEATS` | **B** | Daily.co token rooms work; **BLOCKER**: public unauthenticated `meet.jit.si` fallback must be disabled in production. |
| **06** | **Pharmacy & E-Prescriptions** | `READY` | **A-** | Real-time drug substitution, schedule drug restrictions, digital prescription signing, and generic cost savings calculator. |
| **07** | **Payments & Settlements** | `NOT READY (BLOCKER)` | **C** | **BLOCKER**: Missing server-side Razorpay webhook handler (`/webhooks/razorpay`). If user closes browser post-payment, booking drops. |
| **08** | **AI Clinical Engines** | `READY` | **A-** | Groq Llama 3.3-70b voice scribe, Gemini Vision OCR, human-in-the-loop clinical review gates. |
| **09** | **MediAssist & Connectors** | `READY WITH CAVEATS` | **B+** | Robust HMAC-SHA256 and 300s replay protection; caveat: hospital MocDoc sync depends on external MediAssist uptime. |
| **10** | **Database & Multi-Tenancy** | `READY WITH CAVEATS` | **B** | **CRITICAL CAVEAT**: PostgreSQL RLS is completely bypassed by `SUPABASE_SERVICE_KEY`; Python query scoping is the sole isolation barrier. |
| **11** | **Deployment & Infrastructure** | `READY WITH CAVEATS` | **B+** | Multi-container Docker Compose & Render IaC; caveat: active `nginx.conf` has SSL commented out (requires TLS ingress). |
| **12** | **Observability & Disaster Recovery**| `NOT READY (BLOCKER)` | **C+** | **BLOCKER**: No APM (Sentry), no distributed tracing, plain-text logs, Celery workers lose HTTP `request_id`. |

---

## 2. Deep-Dive Domain Scorecards

### Domain 01: Authentication & Access Control
- **Strengths**:
  - Fine-grained 12-role RBAC enforced at endpoint level.
  - JWT `token_version` claim provides immediate session invalidation across devices on password reset or account suspension.
  - DPDP Act 2023 compliant multi-step account deletion with active booking safety checks.
- **Vulnerabilities / Caveats**:
  - `USE_MOCK_GOV_API=true` auto-approves any medical license string $\ge 4$ characters.
  - Production bootstrap halts if `JWT_SECRET` is weak (`jwt_secret_warning`), which is a good safeguard.

### Domain 04: Specimen Custody & Lab Accessioning
- **Strengths**:
  - 13 distinct custodial states enforce strict forward-only progression (`ALLOWED_SAMPLE_TRANSITIONS`).
  - Barcode verification binds vacutainers to specific bookings at patient bedside.
  - Handover to processing center requires technician accessioning scan; rejects invalid or haemolysed samples without crediting phlebotomist wallet.
- **Readiness Verdict**: **ENTERPRISE GRADE**.

### Domain 07: Payments, Refunds & Wallet Ledgers
- **Strengths**:
  - Server-side price recalculation rejects tampering with client-provided amounts.
  - Phlebotomist payouts distinguish part-time per-tube commissions from full-time salaried staff.
- **Critical Blocker**:
  - **Absence of Inbound Razorpay Webhook**: Payments captured on Razorpay will not confirm bookings if the patient drops internet connection or closes mobile browser before the return redirect.

### Domain 10: Database Architecture & Tenant Isolation
- **Strengths**:
  - Comprehensive relational schema with 86 tables, partial unique indexes (`idx_bookings_unique_active_slot`), and audit trails.
- **Critical Risk**:
  - **Service Key RLS Bypass**: All SQL operations connect via `SUPABASE_SERVICE_KEY`. If a developer writes `supabase.table("patients").select("*").execute()` without a `.eq("organization_id", ...)` filter, all patient records across all healthcare organizations will be leaked in the response.

---

## 3. Production Release Gating Checklist

Before approving CallMedex for live commercial patient care, the following remediation tasks must be completed:

- [ ] **SEC-01 (Priority 1)**: Implement `POST /webhooks/razorpay` with signature verification (`X-Razorpay-Signature`) to guarantee asynchronous payment capture.
- [ ] **SEC-02 (Priority 1)**: Disable public `meet.jit.si` fallback in `telemedicine.py` when running in `APP_ENV=production`; fail closed with HTTP 503 if Daily.co is unavailable.
- [ ] **OPS-01 (Priority 1)**: Deploy Celery Worker and Celery Beat alongside the API web service; scheduled dispatch loops must not be left un-consumed.
- [ ] **SEC-03 (Priority 2)**: Enforce `USE_MOCK_GOV_API=false` in production and integrate live NMC/Pharmacy Council API keys.
- [ ] **OBS-01 (Priority 2)**: Integrate Sentry or Datadog APM for automated exception capture and error alerting.
- [ ] **TLS-01 (Priority 2)**: Enable SSL/TLS termination in Nginx with valid Let's Encrypt or Cloudflare certificates.
