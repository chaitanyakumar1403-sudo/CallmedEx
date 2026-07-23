-- ================================================================
-- CallMedex: Password Reset Table
-- Run this in your Supabase SQL Editor
-- ================================================================

-- Create the password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    reset_token TEXT NOT NULL,
    used BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_otp ON password_resets(email, otp_code, used);

-- Row Level Security
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Allow the service role (backend) to manage all reset records
CREATE POLICY "Service role manages password_resets"
    ON password_resets
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Auto-cleanup: Delete expired reset records older than 24 hours
-- (Optional: run as a scheduled cron job in Supabase)
-- DELETE FROM password_resets WHERE expires_at < now() - interval '24 hours';
