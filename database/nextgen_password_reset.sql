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

-- NO POLICY, deliberately. RLS on with zero policies denies `anon` and
-- `authenticated` outright, which is exactly what a table of password-reset
-- OTPs and reset tokens needs.
--
-- There used to be a "Service role manages password_resets" policy here,
-- FOR ALL USING (true) WITH CHECK (true). The service role BYPASSES RLS and
-- never needed it — and a policy with no TO clause defaults to TO PUBLIC, so
-- it handed anyone holding the (public by design) anon key full read/write on
-- otp_code, reset_token and email: account takeover for every account on the
-- platform. See database/task14c_password_reset_rls.sql, which drops it from
-- environments that already ran this file.
--
-- The backend reaches this table with SUPABASE_SERVICE_KEY
-- (backend/app/database.py), so it is unaffected by there being no policy.

-- Auto-cleanup: Delete expired reset records older than 24 hours
-- (Optional: run as a scheduled cron job in Supabase)
-- DELETE FROM password_resets WHERE expires_at < now() - interval '24 hours';
