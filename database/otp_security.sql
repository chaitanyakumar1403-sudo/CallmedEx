-- ===========================================================================
-- OTP Security Columns — Brute-Force Protection
-- Adds attempt tracking and lockout columns to dispatch_requests.
-- Required by the fixed OTP service with rate limiting.
-- ===========================================================================

ALTER TABLE dispatch_requests
    ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS otp_locked_until TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN dispatch_requests.otp_attempts IS
    'Number of failed OTP verification attempts (resets on successful verification)';

COMMENT ON COLUMN dispatch_requests.otp_locked_until IS
    'If set, OTP verification is locked until this timestamp (brute-force protection)';

-- The verification_otp column should now store a SHA-256 hash, not plaintext
COMMENT ON COLUMN dispatch_requests.verification_otp IS
    'SHA-256 hash of the 6-digit OTP code (NOT plaintext)';