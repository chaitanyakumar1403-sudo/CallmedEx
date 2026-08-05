-- Fix: Add patient_otp to store the plaintext 6-digit PIN so the patient dashboard can retrieve it.
-- The verification_otp stores the hash for verification by the provider, but the patient needs to see the PIN.
ALTER TABLE dispatch_requests
    ADD COLUMN IF NOT EXISTS patient_otp TEXT;

COMMENT ON COLUMN dispatch_requests.patient_otp IS
    'Plaintext 6-digit OTP code to be displayed on the patient dashboard when the provider arrives.';
