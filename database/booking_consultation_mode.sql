-- ============================================================================
-- bookings.consultation_mode
--
-- BookingCreate has carried consultation_mode since multi-modal providers
-- (a physiotherapist takes teleconsults, home visits AND walk-ins) went live.
-- It decides the price charged — _resolve_provider_fee reads home_visit_fee
-- for 'home_visit' and consultation_fee for everything else — and it decides
-- whether a dispatch is raised to the provider. It was never persisted, so
-- once the request ended nothing could tell the three modes apart:
--   * the patient dashboard could not find a home visit to track, which meant
--     the arrival OTP never reached the patient and the provider could not
--     start the visit;
--   * the provider's day list could not say where to go;
--   * a billing query could not explain why a booking cost the home-visit rate.
--
-- Existing rows: home-collection bookings are marked from booking_kind; every
-- other historical row is left at the 'in_person' default, which is what the
-- old code effectively assumed.
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS consultation_mode TEXT NOT NULL DEFAULT 'in_person';

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_consultation_mode_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_consultation_mode_check
  CHECK (consultation_mode IN ('in_person', 'online', 'home_visit'));

UPDATE bookings
   SET consultation_mode = 'home_visit'
 WHERE booking_kind = 'home_collection'
   AND consultation_mode = 'in_person';

-- The patient dashboard polls /api/dispatch/for-booking for every booking that
-- could have a visit attached; this keeps that scan off a seq scan.
CREATE INDEX IF NOT EXISTS idx_bookings_patient_mode
  ON bookings(patient_id, consultation_mode);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verify:
--   SELECT consultation_mode, COUNT(*) FROM bookings GROUP BY 1;
