-- Fix: verification_otp was sized for a plaintext 6-digit code (varchar(10)).
-- otp_security.sql later switched its content to a SHA-256 hash (64 hex
-- chars) without widening the column. Every OTP generation since then has
-- silently failed to persist (Postgres rejects the whole UPDATE — including
-- patient_otp in the same statement), so the patient dashboard never has a
-- code to show and the provider's /verify-otp step can never succeed.
ALTER TABLE dispatch_requests
    ALTER COLUMN verification_otp TYPE TEXT;
