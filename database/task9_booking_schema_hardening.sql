-- ============================================================================
-- CallMedex Schema Hardening: Prevent Race Conditions
-- Applying UNIQUE constraints and conditional unique indexes
-- ============================================================================

-- 1. Ensure slots are unique per provider and time
-- This prevents the same provider from having duplicate slot entries at the same time
ALTER TABLE slots DROP CONSTRAINT IF EXISTS uq_provider_slot_time;
ALTER TABLE slots ADD CONSTRAINT uq_provider_slot_time UNIQUE (provider_id, date, start_time);

-- 2. Prevent overlapping bookings for single-capacity providers (Doctors/Phlebos)
-- We use a partial unique index to only restrict active bookings.
-- Cancelled or rejected bookings shouldn't block new ones.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking_slot
ON bookings (provider_id, slot_start)
WHERE status NOT IN ('cancelled', 'slot_rejected', 'rejected', 'no_show')
AND provider_type IN ('doctor', 'phlebotomist');

-- Note: We exclude 'organization' from the unique index above because 
-- diagnostic centers often have multiple machines/staff and can handle 
-- multiple bookings at the exact same slot_start time.

-- 3. Prevent duplicate dispatch requests for the same booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_dispatch_per_booking
ON dispatch_requests (booking_id)
WHERE status NOT IN ('cancelled', 'failed');
