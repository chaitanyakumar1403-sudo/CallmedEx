# 14 — BACKGROUND JOBS, SCHEDULERS & WORKERS

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Asynchronous Execution & Scheduled Crons Audit  
**Verification Level:** STATICALLY VERIFIED against Celery configuration and worker task modules  

---

## 1. ASYNCHRONOUS ARCHITECTURE OVERVIEW

CallMedex uses **Celery** (`celery >= 5.3.0`) backed by **Redis 7** (`redis >= 5.0.0`) to handle deferred processing, periodic cron maintenance, and high-frequency dispatch rotations.

- **Broker / Backend:** `REDIS_URL` (configured via `backend/app/config.py`).
- **Timezone:** Enforced to `Asia/Kolkata` (Indian Standard Time, IST / UTC+5:30).
- **Worker Concurrency:** Defaulted to 2 worker processes in `docker-compose.yml` (`--concurrency=2`).
- **Configuration Entrypoint:** `backend/app/workers/celery_app.py`.

---

## 2. SCHEDULED CRON INVENTORY (`beat_schedule`)

The Celery Beat scheduler maintains 8 periodic tasks defined in `celery_app.py`:

| Schedule Identifier | Frequency | Task Handler | Target Subsystem | Business Function |
| :--- | :--- | :--- | :--- | :--- |
| `scheduled-dispatch-sweep` | **Every 5 minutes** | `scheduled_dispatch.scheduled_dispatch_sweep` | Dispatch Engine | Scans bookings due within 4 hours; triggers provider offers. |
| `rotate-unaccepted-offers` | **Every 60 seconds** | `dispatch.rotate_unaccepted_offers` | Field Operations | Checks pending offers older than 10 minutes; rotates to next collector. |
| `send-appointment-reminders`| **Every 15 minutes**| `notifications.send_appointment_reminders` | Communications | Dispatches WhatsApp and SMS reminders for bookings within 2 hours. |
| `retry-failed-report-jobs` | **Every 10 minutes**| `report_retry.retry_failed_report_jobs` | AI Pipeline | Retries transient report OCR failures against OpenRouter gateway. |
| `cleanup-stale-dispatches` | **Hourly** | `cleanup.cleanup_stale_dispatches` | Data Hygiene | Cancels unassigned dispatch requests older than 24 hours. |
| `generate-daily-roster` | **Daily at 00:00 IST**| `roster.generate_daily_roster` | Roster & Staffing | Generates shift slots for all active phlebotomists across PCs. |
| `mark-absent-phlebotomists`| **Daily at 12:00 IST**| `attendance.mark_absent_phlebotomists` | Staff Attendance | Marks rostered staff with no active check-in as absent. |
| `process-pending-settlements`| **Daily at 02:00 IST**| `payments.process_pending_settlements` | Payments Ledger | Moves `captured` payments to `settled`, writes `settlements` records. |

---

## 3. DEEP DIVE INTO HIGH-IMPACT WORKERS

### A. Scheduled Dispatch Sweep (`app/workers/tasks/scheduled_dispatch.py`)
- **Lookahead Window:** 240 minutes (4 hours) ahead of current IST time.
- **Workflow:**
  1. Queries `bookings` where `status = 'pending'`, `service_type = 'home_collection'`, and `preferred_date` is today (or `slot_start <= now + 4h`).
  2. Resolves patient latitude/longitude and nearest Processing Center.
  3. Transitions booking status to `'searching'`.
  4. Calls `UniversalDispatchEngine.create_dispatch_request`.
  5. Broadcasts push and SMS notifications to on-duty phlebotomists in that district.
- **Concurrency Defense:**
  Uses database status transitions (`UPDATE bookings SET status='searching' WHERE status='pending'`) to prevent multiple sweeps from generating duplicate dispatch requests.

### B. Offer Rotation Worker (`app/workers/tasks/dispatch.py`)
- **Workflow:**
  1. Queries `dispatch_offers` where `status = 'offered'` and `expires_at < now()`.
  2. Updates expired offer status to `'expired'`.
  3. Increments `round_number` on the parent `dispatch_requests` record.
  4. If `round_number <= MAX_SEARCH_ROUNDS` (3 rounds):
     - Selects the next closest available provider in `provider_locations` who has not yet been offered this job.
     - Inserts a new `dispatch_offers` row with 10-minute expiry.
     - Pings provider via push notification.
  5. If `round_number > 3`:
     - Updates request to `'no_provider'`.
     - Logs alert in `ops_alerts` for human operator intervention.

---

## 4. ARCHITECTURAL VULNERABILITIES & DEPLOYMENT TRAPS

### Finding WRK-01: Silent Pipeline Stalling on Standalone API Deployments
- **Severity:** High
- **Risk:**
  If CallMedex is deployed on a platform where only the web container is provisioned (e.g. deploying only the Render Web Service without spinning up the Render Background Worker), the system appears to start normally:
  - `/api/health` returns HTTP 200.
  - User signups and bookings succeed.
  - **Failure:** None of the 8 periodic tasks will ever execute. Bookings will sit in `pending` indefinitely, offers will never rotate, reminders will never be sent, and settlements will never process.
- **Verification Rule:** Production monitoring MUST verify that `callmedex-celery-worker` and `callmedex-celery-beat` containers are active and emitting heartbeats to Redis.

### Finding WRK-02: Missing Distributed Redis Locking
- **Severity:** Medium
- **Risk:**
  Tasks like `scheduled_dispatch_sweep` and `process_pending_settlements` execute database queries without acquiring a distributed mutex lock (such as Redis `SETNX` or `Redlock`).
- **Interleaving Scenario:**
  If two Celery Beat schedulers are accidentally started concurrently (e.g. during a rolling container update), both instances will fire the 5-minute sweep simultaneously. While individual status queries mitigate some duplicate writes, concurrent provider notifications and duplicate push alerts will occur.
