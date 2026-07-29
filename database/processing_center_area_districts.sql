-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: district-level processing-centre resolution
-- Run in: Supabase SQL Editor (idempotent — safe to re-run)
--
-- Why: Book a Test now captures State → District (never free text). Until now
-- a home-collection booking resolved its processing centre by pincode, then
-- exact city, then geo radius — so a patient in a small TOWN inside a covered
-- district (e.g. Bheemunipatnam in Visakhapatnam district) resolved to
-- "unserviceable" even though the district's centre covers them. A district
-- column on processing_center_areas closes that gap:
-- resolution order becomes pincode → city → district → radius.
--
-- Also adds bookings.collection_district so the booking flow can carry the
-- patient's district through to assignment (additive; empty until the booking
-- form starts sending it).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. District on serviceable areas (normalised lowercase, same as `city`).
ALTER TABLE processing_center_areas
    ADD COLUMN IF NOT EXISTS district TEXT;

CREATE INDEX IF NOT EXISTS idx_pc_areas_district
    ON processing_center_areas(district) WHERE is_active;

-- 2. Backfill: the current rollout is one metro per centre (HYD-01, VSP-01),
--    where city name == district name, so city is the correct district.
--    When you add centres covering smaller towns, set the real district:
--    UPDATE processing_center_areas SET district = 'visakhapatnam'
--     WHERE city = 'bheemunipatnam';
UPDATE processing_center_areas
   SET district = city
 WHERE district IS NULL
   AND city IS NOT NULL
   AND city <> '';

-- 3. Bookings carry the patient's district for assignment-time resolution.
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS collection_district TEXT DEFAULT '';

-- Verify:
-- SELECT code, city, district FROM processing_center_areas;
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'bookings' AND column_name = 'collection_district';
