-- ===========================================================================
-- CallMedex Performance Index Migration
-- Adds critical indexes for query performance on frequently filtered columns.
-- Run: psql <DATABASE_URL> -f perf_indexes.sql
-- ===========================================================================

BEGIN;

-- ─── Bookings: status + provider filters (most-common query patterns) ───────
CREATE INDEX IF NOT EXISTS idx_bookings_patient_id_status
    ON bookings(patient_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_provider_id_status
    ON bookings(provider_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_status_created
    ON bookings(status, created_at DESC);

-- ─── Dispatch Requests: status + provider filters ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_dispatch_requests_status
    ON dispatch_requests(status);

CREATE INDEX IF NOT EXISTS idx_dispatch_requests_assigned_provider_status
    ON dispatch_requests(assigned_provider_id, status);

CREATE INDEX IF NOT EXISTS idx_dispatch_requests_booking_id
    ON dispatch_requests(booking_id);

-- ─── Dispatch Offers: status + provider filters ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dispatch_offers_provider_status
    ON dispatch_offers(provider_id, status);

CREATE INDEX IF NOT EXISTS idx_dispatch_offers_dispatch_status
    ON dispatch_offers(dispatch_request_id, status);

-- ─── Provider Locations: online status + type (core dispatch query) ─────────
CREATE INDEX IF NOT EXISTS idx_provider_locations_online_type
    ON provider_locations(is_online, provider_type);

CREATE INDEX IF NOT EXISTS idx_provider_locations_user_id
    ON provider_locations(user_id);

-- ─── Users: role + registration status ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_role_status
    ON users(role, registration_status);

-- ─── Booking Subjects & Tests (FKs for home collection queries) ─────────────
CREATE INDEX IF NOT EXISTS idx_booking_subjects_booking_id
    ON booking_subjects(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_tests_booking_id
    ON booking_tests(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_tests_subject_id
    ON booking_tests(booking_subject_id);

-- ─── Payments: status + patient lookups ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_patient_id_status
    ON payments(patient_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id
    ON payments(razorpay_order_id);

-- ─── Notifications: user lookups ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications(user_id);

-- ─── Password Resets: user + email lookups ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id
    ON password_resets(user_id, used);

CREATE INDEX IF NOT EXISTS idx_password_resets_email_otp
    ON password_resets(email, otp_code, used);

-- ─── Consent Records: user + type lookups ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_consent_records_user_type
    ON consent_records(user_id, consent_type, consented_at DESC);

-- ─── Samples: barcode + status ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_samples_barcode
    ON samples(barcode);

CREATE INDEX IF NOT EXISTS idx_samples_status
    ON samples(status);

-- ─── Phlebotomists: duty + centre lookups ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_phlebotomists_on_duty_centre
    ON phlebotomists(on_duty, processing_center_id);

-- ─── Enable PostGIS extension for spatial queries (if not already enabled) ──
-- Uncomment and run separately if PostGIS is not yet available:
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── Add GEOGRAPHY column for spatial indexing (PostGIS required) ───────────
-- Uncomment after PostGIS is enabled:
-- ALTER TABLE provider_locations
--     ADD COLUMN IF NOT EXISTS geog GEOGRAPHY(Point, 4326);
--
-- UPDATE provider_locations
--     SET geog = ST_SetSRID(ST_MakePoint(current_lng, current_lat), 4326)::GEOGRAPHY
--     WHERE current_lat IS NOT NULL AND current_lng IS NOT NULL AND geog IS NULL;
--
-- CREATE INDEX IF NOT EXISTS idx_provider_locations_geog
--     ON provider_locations USING GIST(geog);

COMMIT;