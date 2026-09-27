# CallMedex Forensic Intelligence: Documentation Drift & Reality Matrix

> **Analysis Scope**: Forensic reconciliation comparing claims made across repository documentation (`CLAUDE.md`, `CALLMEDEX-LIQUID-HEALTH.md`, `docs/*.md`) against the ground truth of implemented Python, TypeScript, and SQL code.

---

## 1. Executive Drift Assessment

CallMedex has experienced significant architectural evolution across 411 commits. While high-level documentation describes the aspirational end-state, several foundational subsystems have shifted or remain partially implemented. 

### Reality Scorecard

| Domain | Documented Claim | Implemented Code Reality | Drift Classification |
| :--- | :--- | :--- | :--- |
| **WhatsApp Booking** | Direct Meta WhatsApp Cloud API integration with Graph API webhooks. | CallMedex has **zero Meta SDKs**. WhatsApp NLP is 100% offloaded to external MediAssist AI, calling CallMedex via signed REST endpoints. | **ARCHITECTURAL PIVOT** |
| **Hospital EHR (MocDoc)** | Backend runs headless Playwright browser scripts to automate hospital bookings. | Backend has **no Playwright/Selenium**. MocDoc scraping is executed externally by MediAssist; backend merely records the external connector status. | **EXTERNALIZED DELEGATION** |
| **Database Multi-Tenancy** | PostgreSQL Row-Level Security (RLS) policies isolate tenant and patient data at the DB engine. | `app/database.py` uses `SUPABASE_SERVICE_KEY`, which **completely bypasses PostgreSQL RLS**. Tenant isolation is enforced exclusively by Python application code. | **CRITICAL SECURITY DIVERGENCE** |
| **Payment Webhooks** | Server-to-server Razorpay webhooks (`/webhooks/razorpay`) process async payment capture. | `/webhooks/razorpay` exists **only as an exclusion string** in `SecurityMiddleware`. No actual router or controller handles this endpoint. | **MISSING IMPLEMENTATION** |
| **Government Doctor Registry** | Live API verification with National Medical Commission (NMC) and State Medical Councils. | `USE_MOCK_GOV_API=true` is the default. Any registration string $\ge 4$ characters is auto-approved with mock doctor credentials. | **MOCKED IN STAGING** |
| **ABDM / ABHA Integration** | End-to-end ABDM M1/M2/M3 compliance for health document exchange and ABHA creation. | Database schema exists (`abdm_records`), but service layer returns synthetic sandbox structures. No live NDHM gateway bridge exists. | **CONFIGURED / STUBBED** |
| **Telemedicine Video Security** | Secure, token-gated HIPAA/DISHA-compliant video rooms via Daily.co. | Daily.co is implemented, but if `DAILY_API_KEY` is missing, it falls back to public unauthenticated `meet.jit.si` rooms without passwords. | **FAIL-OPEN VULNERABILITY** |
| **Phlebotomist Dispatch** | AI-optimized dynamic routing with real-time turn-by-turn tracking. | Phlebotomist location updates are stored in Redis/DB; dispatch is a rule-based radius sweep (3km -> 6km -> 10km) with Celery Beat, not an ML routing engine. | **SPECIFICATION EXAGGERATION** |

---

## 2. Detailed Forensic Reconciliations

### 2.1 WhatsApp & Conversational AI
- **Documented in `CLAUDE.md` & `docs/`**: "Direct WhatsApp Cloud API webhook listener receives inbound patient messages and processes them through an internal dialog manager."
- **Code Ground Truth**:
  - `backend/requirements.txt` contains no WhatsApp or Meta SDKs.
  - `backend/app/routers/` contains no `/webhook/whatsapp` endpoint.
  - Inbound WhatsApp traffic is handled by `backend/app/routers/mediassist_inbound.py` at `/api/v1/integrations/mediassist/booking` via HMAC-SHA256 authenticated REST callbacks from MediAssist AI.

### 2.2 Hospital Connector Automation (MocDoc)
- **Documented**: "Connector engine uses Playwright to drive headless browser sessions into hospital EHRs like MocDoc to inject appointments."
- **Code Ground Truth**:
  - `backend/app/services/connectors/mocdoc.py` defines `ConnectorType.MOCDOC` and delegates execution to `MediAssistClient` via HTTP POST (`POST /api/v1/connectors/mocdoc/sync`).
  - Playwright exists solely in `frontend/package.json` as a dev dependency for web UI testing.

### 2.3 Database Tenant Isolation & RLS
- **Documented**: "Multi-tenancy is enforced at the database level using PostgreSQL Row Level Security policies based on `auth.uid()` and tenant claims."
- **Code Ground Truth**:
  - `backend/app/database.py`:
    ```python
    supabase: Client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_KEY  # <-- Bypasses all RLS policies
    )
    ```
  - While `database/rls_policies.sql` contains comprehensive RLS policy definitions, they are completely inactive for API requests because the backend connects using the superuser `service_role` key. Every query must explicitly filter by `patient_id`, `organization_id`, or `processing_center_id` in Python.

### 2.4 Razorpay Webhook Processing
- **Documented**: "Asynchronous payment confirmations are ingested via Razorpay webhooks to guarantee zero dropped bookings."
- **Code Ground Truth**:
  - `backend/app/middleware/security.py` line 32: `SKIP_SANITIZE_PATHS = {"/webhooks/razorpay", ...}`.
  - Grepping the entire backend codebase reveals **zero router endpoints** handling `POST /webhooks/razorpay`.
  - Payment confirmation relies entirely on the patient's browser successfully calling `POST /api/payments/verify` after the Razorpay checkout modal completes.

---

## 3. Recommended Actions for Technical Documentation Alignment

1. **Update Architecture Diagrams**: Remove direct Meta WhatsApp Cloud API and internal Playwright diagrams; replace with the MediAssist AI Integration Gateway.
2. **Clarify RLS Status**: Document that RLS is an application-level constraint in Python, not a Postgres-level constraint, alerting developers to never execute un-scoped `.select()` queries.
3. **Flag Payment Fallback**: Document the absence of server-side Razorpay webhook handlers and prioritize implementation before high-volume production launch.
