-- ============================================================================
-- CallMedex — Schema Sync Patch (code ↔ database drift)
-- Generated 2026-07-25 by diffing backend/app/** against the LIVE PostgREST
-- schema of the running Supabase project (51 tables/views introspected).
--
-- Every statement is idempotent — safe to re-run.
-- The backend uses SUPABASE_SERVICE_KEY (bypasses RLS), so none of this
-- changes backend behaviour except by removing errors that are currently
-- being swallowed by try/except blocks.
--
-- SCOPE: only real drift is fixed here. Items that are CODE bugs rather than
-- schema gaps are listed at the bottom and deliberately NOT patched, because
-- patching them in SQL would create split-brain state.
-- ============================================================================

BEGIN;

-- ─── 1. bookings.status — restore the slot-allotment workflow values ──────
-- WHY: models/schemas.py::BookingStatus and routers/bookings.py (lines 764,
-- 776, 811, 853, 881) read and write 'slot_allotted', 'slot_accepted' and
-- 'slot_rejected'. An ad-hoc block added them, but complete_supabase_schema.sql
-- later re-asserted a NARROWER bookings_status_check that dropped all three.
-- Result: the whole "org allots a time → patient accepts/rejects" flow fails
-- with a check-constraint violation at runtime.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN (
    'pending', 'pending_review',
    'slot_allotted', 'slot_accepted', 'slot_rejected',
    'searching', 'provider_notified', 'provider_accepted',
    'confirmed', 'checked_in', 'in_progress',
    'completed', 'cancelled', 'no_show'
  ));

-- ─── 2. bookings — columns the payment + reminder code writes ─────────────
-- payment_status : services/payment.py:196 writes it on webhook capture.
-- reminder_sent / reminder_sent_at : workers/tasks/notifications.py:32-77.
-- booking_date / slot_time : workers/tasks/notifications.py:34-37 and
--                            routers/provider_management.py:425-427.
-- All five currently raise 42703 (column does not exist) and are swallowed,
-- so payment status never records and appointment reminders never fire.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status   TEXT DEFAULT 'unpaid';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent    BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_date     DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS slot_time        TEXT;

-- Keep booking_date / slot_time derived from slot_start automatically.
-- Without this the two new columns stay NULL and the reminder worker + the
-- provider slot-conflict check would silently match zero rows forever.
-- (A GENERATED column can't be used: timestamptz→date is STABLE, not IMMUTABLE.)
CREATE OR REPLACE FUNCTION sync_booking_date_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slot_start IS NOT NULL THEN
        NEW.booking_date := (NEW.slot_start AT TIME ZONE 'Asia/Kolkata')::date;
        NEW.slot_time    := to_char(NEW.slot_start AT TIME ZONE 'Asia/Kolkata', 'HH24:MI');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_booking_date_time ON bookings;
CREATE TRIGGER trg_sync_booking_date_time
    BEFORE INSERT OR UPDATE OF slot_start ON bookings
    FOR EACH ROW EXECUTE FUNCTION sync_booking_date_time();

-- Backfill existing rows.
UPDATE bookings
   SET booking_date = (slot_start AT TIME ZONE 'Asia/Kolkata')::date,
       slot_time    = to_char(slot_start AT TIME ZONE 'Asia/Kolkata', 'HH24:MI')
 WHERE slot_start IS NOT NULL
   AND (booking_date IS NULL OR slot_time IS NULL);

CREATE INDEX IF NOT EXISTS idx_bookings_date_status
    ON bookings(booking_date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_reminder
    ON bookings(booking_date, reminder_sent) WHERE reminder_sent = false;

-- ─── 3. consultations — ended_by column + 'ended' status ──────────────────
-- services/telemedicine.py:265-272 (end_consultation) writes BOTH an
-- 'ended' status and an ended_by column. Neither is currently accepted, so
-- ending a video consult fails and the AI summary pipeline never triggers.
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ended_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_status_check;
ALTER TABLE consultations ADD CONSTRAINT consultations_status_check
  CHECK (status IN ('scheduled', 'in_progress', 'ended', 'completed', 'cancelled'));

-- ─── 4. dispatch_requests — cancel_reason ─────────────────────────────────
-- workers/tasks/dispatch.py:28 (expire_stale_dispatches) writes cancel_reason
-- so the patient can be told why the search was abandoned.
ALTER TABLE dispatch_requests ADD COLUMN IF NOT EXISTS cancel_reason TEXT DEFAULT '';

-- ─── 5. organization_doctors → doctors relationship ───────────────────────
-- routers/bookings.py:615 requests the PostgREST embed
--   .select("*, doctors(specialization, consultation_mode), users(full_name, email)")
-- which fails with PGRST200 ("Could not find a relationship between
-- 'organization_doctors' and 'doctors'"), so every organization detail page
-- silently renders an EMPTY doctor list.
-- organization_doctors.doctor_user_id → users(id) exists; doctors.user_id →
-- users(id) exists; but PostgREST cannot hop through users. Giving doctors.user_id
-- a UNIQUE constraint (verified: 0 duplicates, 0 nulls) lets us point the FK
-- straight at it, which PostgREST then resolves as a many-to-one embed.
ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_user_id_key;
ALTER TABLE doctors ADD CONSTRAINT doctors_user_id_key UNIQUE (user_id);

ALTER TABLE organization_doctors DROP CONSTRAINT IF EXISTS organization_doctors_doctor_profile_fkey;
ALTER TABLE organization_doctors ADD CONSTRAINT organization_doctors_doctor_profile_fkey
    FOREIGN KEY (doctor_user_id) REFERENCES doctors(user_id) ON DELETE CASCADE;

COMMIT;

-- ── Reload the PostgREST schema cache so the new FK/columns are visible ───
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- OPTIONAL HARDENING (not required by any current code path — review first)
-- ============================================================================
-- One profile row per user. Verified against live data: no duplicates today,
-- but nothing currently prevents a double-registration from creating two.
--   ALTER TABLE patients      ADD CONSTRAINT patients_user_id_key      UNIQUE (user_id);
--   ALTER TABLE organizations ADD CONSTRAINT organizations_user_id_key UNIQUE (user_id);
--   ALTER TABLE pharmacies    ADD CONSTRAINT pharmacies_user_id_key    UNIQUE (user_id);
--   ALTER TABLE nurses        ADD CONSTRAINT nurses_user_id_key        UNIQUE (user_id);
--   ALTER TABLE phlebotomists ADD CONSTRAINT phlebotomists_user_id_key UNIQUE (user_id);

-- ============================================================================
-- NOT PATCHED HERE — these are CODE bugs, not schema gaps. Fixing them in SQL
-- would duplicate state that already has a correct home in the schema.
--
-- (a) routers/dispatch.py:444
--     Writes phlebotomists.is_online, which does not exist. The real column is
--     phlebotomists.on_duty, and that IS what the matching queries read
--     (services/dispatch.py:54, services/dispatch_engine.py:174).
--     Adding is_online would split duty state across two columns and break
--     dispatch matching. FIX THE CODE: is_online → on_duty.
--
-- (b) workers/tasks/dispatch.py:71
--     Writes dispatch_requests.provider_id (column is assigned_provider_id)
--     and status 'assigned' (not a valid dispatch status — the rest of the app
--     uses 'provider_accepted'). FIX THE CODE, don't widen the constraint.
--
-- (c) workers/tasks/dispatch.py:28
--     Filters .eq("status", "pending") on dispatch_requests, but that table's
--     initial status is 'searching'. The stale-dispatch sweeper therefore
--     matches zero rows. FIX THE CODE: 'pending' → 'searching'.
-- ============================================================================
