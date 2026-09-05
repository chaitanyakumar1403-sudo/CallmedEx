-- ═══════════════════════════════════════════════════════════════════════════
-- Task 14b — One live booking per patient, per slot, per service
--
-- Run this AFTER database/task14_registration_integrity.sql.
--
-- Why it is a separate file
-- ------------------------
-- The unique index cannot be created while duplicates exist, and Supabase runs
-- a SQL-editor script as ONE transaction: putting it in task14 made the whole
-- migration abort and roll back every repair before it. It is also the only
-- part of the change that closes a booking somebody is holding, which an
-- operator should do deliberately.
--
-- New duplicates are ALREADY blocked without this file: create_booking
-- (backend/app/routers/bookings.py) returns the patient's existing booking
-- rather than writing a second one. This index is defence-in-depth for the
-- concurrent-request race that an application-level check cannot see — two
-- taps landing in the same millisecond.
--
-- STEP 1 first. It is read-only and shows exactly what STEP 2 would close.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── STEP 1 — REVIEW (read-only). Run this on its own and read the output. ──
-- Every group below has more than one LIVE booking for the same patient, slot
-- and service. `verdict` is what STEP 2 would do to each row.
WITH live AS (
    SELECT b.*,
           COALESCE(MAX(CASE d.status
                WHEN 'completed'                 THEN 7
                WHEN 'samples_delivered_to_lab'  THEN 6
                WHEN 'in_progress'               THEN 5
                WHEN 'arrived'                   THEN 4
                WHEN 'en_route'                  THEN 3
                WHEN 'provider_accepted'         THEN 2
                WHEN 'provider_notified'         THEN 1
                WHEN 'searching'                 THEN 1
                ELSE 0 END), 0) AS dispatch_progress
      FROM bookings b
      LEFT JOIN dispatch_requests d ON d.booking_id = b.id
     WHERE b.slot_id IS NOT NULL
       AND b.status NOT IN ('cancelled', 'slot_rejected', 'completed')
     GROUP BY b.id
), ranked AS (
    SELECT id, patient_id, slot_id, service_type, status, booking_kind,
           processing_center_id, created_at, dispatch_progress,
           ROW_NUMBER() OVER (
               PARTITION BY patient_id, slot_id, service_type
               -- Keep the booking that is furthest along in the real world:
               -- one bound to a processing centre beats one that is not, then
               -- the one a collector actually progressed, then the earliest.
               ORDER BY (processing_center_id IS NOT NULL) DESC,
                        dispatch_progress DESC,
                        created_at ASC
           ) AS rn,
           COUNT(*) OVER (PARTITION BY patient_id, slot_id, service_type) AS live_in_group
      FROM live
)
SELECT patient_id, slot_id, service_type, id AS booking_id, status, booking_kind,
       (processing_center_id IS NOT NULL) AS bound_to_centre,
       dispatch_progress, created_at,
       CASE WHEN rn = 1 THEN 'KEEP' ELSE 'CLOSE as duplicate' END AS verdict
  FROM ranked
 WHERE live_in_group > 1
 ORDER BY patient_id, slot_id, service_type, rn;


-- ── STEP 2 — RESOLVE + ENFORCE. Run only after reading STEP 1's output. ────
BEGIN;

-- 2a. Work out the losers ONCE, so the cancellation below can never act on a
--     wider set than STEP 1 showed you.
CREATE TEMP TABLE _duplicate_bookings ON COMMIT DROP AS
WITH live AS (
    SELECT b.id, b.patient_id, b.slot_id, b.service_type,
           b.processing_center_id, b.created_at,
           COALESCE(MAX(CASE d.status
                WHEN 'completed'                 THEN 7
                WHEN 'samples_delivered_to_lab'  THEN 6
                WHEN 'in_progress'               THEN 5
                WHEN 'arrived'                   THEN 4
                WHEN 'en_route'                  THEN 3
                WHEN 'provider_accepted'         THEN 2
                WHEN 'provider_notified'         THEN 1
                WHEN 'searching'                 THEN 1
                ELSE 0 END), 0) AS dispatch_progress
      FROM bookings b
      LEFT JOIN dispatch_requests d ON d.booking_id = b.id
     WHERE b.slot_id IS NOT NULL
       AND b.status NOT IN ('cancelled', 'slot_rejected', 'completed')
     GROUP BY b.id
), ranked AS (
    SELECT id,
           ROW_NUMBER() OVER w  AS rn,
           FIRST_VALUE(id) OVER w AS keeper_id
      FROM live
    WINDOW w AS (
        PARTITION BY patient_id, slot_id, service_type
        -- Keep the booking that is furthest along in the real world: one bound
        -- to a processing centre beats one that is not, then the one a
        -- collector actually progressed, then the earliest.
        ORDER BY (processing_center_id IS NOT NULL) DESC,
                 dispatch_progress DESC,
                 created_at ASC
    )
)
SELECT id, keeper_id FROM ranked WHERE rn > 1;

-- 2b. Close them, leaving an audit trail in `notes` naming the booking they
--     duplicated. Nothing is deleted.
UPDATE bookings b
   SET status = 'cancelled',
       updated_at = NOW(),
       notes = COALESCE(b.notes, '')
               || CASE WHEN COALESCE(b.notes, '') = '' THEN '' ELSE chr(10) END
               || '[' || to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS')
               || '] Closed automatically as a duplicate of booking '
               || d.keeper_id || ' (same patient, slot and service).'
  FROM _duplicate_bookings d
 WHERE b.id = d.id;

-- 2c. Release the dispatch requests those closed bookings were holding —
--     scoped to exactly the bookings closed above, nothing else. Otherwise a
--     collector keeps a job for a booking that no longer exists and their
--     dashboard shows it as the active task indefinitely.
UPDATE dispatch_requests
   SET status = 'cancelled',
       cancel_reason = COALESCE(NULLIF(cancel_reason, ''),
                                'Booking closed as a duplicate'),
       updated_at = NOW()
 WHERE booking_id IN (SELECT id FROM _duplicate_bookings)
   AND status NOT IN ('cancelled', 'completed');

-- 2d. Now the index can be created, and no second live booking for the same
--     patient + slot + service can ever be written again. Cancelled, rejected
--     and completed bookings are excluded so re-booking a slot still works.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_patient_slot_active
    ON bookings (patient_id, slot_id, service_type)
 WHERE slot_id IS NOT NULL
   AND status NOT IN ('cancelled', 'slot_rejected', 'completed');

COMMIT;


-- ── STEP 2e — OPTIONAL, separate on purpose. ──────────────────────────────
-- Dispatch requests still open against a booking that is already cancelled.
-- These are what make a phlebotomist's dashboard show a stale task forever —
-- one live example was five weeks old. Review first, then run the UPDATE.
--
--   SELECT d.id, d.status, d.booking_id, b.status AS booking_status, d.created_at
--     FROM dispatch_requests d
--     JOIN bookings b ON b.id = d.booking_id
--    WHERE b.status IN ('cancelled', 'slot_rejected')
--      AND d.status NOT IN ('cancelled', 'completed');
--
--   UPDATE dispatch_requests d
--      SET status = 'cancelled',
--          cancel_reason = COALESCE(NULLIF(d.cancel_reason, ''),
--                                   'Booking is no longer live'),
--          updated_at = NOW()
--     FROM bookings b
--    WHERE b.id = d.booking_id
--      AND b.status IN ('cancelled', 'slot_rejected')
--      AND d.status NOT IN ('cancelled', 'completed');


-- ── STEP 3 — VERIFY. Expect zero rows. ────────────────────────────────────
SELECT patient_id, slot_id, service_type, COUNT(*) AS live_bookings
  FROM bookings
 WHERE slot_id IS NOT NULL
   AND status NOT IN ('cancelled', 'slot_rejected', 'completed')
 GROUP BY patient_id, slot_id, service_type
HAVING COUNT(*) > 1;
