-- ═══════════════════════════════════════════════════════════════════════════
-- Task 14c — SECURITY: close public read/write on password_resets
--
-- RUN THIS FIRST, ahead of the other task14 files.
--
-- What is wrong
-- -------------
-- database/nextgen_password_reset.sql creates:
--
--     CREATE POLICY "Service role manages password_resets"
--         ON password_resets FOR ALL USING (true) WITH CHECK (true);
--
-- The comment says "allow the service role (backend) to manage all reset
-- records" — but the service role BYPASSES RLS and never needed a policy. A
-- policy with no TO clause defaults to TO PUBLIC, which includes `anon` and
-- `authenticated`. The Supabase anon key is public by design (it ships to
-- browsers), so this grants anyone holding it full SELECT/INSERT/UPDATE/DELETE
-- on the table that stores password-reset OTPs and reset tokens:
--
--     otp_code, reset_token, email, user_id
--
-- That is a direct account-takeover path for every account on the platform:
-- request a reset for any email, read the OTP straight out of the table,
-- complete the reset. It also allows inserting a reset row for an arbitrary
-- account. This is patient health data behind those accounts.
--
-- The linter did not flag it. `rls_enabled_no_policy` only looks for tables
-- with ZERO policies, and this table has one — it just happens to be a policy
-- that permits everything to everyone. (`dentists`, the table the linter DID
-- flag, is the safe case: RLS on, no policy, deny-all.)
--
-- The fix
-- -------
-- Drop the policy. RLS stays enabled with no policy, which denies anon and
-- authenticated entirely; the backend is unaffected because it connects with
-- SUPABASE_SERVICE_KEY (see backend/app/database.py) and bypasses RLS.
--
-- Idempotent — safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages password_resets" ON password_resets;

-- Verify: expect rls_enabled = true and policy_count = 0.
SELECT c.relrowsecurity AS rls_enabled, COUNT(p.polname) AS policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
 WHERE n.nspname = 'public' AND c.relname = 'password_resets'
 GROUP BY c.relrowsecurity;

-- Any reset row that was exposed while the policy was live should be treated
-- as compromised. These are short-lived OTPs, so the cheapest safe action is
-- to burn every unused one and make people request a fresh reset.
UPDATE password_resets
   SET used = TRUE
 WHERE used = FALSE;
