# CallMedex Forensic Intelligence: Agent & Engineer Handoff Manual

> **Target Audience**: Future AI Agents (Antigravity, Claude Code), Senior Software Engineers, Security Auditors, and Production Incident Responders taking over the CallMedex repository.
> **Repository Baseline**: Commit `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736` on branch `main`.

---

## 1. Fast Orientation: "START HERE"

Welcome to CallMedex. CallMedex is **India's AI-native healthcare orchestration platform**, coordinating diagnostic lab home collections, hospital walk-in outpatient consultations, digital pharmacies, home nursing, and telemedicine.

Before you write any code, run any command, or make any architectural assertion, memorize these **5 Ground Truths**:

1. **NO DIRECT SQL WIRE PROTOCOL**: Backend does not use `psycopg2` or `asyncpg`. All database interactions travel via HTTP/REST through `supabase-py` (`postgrest-py`).
2. **DATABASE RLS IS BYPASSED**: `backend/app/database.py` uses `SUPABASE_SERVICE_KEY`. PostgreSQL RLS policies **do not protect tenant data**. YOU MUST filter by `patient_id`, `organization_id`, or `processing_center_id` in every single Python query.
3. **NO WHATSAPP OR MOCDOC PLAYWRIGHT IN BACKEND**: Direct Meta WhatsApp APIs and hospital browser scraping were delegated to **MediAssist AI**. The backend communicates with MediAssist via HMAC-SHA256 authenticated REST endpoints (`/api/v1/integrations/mediassist`).
4. **CELERY WORKER & BEAT ARE MANDATORY**: Background dispatches, appointment reminders, and phlebotomist offer timeouts run in Celery Beat. If you deploy only the web API without Celery, dispatches silently stop working.
5. **MISSING RAZORPAY WEBHOOK**: There is currently no server-side handler for Razorpay webhooks. Payments are verified synchronously by the client.

---

## 2. Authoritative Core Files Index

If you need to understand or modify a subsystem, start at these exact files:

| Subsystem / Function | Primary Authoritative File | Key Interfaces / Exports |
| :--- | :--- | :--- |
| **API Entry & Middleware** | `backend/app/main.py` | FastAPI application, middleware pipeline, lifespan startup. |
| **Database Connection** | `backend/app/database.py` | `supabase` client instance (service key). |
| **Configuration & Secrets** | `backend/app/config.py` | `Settings` class, environment validation gates. |
| **Auth, JWT & RBAC** | `backend/app/middleware/auth.py` | `get_current_user`, `require_role`, token decoding. |
| **Universal Dispatch** | `backend/app/services/dispatch_engine.py` | `UniversalDispatchEngine` (100 KB core matching algorithm). |
| **Specimen Custody Chain** | `backend/app/services/samples.py` | 13-state sample FSM, barcode binding, lab accessioning. |
| **Wallet & Economics** | `backend/app/services/wallet.py` | `WalletService`, phlebotomist per-tube & salary payouts. |
| **MediAssist Integration** | `backend/app/routers/mediassist_inbound.py`| Inbound HMAC-authenticated callback endpoints. |
| **Background Scheduler** | `backend/app/workers/celery_app.py` | Celery configuration, Redis broker URL, `beat_schedule`. |
| **Web Frontend Routes** | `frontend/src/app/(app)/` | Next.js App Router dashboards, booking flows, tracking. |
| **Mobile App Navigation** | `mobile/app/` | Expo Router screens, camera barcode scanner, geolocation. |

---

## 3. Rapid Incident Response & Debugging Matrix

| Symptom / Incident | Probable Root Cause | Immediate Verification Step | Quick Fix / Workaround |
| :--- | :--- | :--- | :--- |
| **Dashboard fails with HTTP 400 on preflight** | CORS origin mismatch. `FRONTEND_URL` has trailing slash or missing protocol. | Check backend startup log line `CORS allowed origins: [...]`. | Ensure `FRONTEND_URL` exactly matches browser origin without trailing slash. |
| **Home collection bookings stuck in "requested"** | Celery Beat or Worker container is dead; dispatch sweeps not running. | Run `docker ps` or check Render worker service logs. | Restart `celery-worker` and `celery-beat` containers. |
| **Phlebotomist cannot scan barcode at patient home** | Barcode string already bound to another active sample, or invalid format. | Query `samples` table for `barcode_id = '<scanned_value>'`. | Clear corrupted barcode or reprint label via processing center. |
| **Telemedicine video call fails to load** | `DAILY_API_KEY` missing or Daily.co token generation failed. | Check backend logs for `Daily.co room creation failed`. | Add valid `DAILY_API_KEY` in environment; verify Daily.co quota. |
| **Inbound MediAssist webhook rejected with 401** | HMAC signature mismatch or clock drift > 300s. | Check server system time against UTC; verify `MEDIASSIST_HMAC_SECRET`. | Resync NTP clock; ensure raw request body was not modified by middleware. |
| **Patient paid on Razorpay but booking not confirmed** | Patient closed browser before redirect; missing webhook handler. | Search Razorpay dashboard for payment ID; check booking status. | Manually call `/api/payments/verify` with payment ID or update booking in DB. |

---

## 4. Key CLI Commands & Workflows

### 4.1 Running Local Backend & Testing
```powershell
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Run API server locally
uvicorn app.main:app --reload --port 8000 --app-dir backend

# Run entire backend test suite
pytest backend/tests/ -v

# Run a specific test suite
pytest backend/tests/test_sample_lifecycle.py -v
```

### 4.2 Running Full Containerized Stack
```powershell
# Start all 5 services (Backend, Celery Worker, Celery Beat, Redis, Nginx)
docker compose up -d

# View Celery worker task execution logs
docker compose logs -f celery-worker

# Check Redis connection
docker compose exec redis redis-cli ping
```

### 4.3 Running Web Frontend
```powershell
cd frontend
npm install
npm run dev      # Local Next.js dev server on :3000
npm run lint:ui  # Run UI design & accessibility linter
npm run test:unit# Run unit tests
```

---

## 5. Master Forensic Document Directory

For deep-dive technical inquiries, refer directly to the indexed documents in `docs/forensics/`:

- `00-FORENSIC-MANIFEST.md`: Baseline metadata and document catalog.
- `01-REPOSITORY-CURRENT-STATE.md`: Real-world status of all 12 domains.
- `02-ARCHITECTURE.md`: Complete topology, middleware order, data flows.
- `03-COMPONENT-MAP.md`: Catalog of all 37 routers and 48 services.
- `04-END-TO-END-FLOWS.md`: Traces for all 7 primary patient/provider user journeys.
- `05-API-FORENSICS.md`: 260+ endpoints, schemas, and parameter gates.
- `06-FRONTEND-FORENSICS.md`: Next.js 16 App Router & Expo 52 client audit.
- `07-DATABASE-FORENSICS.md`: 86 tables, indexes, relationships, and constraints.
- `08-RLS-AND-MULTI-TENANCY.md`: Deep-dive into Service Key bypass and tenant isolation.
- `09-AUTHORIZATION-FORENSICS.md`: 12 roles, JWT claims, biometric challenge/response.
- `10-WHATSAPP-FORENSICS.md`: MediAssist AI gateway and signature architecture.
- `11-AI-AND-AGENT-FORENSICS.md`: Vision OCR, Groq Voice Scribe, human-in-the-loop.
- `12-PAYMENT-FORENSICS.md`: Razorpay, 80/20 split, wallet transactions.
- `13-CONNECTOR-FORENSICS.md`: Hospital EHRs, MocDoc, in-memory PDF generation.
- `14-BACKGROUND-JOBS.md`: Celery Beat crons and background retry workers.
- `15-WEBHOOK-FORENSICS.md`: Inbound webhooks, HMAC checks, raw-body bypass.
- `16-STATE-MACHINES.md`: 13-state sample custody, booking, and dispatch FSMs.
- `17-FAILURE-PATHS.md`: Circuit breakers, fail-closed vs fail-open classifications.
- `18-CONCURRENCY-AND-IDEMPOTENCY.md`: PostgREST transaction risks and partial indexes.
- `19-SECURITY-FORENSICS.md`: Formatted security findings (SEC-01 through SEC-05).
- `20-HEALTHCARE-DATA-FLOWS.md`: PHI/PII mapping, DPDP Act 2023, ABDM status.
- `21-CONFIGURATION.md`: Environment variable dictionary and boot guards.
- `22-DEPENDENCIES.md`: Python, Node, and Expo dependency trees and gaps.
- `23-DEPLOYMENT.md`: Docker Compose, Render IaC, and Nginx edge proxy.
- `24-OBSERVABILITY.md`: `X-Request-ID`, `ops_alerts`, and logging gaps.
- `25-TEST-COVERAGE.md`: 74 backend test suites, `FakeQuery` mocking analysis.
- `26-GIT-HISTORY-ANALYSIS.md`: Evolution across 411 commits from Phase 1 to Session 04.
- `27-DOCUMENTATION-DRIFT.md`: Reconciliation of documentation claims vs actual code.
- `28-DEAD-CODE-AND-DUPLICATION.md`: Inventory of dead scripts, unused services, and aliases.
- `29-PRODUCTION-READINESS.md`: 12-domain release scorecards and blockers.
- `30-KNOWN-RISKS.md`: Ranked threat and risk catalog with remediation steps.
- `31-UNKNOWN-AREAS.md`: Catalog of runtime unknowns requiring live credentials/hardware.
- `32-AGENT-HANDOFF.md`: This orientation manual and operational guide.
