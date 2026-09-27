# 18 — CONCURRENCY, RACE CONDITIONS & IDEMPOTENCY

**Document Version:** 1.0.0  
**Commit SHA:** `a7e8478e0e39d6b7a215fc9b5458c1ce0a321736`  
**Classification:** Concurrency Control, Race Condition Analysis & Idempotency Audit  
**Verification Level:** STATICALLY VERIFIED against database constraints, transactions, and locking mechanisms  

---

## 1. THE TRANSACTION BOUNDARY PROBLEM: POSTGREST REST CLIENT

A fundamental architectural characteristic of CallMedex is that backend database queries are issued over the **Supabase PostgREST HTTP interface** (`supabase-py`).

### Forensic Finding on Database Transactions:
- **No Client-Side Multi-Statement Transactions:**
  Standard PostgreSQL drivers (like `psycopg2` or `asyncpg`) support client-managed `BEGIN ... COMMIT` blocks. PostgREST does NOT support multi-statement transactions over REST.
- **Sequential Multi-Table Inserts:**
  When a booking is created (`POST /api/bookings`), the backend executes up to 5 sequential HTTP requests to Supabase:
  1. `INSERT INTO bookings`
  2. `INSERT INTO booking_subjects`
  3. `INSERT INTO booking_tests`
  4. `INSERT INTO samples`
  5. `INSERT INTO sample_events`
- **Partial Failure Risk:**
  If step 1, 2, and 3 succeed, but step 4 fails (e.g. barcode collision or DB timeout), **Postgres does not automatically roll back steps 1–3**. The database is left with an active booking that has zero physical sample tubes associated with it.

---

## 2. DETAILED CONCURRENCY SCENARIOS

### Scenario A: Concurrent Appointment Double Booking
- **Hazard:** Two patients attempting to book the same doctor's 10:00 AM slot at the exact same millisecond.
- **Code Pattern:**
  Historically, the code executed a classic *check-then-act* anti-pattern (SELECT slot -> check is_available -> INSERT booking -> UPDATE slot).
- **Database Defense Implemented:**
  In `database/task14b_booking_duplicate_guard.sql`, a PostgreSQL partial unique index was added:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_active_slot
  ON bookings (provider_id, slot_start)
  WHERE status NOT IN ('cancelled', 'no_show', 'slot_rejected');
  ```
- **Observed Behavior:**
  If two requests race, the first `INSERT INTO bookings` succeeds. The second insert raises a PostgreSQL unique constraint violation (`23505`), which the backend catches and translates to `HTTP 409 Conflict ("This slot has just been booked by another patient.")`.
- **Verdict:** **CONCURRENCY PROTECTED.**

### Scenario B: Concurrent Phlebotomist Offer Acceptance
- **Hazard:** When an urgent dispatch is broadcast to 5 nearby phlebotomists simultaneously, two collectors tap "Accept Offer" at the exact same time.
- **Race Interleaving:**
  ```text
  Phlebo A: Taps Accept -> reads dispatch_offers (status='offered')
  Phlebo B: Taps Accept -> reads dispatch_offers (status='offered')
  Phlebo A: UPDATE dispatch_offers SET status='accepted' WHERE id=OfferA
  Phlebo B: UPDATE dispatch_offers SET status='accepted' WHERE id=OfferB
  Phlebo A: UPDATE dispatch_requests SET status='provider_accepted', provider_id=PhleboA
  Phlebo B: UPDATE dispatch_requests SET status='provider_accepted', provider_id=PhleboB  <-- OVERWRITES A!
  ```
- **Code Mitigation in `dispatch_engine.py`:**
  The update query uses an atomic conditional filter:
  `UPDATE dispatch_requests SET status='provider_accepted', provider_id=collector_id WHERE id=req_id AND status='searching'`
  If Phlebo A's update succeeds, the status becomes `'provider_accepted'`. When Phlebo B's update executes, the condition `status='searching'` matches 0 rows. The handler detects that 0 rows were updated, raises `HTTP 409 Conflict ("This job has already been claimed by another provider.")`, and informs Phlebo B.
- **Verdict:** **CONCURRENCY PROTECTED via Atomic Conditional Writes.**

### Scenario C: Specimen Barcode Collisions
- **Hazard:** Two phlebotomists in different cities drawing blood simultaneously receive the exact same generated barcode string.
- **Mitigation in `app/services/samples.py`:**
  ```python
  @staticmethod
  def generate_barcode(max_attempts: int = 6) -> str:
      for attempt in range(max_attempts):
          candidate = f"CMX-{now_yymmdd}-{secrets.token_hex(3).upper()}"
          # Check uniqueness against samples table
          if not _barcode_exists(candidate):
              return candidate
      raise RuntimeError("Barcode entropy exhausted after 6 collision attempts.")
  ```
- **Analysis:** `secrets.token_hex(3)` provides $16^6 = 16,777,216$ combinations per day. With fewer than 10,000 daily collections, collision probability is $< 0.06\%$. The 6-attempt loop plus `samples.barcode UNIQUE` constraint guarantees uniqueness.
- **Verdict:** **SAFE.**

---

## 3. IDEMPOTENCY MATRIX

| Ingress Channel | Idempotency Mechanism | Storage / Verification Layer | Replay Behavior |
| :--- | :--- | :--- | :--- |
| **MediAssist Webhooks** | `X-Idempotency-Key` (UUIDv4) | `mediassist_inbound_requests` table | Returns cached HTTP response (`X-Cache: HIT`). |
| **Payment Verification** | `razorpay_order_id` state check | `payments.status == 'captured'` | Returns `{ duplicate: true, verified: true }`. |
| **SMS OTP Verification** | Single-use OTP deletion | Deletes/invalidates OTP upon first successful check | Second attempt returns `HTTP 400 Invalid OTP`. |
| **Public Tracking Token** | Token-based lookup | Read-only idempotent query | Safe for infinite client refreshes. |
| **Account Deletion** | Idempotent hard/soft delete | Cascading removal in `users` and linked profiles | Repeating returns `HTTP 404 User not found`. |
