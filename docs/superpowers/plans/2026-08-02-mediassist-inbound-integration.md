# MediAssist AI Inbound Integration + Report Pipeline Rewire — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the CallMedex ↔ MediAssist AI integration. Two things are still open from the architecture mandate ("CallMedex SHALL NEVER implement... OCR... AI Summary... WhatsApp [messaging]"):

1. **Inbound side is missing.** CallMedex built an outbound client (`app/integrations/mediassist_client.py`) that calls MediAssist, but nothing exists yet for MediAssist to call *into* CallMedex — no callback routes, no inbound request verification, no `report_jobs` table.
2. **The architecture violation itself is untouched.** `backend/app/routers/ai_reports.py` + `backend/app/services/ai_reports.py` still do lab-report OCR (PyMuPDF) and AI interpretation (Groq) **in-process**, synchronously, inside the HTTP request. This is the exact thing MediAssist AI was supposed to own.

**Scope note — `ai_ocr.py` is explicitly OUT of scope.** `backend/app/services/ai_ocr.py` does Gemini-Vision OCR for *provider credential verification* (doctor/pharmacy license images), which is CallMedex's own "AI-Automated Verification Pipeline" per its architecture doc, not lab-report interpretation. Do not touch it in this plan.

**Architecture:** One new SQL migration (`report_jobs`, `mediassist_inbound_requests`, plus one added column on the existing `ai_report_analyses` table). A new inbound-auth helper module verifying MediAssist's bearer token + HMAC signature + idempotency, mirroring the signing scheme the outbound client (`mediassist_client.py`) already uses. A new inbound router MediAssist calls. The existing `/api/reports/analyze` endpoint rewired from a synchronous Groq/PyMuPDF call to an async `report_jobs` submission via `mediassist_client.submit_report_job()`.

**Tech Stack:** Python 3 / FastAPI, Supabase (Postgres) via `app.database.supabase`, pytest with `asyncio_mode = auto`, httpx (`httpx.MockTransport` for client-side tests, FastAPI `TestClient` for route tests).

**Contract reference:** `docs/integrations/mediassist-ai/mediassist-ai.openapi.yaml` (MediAssist's API — already built against) and `docs/integrations/mediassist-ai/callmedex-integration.openapi.yaml` (CallMedex's inbound API — this plan implements it; Task 1 extends its `ReportDeliveredCallback` schema).

## Global Constraints

- **Migration file:** one new file, `database/task2_mediassist_integration.sql`. Follow the house style already used in `database/task1_processing_center_foundation.sql`: wrapped in `BEGIN;` / `COMMIT;`, `IF NOT EXISTS` on every new object, `SET search_path = ''` on any new function, an explicit deny-all RLS policy on every new table (the FastAPI backend uses the Supabase **service_role** key which bypasses RLS anyway — see `backend/app/database.py` — so RLS here is defense-in-depth, not the enforcement boundary), and `NOTIFY pgrst, 'reload schema';` as the final statement after `COMMIT`.
- **Inbound request verification is shared, not duplicated per route.** One module, one dependency, one idempotency-cache pair of functions (see Task 2) — every inbound MediAssist-facing route uses it identically.
- **Signing scheme must match the existing outbound client exactly**, so a symmetric shared secret works both directions: `HMAC-SHA256(f"{timestamp}.".encode() + raw_body_bytes, secret).hexdigest()`, prefixed `sha256=` in the `X-Signature` header, timestamp in `X-Timestamp` as Unix epoch seconds. This is implemented in `app/integrations/mediassist_client.py::MediAssistClient._sign` — read it before implementing verification, do not re-derive the scheme independently.
- **Reject stale requests:** `X-Timestamp` older than 300 seconds (or in the future by more than 300 seconds) is rejected with 401, matching the replay-window described in `docs/integrations/mediassist-ai/README.md`.
- **Idempotency is cache-and-replay, not reject-on-repeat.** A redelivered `X-Idempotency-Key` must return the exact same response the first delivery produced (status code + body), not a fresh re-execution and not an error. This matches `docs/integrations/mediassist-ai/callmedex-integration.openapi.yaml`'s "safe to redeliver" contract.
- **Never fail a request silently.** Every new route logs via `logger` and writes an audit entry via `AuditService.log` (`app/services/audit.py`) for state-changing actions (report status changes, booking creation). Read-only lookups (`patients/lookup`, idempotency-cache hits) do not need an audit entry.
- **Tests** live in `backend/tests/`, run from `backend/` via `python -m pytest tests/<file> -q`. Reuse the existing `httpx.MockTransport` pattern from `backend/tests/test_mediassist_client.py` for anything mocking MediAssist; use FastAPI's `TestClient` (already a transitive dependency via `fastapi`/`starlette`) for route-level tests.
- **No TODO, no mock code, no placeholder implementation.** If a piece of information genuinely doesn't exist yet (e.g., a real MediAssist base URL), that's a config value with a documented blank default — not a stubbed function body.
- **`ai_report_analyses` stays the read model for `/api/reports/history`.** Don't introduce a second table for the same data — the `report-delivered` callback upserts into `ai_report_analyses` (linked via a new `report_job_id` column), and `/history` keeps reading from it.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `database/task2_mediassist_integration.sql` | `report_jobs`, `mediassist_inbound_requests` tables; `ai_report_analyses.report_job_id` column |
| `backend/app/middleware/mediassist_auth.py` | Inbound bearer+HMAC+timestamp verification dependency; idempotency cache read/write helpers |
| `backend/app/routers/mediassist_inbound.py` | All 7 inbound endpoints MediAssist calls into CallMedex |
| `backend/tests/test_mediassist_auth.py` | Unit tests for the verification dependency + idempotency cache |
| `backend/tests/test_mediassist_inbound_routes.py` | Route-level tests (signature/idempotency/happy-path per endpoint) |
| `backend/tests/test_ai_reports_job_submission.py` | Tests for the rewired `/api/reports/analyze` + `/api/reports/jobs/{id}` |

**Modified:**

| File | Change |
|---|---|
| `backend/app/config.py` | Add `MEDIASSIST_INBOUND_BEARER_TOKEN` |
| `backend/app/main.py` | Register `mediassist_inbound.router` |
| `backend/app/services/audit.py` | Add `AuditActions` constants for report-job and whatsapp-booking events |
| `backend/app/services/storage.py` | Generalize upload/signed-url to accept a bucket name (or add report-doc-specific pair) — needed so `/api/reports/analyze` can store the source document CallMedex hands MediAssist a signed URL for |
| `backend/app/routers/ai_reports.py` | `/analyze` submits a report job instead of analyzing synchronously; new `GET /jobs/{report_job_id}` |
| `backend/app/services/ai_reports.py` | Delete the in-process Groq/PyMuPDF `AIReportService` entirely |
| `docs/integrations/mediassist-ai/callmedex-integration.openapi.yaml` | Extend `ReportDeliveredCallback` to carry the structured analysis payload |
| `docs/integrations/mediassist-ai/README.md` | Note the analysis-payload addition in the report-delivered callback's description if the file's flow diagram needs updating (only if genuinely stale — don't touch otherwise) |

---

## Task 1: Migration, config, and contract extension

**Files:**
- Create: `database/task2_mediassist_integration.sql`
- Modify: `backend/app/config.py`, `docs/integrations/mediassist-ai/callmedex-integration.openapi.yaml`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: `report_jobs` table, `mediassist_inbound_requests` table, `ai_report_analyses.report_job_id` column, `settings.MEDIASSIST_INBOUND_BEARER_TOKEN`, extended `ReportDeliveredCallback` schema. Every later task in this plan depends on this one.

**`report_jobs` table columns:**
- `id UUID PRIMARY KEY` (the `report_job_id` CallMedex generates and sends to MediAssist in `POST /report-jobs`)
- `patient_id UUID NOT NULL`
- `booking_id UUID NULL`, `sample_id UUID NULL`, `processing_center_id UUID NULL` (nullable — not every report job originates from a booking/sample)
- `source_type TEXT NOT NULL` — `CHECK (source_type IN ('lab_report','prescription','consultation_summary'))`
- `status TEXT NOT NULL DEFAULT 'queued'` — `CHECK (status IN ('queued','processing','delivered','failed','expired'))`
- `failure_reason TEXT NULL`
- `source_document_path TEXT NULL` (the Supabase Storage object path, not a public URL)
- `correlation_id UUID NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

**`mediassist_inbound_requests` table columns** (idempotency cache for every inbound MediAssist call):
- `idempotency_key TEXT PRIMARY KEY`
- `endpoint TEXT NOT NULL`
- `status_code INT NOT NULL`
- `response_body JSONB NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

**`ai_report_analyses` change:** `ALTER TABLE ai_report_analyses ADD COLUMN IF NOT EXISTS report_job_id UUID NULL REFERENCES report_jobs(id);` — nullable because rows created before this migration have no job.

**Config addition (`backend/app/config.py`, alongside the existing `MEDIASSIST_*` block):**
```python
MEDIASSIST_INBOUND_BEARER_TOKEN: str = os.getenv("MEDIASSIST_INBOUND_BEARER_TOKEN", "")
```
This is the token CallMedex expects MediAssist to present when calling *into* CallMedex — distinct from `MEDIASSIST_BEARER_TOKEN`, which is what CallMedex presents when calling *out*. Reuse the existing `MEDIASSIST_HMAC_SECRET` for verifying inbound signatures too (one shared secret, both directions — this is a deliberate scope decision to avoid building a full credential-issuance/rotation system that nothing in this plan requires; note it as a one-line comment above the new setting).

**OpenAPI contract extension (`docs/integrations/mediassist-ai/callmedex-integration.openapi.yaml`):** The `ReportDeliveredCallback` schema currently only carries `delivered_channel` and `message_id`. CallMedex's own dashboard/doctor-review flow (its architecture doc's "AI Report Interpretation Layer") needs the actual structured analysis back, not just a delivery confirmation — MediAssist sends the WhatsApp message *and* hands CallMedex the analysis to persist. Add these required fields to `ReportDeliveredCallback`:
```yaml
    ReportDeliveredCallback:
      allOf:
        - $ref: '#/components/schemas/ReportCallback'
        - type: object
          required: [delivered_channel, analysis]
          properties:
            delivered_channel:
              type: string
              enum: [whatsapp]
            message_id:
              type: string
              nullable: true
            analysis:
              type: object
              required: [plain_language_summary, doctor_clinical_summary, abnormal_flags]
              properties:
                plain_language_summary:
                  type: string
                doctor_clinical_summary:
                  type: string
                health_score:
                  type: integer
                  nullable: true
                abnormal_flags:
                  type: array
                  items:
                    type: object
                    properties:
                      marker: { type: string }
                      value: { type: string }
                      status: { type: string, enum: [normal, high, low, critical] }
                      reference_range: { type: string }
                recommendations:
                  type: array
                  items: { type: string }
```
Match this shape to the JSON keys already produced by the (soon to be deleted) `AIReportService._fallback_extracted_analysis`/`_parse_response` in `backend/app/services/ai_reports.py` — read that file first, since Task 4 needs the callback payload and the deleted-service's old output shape to line up so `ai_report_analyses` rows look the same before and after this migration.

**Verify:** Migration applies cleanly re-run top to bottom (it's idempotent per house style); `backend/app/config.py` still imports with no errors; the YAML parses (`python -c "import yaml; yaml.safe_load(open('docs/integrations/mediassist-ai/callmedex-integration.openapi.yaml'))"`).

---

## Task 2: Inbound request verification + idempotency cache

**Files:**
- Create: `backend/app/middleware/mediassist_auth.py`
- Create: `backend/tests/test_mediassist_auth.py`

**Interfaces:**
- Consumes: `report_jobs`/`mediassist_inbound_requests` migration from Task 1 (only needs `mediassist_inbound_requests`), `settings.MEDIASSIST_INBOUND_BEARER_TOKEN` and `settings.MEDIASSIST_HMAC_SECRET` from `backend/app/config.py`.
- Produces: `verify_mediassist_signature` (FastAPI dependency), `get_cached_idempotent_response`, `store_idempotent_response` — consumed by Task 3's router.

**Read first:** `backend/app/integrations/mediassist_client.py`'s `MediAssistClient._sign` method (the exact HMAC scheme to mirror) and `backend/app/middleware/pc_auth.py` (this repo's existing pattern for a custom auth dependency, for style — e.g. how it raises `HTTPException`, how it's typed).

**Implement:**

```python
async def verify_mediassist_signature(request: Request) -> None:
    """FastAPI dependency: verifies Authorization bearer token, X-Timestamp
    freshness, and X-Signature HMAC over the raw request body. Raises
    HTTPException(401) on any failure. Raises nothing (returns None) on
    success. Route handlers still need to check X-Idempotency-Key
    themselves via get_cached_idempotent_response/store_idempotent_response
    — this dependency only proves the request is authentically from
    MediAssist, it does not deduplicate."""
```

- Bearer check: `Authorization: Bearer <token>` header, `hmac.compare_digest(token, settings.MEDIASSIST_INBOUND_BEARER_TOKEN)`. Missing header, malformed header, or `MEDIASSIST_INBOUND_BEARER_TOKEN` unset → 401.
- Timestamp check: `X-Timestamp` header must parse as an int; reject (401) if unparseable or if `abs(now - timestamp) > 300` seconds.
- Signature check: read the raw body via `body = await request.body()` (Starlette caches this — the route handler's own Pydantic body parsing afterward reads the same cached bytes, it does not re-hit the network stream — you do not need to do anything special to make both reads work). Recompute `hmac.new(settings.MEDIASSIST_HMAC_SECRET.encode(), f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()`, compare against the `X-Signature` header (format `sha256=<hex>`, strip the prefix) via `hmac.compare_digest`. Mismatch or missing header → 401.

```python
def get_cached_idempotent_response(idempotency_key: str) -> Optional[dict]:
    """Returns {"status_code": int, "body": dict} if this key was already
    processed, else None. Reads mediassist_inbound_requests."""

def store_idempotent_response(idempotency_key: str, endpoint: str, status_code: int, body: dict) -> None:
    """Persists the response for future replays of this key. Insert, not
    upsert — a second call with the same key racing the first is expected
    to occasionally raise a unique-constraint error; catch and log it,
    don't crash (the first writer's cached response is authoritative)."""
```

Both are plain functions using `app.database.supabase` directly (same style as `AuditService.log`), not FastAPI dependencies — Task 3's route handlers call them explicitly since caching happens *after* the route computes its response, which a `Depends()` can't do on its own.

**Tests (`backend/tests/test_mediassist_auth.py`):** Build a minimal FastAPI app with one test route wrapping `verify_mediassist_signature` as a dependency, and a real `TestClient`, to test: valid signature passes; wrong bearer token → 401; tampered body → 401; timestamp 400s old → 401; timestamp 400s in the future → 401. Test the idempotency functions directly against a fake/real Supabase test double — check how `backend/tests/test_sample_lifecycle.py`'s `FakeSupabase` is built and reuse that pattern rather than inventing a new fake.

**Verify:** `cd backend && python -m pytest tests/test_mediassist_auth.py -q` — all green.

---

## Task 3: Inbound routes

**Files:**
- Create: `backend/app/routers/mediassist_inbound.py`
- Modify: `backend/app/main.py` (register the router), `backend/app/services/audit.py` (new `AuditActions` constants)
- Create: `backend/tests/test_mediassist_inbound_routes.py`

**Interfaces:**
- Consumes: Task 1's tables + extended contract, Task 2's `verify_mediassist_signature`/`get_cached_idempotent_response`/`store_idempotent_response`.
- Produces: the 7 routes from `docs/integrations/mediassist-ai/callmedex-integration.openapi.yaml`, registered at prefix `/api/v1/integrations/mediassist`.

**Read first:** `docs/integrations/mediassist-ai/callmedex-integration.openapi.yaml` in full — it is the exact request/response contract for every route below, including the just-extended `ReportDeliveredCallback`. Also read `backend/app/services/audit.py` for the `AuditService.log`/`AuditActions` pattern.

**Routes** (every one carries `dependencies=[Depends(verify_mediassist_signature)]`, and every handler's first two lines are the idempotency-cache check/short-circuit — write one small local helper in this file, e.g. `def _idempotent_or(idem_key, compute_fn)`, to avoid repeating the check/store boilerplate seven times, but keep it simple: it's fine for this helper to just be `cached = get_cached_idempotent_response(key); if cached: return JSONResponse(...)`, no need for a decorator):

1. `POST /callbacks/report-processing` — body: `ReportCallback` (`report_job_id`, `occurred_at`). Update `report_jobs.status = 'processing'` for that id. 404 if `report_job_id` doesn't exist. Audit: `AuditActions.MEDIASSIST_REPORT_JOB_PROCESSING`.
2. `POST /callbacks/report-delivered` — body: extended `ReportDeliveredCallback` (`report_job_id`, `occurred_at`, `delivered_channel`, `message_id`, `analysis`). Update `report_jobs.status = 'delivered'`; upsert `ai_report_analyses` (new row if none exists for this `report_job_id`, else update) with `patient_id` from the `report_jobs` row, `plain_language_summary`, `doctor_clinical_summary`, `abnormal_flags`, `raw_report_url` left as whatever Task 4 set when the job was created. Audit: `AuditActions.MEDIASSIST_REPORT_JOB_DELIVERED`.
3. `POST /callbacks/report-failed` — body: `ReportFailedCallback` (`report_job_id`, `occurred_at`, `failure_reason`, `details`). Update `report_jobs.status = 'failed'`, `failure_reason`. Audit: `AuditActions.MEDIASSIST_REPORT_JOB_FAILED`.
4. `POST /callbacks/report-expired` — body: `ReportCallback`. Update `report_jobs.status = 'expired'`. Audit: `AuditActions.MEDIASSIST_REPORT_JOB_EXPIRED`.
5. `POST /callbacks/notification-status` — body: `NotificationStatusCallback` (`notification_id`, `status`, `failure_reason`, `occurred_at`). No table to update (CallMedex doesn't persist a `notifications` row per outbound MediAssist notification today) — just audit-log it: `AuditActions.MEDIASSIST_NOTIFICATION_STATUS` with `details={"notification_id":..., "status":..., "failure_reason":...}`.
6. `GET /patients/lookup?phone=...` — resolve `phone` against the `users` table (`role = 'patient'`), return `PatientLookupResult` (`patient_id`, `preferred_language`, `default_address`). 404 if no match. Read-only — no idempotency-cache handling needed (GETs are naturally safe to repeat), still requires `verify_mediassist_signature`.
7. `POST /whatsapp-bookings` — body: `WhatsappBookingRequest`. Resolve `patient_id`: if provided, use it; else look up by `phone`; else create a minimal `patients`/`users` row (check `backend/app/routers/auth.py`'s signup flow for the minimum required fields on `users` — a WhatsApp-originated patient won't have a password, so this is a distinct "headless" patient creation path, not a call into the signup endpoint). Create a `bookings` row: `service_type` (map `home_blood_collection`→ existing `ServiceType` enum value used in `bookings.py`, same for the other three), `status = 'confirmed'` if `service_type == 'home_blood_collection'` (matching `bookings.py`'s home-collection immediate-confirm behavior) else `'pending_review'`, address fields from `WhatsappBookingRequest.address`. **Explicitly out of scope for this task:** replicating `bookings.py::create_booking`'s full processing-center assignment / phlebotomist dispatch / family-member provisioning pipeline. This route creates the booking row only; wiring it into `assign_booking`/`UniversalDispatchEngine.create_dispatch` the way `bookings.py` does is a follow-up not covered by this plan — leave a one-line code comment saying so, this is not a "TODO" placeholder, it's a documented scope boundary. Return `WhatsappBookingResult` (`booking_id`, `status`). Audit: `AuditActions.MEDIASSIST_WHATSAPP_BOOKING_CREATED`.

**`AuditActions` additions** (append near the existing `MEDIASSIST_*` constants in `backend/app/services/audit.py`):
```python
MEDIASSIST_REPORT_JOB_PROCESSING = "mediassist.report_job_processing"
MEDIASSIST_REPORT_JOB_DELIVERED = "mediassist.report_job_delivered"
MEDIASSIST_REPORT_JOB_FAILED = "mediassist.report_job_failed"
MEDIASSIST_REPORT_JOB_EXPIRED = "mediassist.report_job_expired"
MEDIASSIST_NOTIFICATION_STATUS = "mediassist.notification_status"
MEDIASSIST_WHATSAPP_BOOKING_CREATED = "mediassist.whatsapp_booking_created"
```

**Tests (`backend/tests/test_mediassist_inbound_routes.py`):** Use FastAPI `TestClient` against the real app (`from app.main import app`). For each route: a correctly-signed request succeeds; an unsigned/wrong-signature request gets 401; a repeated `X-Idempotency-Key` on `report-delivered` returns the identical cached response without double-upserting `ai_report_analyses` (assert only one row exists after two identical calls). You will need a helper to sign test requests — write a small one reusing the same HMAC formula as Task 2 (don't import test-only code from `mediassist_client.py`; duplicating a 3-line HMAC calculation in a test file is fine and clearer than a cross-cutting shared test util for one formula).

**Verify:** `cd backend && python -m pytest tests/test_mediassist_inbound_routes.py -q` — all green. Also re-run `cd backend && python -m pytest -q` (full suite) to confirm `main.py`'s new router registration didn't break anything else.

---

## Task 4: Rewire `/api/reports/analyze` off in-process OCR/AI-summary

**Files:**
- Modify: `backend/app/routers/ai_reports.py`, `backend/app/services/storage.py`
- Delete: `backend/app/services/ai_reports.py` (the whole file — `AIReportService`, `ANALYSIS_PROMPT`, the Groq call, the PyMuPDF extraction, the regex biomarker fallback parser)
- Create: `backend/tests/test_ai_reports_job_submission.py`

**Interfaces:**
- Consumes: Task 1's `report_jobs` table + extended contract, `app.integrations.mediassist_client.mediassist_client.submit_report_job`.
- Produces: rewired `POST /api/reports/analyze` (now returns 202 + job id instead of a synchronous analysis), new `GET /api/reports/jobs/{report_job_id}`.

**Read first:** the current `backend/app/routers/ai_reports.py` and `backend/app/services/ai_reports.py` in full (they're short, ~130 and ~280 lines) — the rewritten `/analyze` keeps the same file-type/size validation from the current router (MIME allowlist, 10MB cap, empty-file check), it only replaces what happens *after* validation.

**`backend/app/services/storage.py` change:** `StorageService.upload_verification_doc`/`signed_url` are hardcoded to `settings.VERIFICATION_BUCKET`. Add a bucket parameter (default `settings.VERIFICATION_BUCKET` to keep every existing caller unchanged) rather than duplicating the class for a second bucket:
```python
@staticmethod
def upload_document(user_id: str, file_bytes: bytes, ext: str, bucket: str = None) -> str:
    bucket = bucket or settings.VERIFICATION_BUCKET
    ...
```
Add `REPORTS_BUCKET: str = os.getenv("REPORTS_BUCKET", "lab-reports")` to `backend/app/config.py` alongside `VERIFICATION_BUCKET`. Keep `upload_verification_doc`/`signed_url` as thin wrappers calling the new bucket-parameterized methods so every existing call site (`grep -rn "StorageService\." backend/app` first, to find them all) keeps working unchanged.

**Rewritten `POST /api/reports/analyze`:**
1. Same validation as today (MIME type, empty check, 10MB cap).
2. Upload `file_bytes` via `StorageService.upload_document(current_user["sub"], file_bytes, ext, bucket=settings.REPORTS_BUCKET)` (derive `ext` from `content_type` via the existing `ALLOWED_TYPES` dict).
3. Get a signed URL via `StorageService.signed_url(path, bucket=settings.REPORTS_BUCKET)` (thread the bucket through the same way).
4. Look up the patient's `preferred_language` from `users` (default `"en"` if absent — check the `users` table schema/existing patient-profile code for the actual column name before assuming `preferred_language` is it).
5. Generate `report_job_id = str(uuid.uuid4())`, `correlation_id = str(uuid.uuid4())`.
6. Insert a `report_jobs` row (`status='queued'`, `patient_id`, `source_type='lab_report'`, `source_document_path=path`, `correlation_id`).
7. Call `await mediassist_client.submit_report_job(source_type="lab_report", source_document_url=signed_url, patient={"patient_id": current_user["sub"], "phone": <patient's phone from users>, "preferred_language": preferred_language}, delivery={"channels": ["whatsapp"]}, correlation_id=correlation_id)`. Wrap in try/except: on any `MediAssistError` subclass (`app.integrations.mediassist_client`), mark the `report_jobs` row `status='failed'`, `failure_reason=str(e)`, and return a 502 to the caller — don't silently swallow a submission failure the way the old broken WhatsApp calls did.
8. Return `{"success": True, "message": "Report submitted for analysis.", "report_job_id": report_job_id, "status": "queued"}` (202, not 200 — this is now genuinely asynchronous).

**New `GET /api/reports/jobs/{report_job_id}`:** Reads the local `report_jobs` row (never calls MediAssist directly — the patient polls CallMedex, CallMedex's own table is kept current by Task 3's callbacks). 404 if not found or `patient_id != current_user["sub"]` (don't leak another patient's job status). Returns `{report_job_id, status, failure_reason, updated_at}`.

**`GET /api/reports/history`:** Unchanged in shape — still reads `ai_report_analyses`, which Task 3's `report-delivered` handler now populates instead of the old synchronous insert in the current router. Verify (don't just assume) that the column names Task 3 writes match what `/history`'s `select("id, raw_report_url, plain_language_summary, created_at")` expects.

**Delete `backend/app/services/ai_reports.py` entirely.** Before deleting, `grep -rn "ai_reports" backend/app backend/tests` to confirm nothing else imports `AIReportService` (the router is the only consumer per the current file's own docstring, but verify rather than assume). Remove any now-unused imports this creates in the router.

**Tests (`backend/tests/test_ai_reports_job_submission.py`):** Monkeypatch `app.integrations.mediassist_client.mediassist_client.submit_report_job` (an `AsyncMock` or a small async stub) so no real network call happens — do not spin up a fake MediAssist server for this, that's what Task 3's tests plus the already-existing `test_mediassist_client.py` cover. Test: valid upload → 202, `report_jobs` row created with `status='queued'`; oversized file → 413 (unchanged from today); unsupported MIME → 400 (unchanged); `submit_report_job` raising `MediAssistUnavailableError` → the endpoint returns 502 and the `report_jobs` row is `status='failed'`; `GET /jobs/{id}` for another patient's job → 404.

**Verify:** `cd backend && python -m pytest tests/test_ai_reports_job_submission.py -q` — all green. Then `cd backend && python -m pytest -q` (full suite) — confirm the deletion of `services/ai_reports.py` didn't break anything else, and that `requirements.txt`'s `groq`/`pymupdf` entries are still needed elsewhere (`grep -rn "import groq\|import fitz" backend/app` — if genuinely nothing else uses them, note it in the task report as an observation, but do **not** remove them from `requirements.txt` in this task — that's a separate cleanup decision, out of scope here).

---

## Task 5: End-to-end integration test for the inbound flow

**Files:**
- Create: `backend/tests/test_mediassist_integration_e2e.py`

**Interfaces:**
- Consumes: everything from Tasks 1-4. This task adds no new production code — it is a test-only task proving the pieces work together.

**What this task is, and is not:** This is an integration test using FastAPI's `TestClient` against the real in-process app, with `mediassist_client`'s outbound network calls monkeypatched (no real Redis, no real MediAssist server, no real Celery worker). It proves the CallMedex-side logic is internally consistent end-to-end. It is **not** a live production smoke test against real infrastructure — that remains a manual, ops-side verification step once a real MediAssist endpoint and Redis instance exist, and is out of scope for an automated test in this repo.

**Scenario to cover, in one test function per scenario:**
1. Patient uploads a report → `/api/reports/analyze` returns 202 with a `report_job_id` (monkeypatch `submit_report_job` to return `{"report_job_id": <same id>, "status": "queued"}`, matching what a real MediAssist would send back per the contract) → simulate MediAssist calling back `POST /callbacks/report-processing` then `POST /callbacks/report-delivered` (correctly signed, with an `analysis` payload) → `GET /jobs/{report_job_id}` now shows `status='delivered'` → `GET /api/reports/history` includes the delivered analysis.
2. A `report-failed` callback instead of `report-delivered` → job status is `'failed'` with the given `failure_reason`, and `ai_report_analyses` gets no new row.
3. `POST /whatsapp-bookings` with an unknown phone number creates a new patient and a booking; a second call with the same `X-Idempotency-Key` and identical body does not create a second booking (returns the cached first response).
4. A `GET /patients/lookup` for a phone that exists returns the right `patient_id`; for one that doesn't, 404.

**Verify:** `cd backend && python -m pytest tests/test_mediassist_integration_e2e.py -q` — all green. Then the full suite one more time: `cd backend && python -m pytest -q`.
