# 17 — FAILURE PATHS, TIMEOUTS & RESILIENCE FORENSICS

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Failure-Mode Analysis, Error Handling & Recovery Audit  
**Verification Level:** STATICALLY VERIFIED against exception blocks, circuit breakers, and timeouts  

---

## 1. FAIL-OPEN VS FAIL-CLOSED CLASSIFICATION MATRIX

A critical dimension of healthcare software is whether components fail **safely closed** (blocking operation until resolved) or **fail open** (permitting degraded operation).

| Subsystem / Component | Failure Trigger | Handled Behavior | Safety Classification | Forensic Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Payment Verification** | Invalid signature or Razorpay API timeout | Rejects transaction, returns HTTP 400/500, does not confirm booking. | **FAIL-CLOSED** | Secure. Prevents unpaid service delivery. |
| **Provider License Check**| `USE_MOCK_GOV_API=true` or NMC API down | Approves any registration string $\ge 4$ characters. | **FAIL-OPEN** | **High Clinical Risk.** Allows unverified practitioners if flag is enabled. |
| **Video Consultation** | `DAILY_API_KEY` missing or Daily.co 5xx | Generates unauthenticated Jitsi Meet room (`meet.jit.si/callmedex-{id}`). | **FAIL-OPEN** | High privacy risk. Consultation proceeds without room access control. |
| **Home Visit Geocoding** | Geocoding service down or address unparseable | Commits booking to DB; marks dispatch as unpinned; alerts operator. | **PARTIAL SUCCESS** | Balanced. Patient booking is not destroyed, but requires manual dispatch. |
| **Specimen Intake** | Unrecognized tube barcode or hemolysis | Rejects sample at PC; automatically schedules recollected draw. | **FAIL-CLOSED** | Clinically Sound. Bad specimens are not analyzed. |
| **MediAssist AI Bridge** | Network timeout or 5xx from MediAssist | Circuit breaker trips after 5 failures; retries up to 5 times. | **FAIL-CLOSED** | Reliable. Queued callbacks are not lost; redelivered upon recovery. |
| **Request Timeout** | Request execution exceeds 60s (or 300s for AI)| `RequestTimeoutMiddleware` terminates connection with HTTP 504. | **FAIL-CLOSED** | Resilient. Protects worker threads from starvation. |

---

## 2. CIRCUIT BREAKERS & RETRY POLICIES

### A. MediAssist AI Circuit Breaker (`app/integrations/mediassist_client.py`)
- **Connect Timeout:** 10.0 seconds.
- **Total Request Timeout:** 20.0 seconds.
- **Max Retries:** 5 attempts with exponential backoff (`factor=2.0`).
- **Retry Condition:** Only on network drops, HTTP 502, 503, 504, or timeouts. **Never retries on 4xx** (4xx represents contract violations).
- **Circuit Breaker Mechanics:**
  - If 5 consecutive failures occur: Breaker trips to `OPEN`. All subsequent calls immediately raise `MediAssistCircuitOpenError` without making network requests.
  - After 30 seconds (`MEDIASSIST_CIRCUIT_RESET_SECONDS`), breaker enters `HALF-OPEN` and allows 1 probe request.
  - If 2 consecutive probe requests succeed: Breaker resets to `CLOSED`.

### B. Database Connection Pool Limits (`app/database.py`)
- Limits PostgREST HTTP pool to prevent connection exhaustion:
  ```python
  _POOL_LIMITS = httpx.Limits(
      max_connections=20,
      max_keepalive_connections=10,
      keepalive_expiry=30,
  )
  _CLIENT_TIMEOUT = 30  # seconds
  ```

---

## 3. IDENTIFIED SILENT FAILURES & SWALLOWED EXCEPTIONS

### Finding FAIL-01: Silent Sample Loss on Unmatched Test Catalog Names
- **Location:** `backend/app/routers/bookings.py` (lines 527–533)
- **Observed Code:**
  ```python
  logger.warning(
      f"Home-collection booking {booking_id}: selected test {entry!r} "
      "did not match any home_services row or health_packages name — "
      "no sample will be created for it. A phlebotomist will NOT be "
      "told to draw this test; needs manual follow-up."
  )
  ```
- **Technical Path:**
  If a patient books a test whose display name was changed or misspelled in the frontend cart, `_provision_home_collection` logs a warning and proceeds. It does **not** fail the booking.
- **Consequence:** The patient pays for the test, but the generated phlebotomy work order instructs the collector to draw tubes only for the matched tests. The unmatched test is silently omitted from the collector's instructions, requiring manual phone follow-up.

### Finding FAIL-02: Local Memory Fallback on Missing Supabase
- **Location:** `backend/app/routers/auth.py` (lines 65–79)
- **Observed Code:**
  ```python
  _local_users = {}
  _local_profiles = {}
  ```
  If `supabase` client is `None` (missing credentials), `auth.py` and `dispatch.py` write records into global Python dictionaries in process memory.
- **Consequence:** In local development or during credential misconfigurations, the server appears to accept signups and logins, but all state evaporates upon process restart or across worker processes.
