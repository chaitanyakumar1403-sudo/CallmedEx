# CallMedex Forensic Intelligence: Observability, Telemetry & Audit Analysis

> **Analysis Scope**: In-depth forensic evaluation of logging pipelines, request tracing (`X-Request-ID`), error handling, health checks, operational alert mechanisms (`ops_alerts`), APM integration, and telemetry gaps across CallMedex.

---

## 1. Observability Architecture Overview

CallMedex currently implements a **lightweight, log-and-table based observability model**:
- **Log Stream**: Python standard library `logging` writing unformatted text strings to stdout/stderr.
- **Request Tracing**: `SecurityMiddleware` generates an 8-character hex correlation ID (`X-Request-ID`) per incoming HTTP request.
- **Operational Incident Tracking**: Asynchronous failures (e.g. dispatch timeout, failed payout) are inserted directly into the PostgreSQL `ops_alerts` table.
- **Health Verification**: `/api/health` queries core infrastructure (Supabase DB, Redis) and returns an HTTP status payload.

---

## 2. Request Correlation & Tracing (`X-Request-ID`)

### 2.1 Trace Generation & Flow

In `backend/app/middleware/security.py`:
```python
request_id = str(uuid.uuid4())[:8]
request.state.request_id = request_id
...
duration = round((time.time() - start_time) * 1000, 1)
logger.info(f"[{request_id}] {request.method} {request.url.path} → {response.status_code} ({duration}ms)")
response.headers["X-Request-ID"] = request_id
```

### 2.2 Trace Scope & Limitations
1. **Scope**: The trace ID exists solely within the synchronous FastAPI request lifecycle.
2. **Celery Worker Disconnect**:
   - When a router or Celery Beat dispatches a background task (e.g., `expire_stale_dispatches.delay()`), the `request_id` **is NOT passed into the Celery task payload**.
   - Consequently, Celery worker logs operate with un-correlated logs, making it impossible to correlate an incoming HTTP request with its downstream asynchronous worker executions.
3. **Frontend Propagation**:
   - The web frontend (`frontend/`) and mobile app (`mobile/`) receive `X-Request-ID` in HTTP response headers, but do not log or forward it during subsequent client errors.

---

## 3. Operational Alerting Engine (`ops_alerts`)

Rather than streaming metrics to Prometheus/PagerDuty, CallMedex uses a **database-backed alert queue** (`ops_alerts`) for operational awareness.

### 3.1 Alert Triggers & Severities

| Component | Trigger Condition | Severity | Destination | Resolution Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| `dispatch_retry.py` | Dispatch fan-out fails all retry attempts | `critical` | `ops_alerts` table | City Supervisor manual dispatch via dashboard. |
| `dispatch.py` | Phlebotomist offer expires without acceptance | `error` | `ops_alerts` table | Automated re-fan-out or supervisor escalation. |
| `report_retry.py` | AI OCR / Report analysis fails maximum retries | `error` | `ops_alerts` table | Pathologist manual review queue. |
| `payments.py` | Razorpay transfer to phlebotomist fails | `critical` | `ops_alerts` table | Finance admin manual retry via `/api/admin/settlements`. |

### 3.2 Schema Definition of `ops_alerts`
```sql
CREATE TABLE ops_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'error', 'warning', 'info')),
    title TEXT NOT NULL,
    description TEXT,
    reference_id UUID,
    reference_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id)
);
```

---

## 4. Health Checks & Readiness Probes

### 4.1 `/api/health` Implementation

Located in `backend/app/routers/admin.py` (and root router):
- **Checks Performed**:
  1. Database connectivity: executes a `SELECT 1` or lightweight query to Supabase.
  2. Redis ping: sends `PING` and verifies `PONG`.
  3. Environment integrity: checks presence of critical secrets (`SUPABASE_URL`, `JWT_SECRET`).
- **Response Format**:
  ```json
  {
    "status": "healthy",
    "version": "3.1.0",
    "environment": "staging",
    "database": "connected",
    "redis": "connected",
    "timestamp": "2026-09-22T15:04:05Z"
  }
  ```
- **Probe Usage**:
  - `docker-compose.yml`: Polled every 30s by `backend` and `nginx` healthcheck directives.
  - `render.yaml`: Configured as the zero-downtime deployment health check (`healthCheckPath: /api/health`).

---

## 5. Critical Observability Gaps

| Capability Area | Current Status | Forensic Impact & Production Risk |
| :--- | :--- | :--- |
| **Distributed Tracing** | **ABSENT** | No OpenTelemetry, Jaeger, or Datadog APM. Cannot trace latency bottlenecks across FastAPI -> Redis -> PostgREST -> External APIs. |
| **APM / Error Aggregation** | **ABSENT** | Sentry or Rollbar is not configured. Unhandled 500 errors print tracebacks to container stdout and are lost if container restarts. |
| **Structured JSON Logging** | **ABSENT** | Logs are formatted as raw strings: `%(asctime)s [%(levelname)s] %(name)s: %(message)s`. Ingestion into Datadog/ELK requires complex Grok parsers. |
| **Time-Series Metrics** | **ABSENT** | No Prometheus `/metrics` endpoint. No gauge or counter for active WebSocket connections, Celery queue lag, or HTTP request rates. |
| **Audit Log Integrity** | **PARTIAL** | `audit_logs` table records admin actions, but standard user PHI reads (e.g. phlebotomist viewing patient test results) are not audited. |
