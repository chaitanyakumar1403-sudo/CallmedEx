-- ============================================================================
-- Layer 0 — RLS / view hardening
-- Clears the two REAL Supabase database-linter findings. Safe to re-run.
-- The service_role key (used by the FastAPI backend) BYPASSES RLS, so none of
-- these changes affect backend functionality — they only lock out the public
-- anon/authenticated roles that should never have had access.
-- ============================================================================

-- 1) provider_directory view (linter 0010 security_definer_view, ERROR)
--    Run the view with the QUERYING role's permissions/RLS, not the creator's,
--    so it can no longer bypass RLS on the underlying tables. Postgres 15+.
ALTER VIEW public.provider_directory SET (security_invoker = on);

-- 2) password_resets over-permissive policy (linter 0024 rls_policy_always_true, WARN)
--    The existing "Service role manages password_resets" policy used
--    USING(true) WITH CHECK(true) for ALL roles, which let the public anon role
--    READ password-reset OTP codes and tokens (account-takeover vector).
--    The backend accesses this table with the service_role key (bypasses RLS),
--    so dropping the permissive policy restores deny-by-default for anon with
--    zero backend impact.
DROP POLICY IF EXISTS "Service role manages password_resets" ON public.password_resets;
