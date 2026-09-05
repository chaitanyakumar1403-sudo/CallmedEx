-- ═══════════════════════════════════════════════════════════════════════════
-- RLS audit — read-only. Run in the Supabase SQL editor.
--
-- Context for the `rls_enabled_no_policy` linter finding on public.dentists
-- ------------------------------------------------------------------------
-- That finding is INFO for a reason, and on this project it is the SAFE state,
-- not a bug:
--
--   * RLS enabled + no policy  =  deny everything to anon/authenticated.
--   * RLS disabled             =  allow everything to anon/authenticated.
--
-- The Supabase anon key is PUBLIC BY DESIGN — it ships to browsers. Anything
-- reachable with it is reachable by anyone who has the project URL. So the
-- rows worth acting on are the ones the query below returns with
-- rls_enabled = false, NOT `dentists`.
--
-- Adding a policy to `dentists` would LOOSEN it. Do that only if something is
-- actually meant to read it with a non-service key. Today nothing is:
--   * backend/app/database.py builds its client with SUPABASE_SERVICE_KEY,
--     which bypasses RLS entirely;
--   * get_supabase_anon_client() exists but has no callers
--     (grep -rn "get_supabase_anon_client" backend/app);
--   * the frontend never talks to Supabase directly — no NEXT_PUBLIC_SUPABASE_*
--     and no createClient() anywhere in frontend/src.
--
-- So `dentists` being deny-all breaks nothing and costs nothing. Leave it.
-- ═══════════════════════════════════════════════════════════════════════════

-- Every public table, whether RLS is on, and how many policies it has.
-- Read the top of the list first: rls_enabled = false is the exposed state.
SELECT
    c.relname                                  AS table_name,
    c.relrowsecurity                           AS rls_enabled,
    COUNT(p.polname)                           AS policy_count,
    CASE
        WHEN NOT c.relrowsecurity
            THEN 'EXPOSED — readable/writable with the public anon key'
        WHEN COUNT(p.polname) = 0
            THEN 'deny-all (safe; only the service key can reach it)'
        ELSE 'policied'
    END                                        AS posture
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
 GROUP BY c.relname, c.relrowsecurity
 ORDER BY c.relrowsecurity ASC, policy_count ASC, c.relname;

-- ── QUERY 2 — the one that actually matters ───────────────────────────────
-- "RLS enabled with 1 policy" says nothing about what that policy permits. A
-- policy with no TO clause defaults to TO PUBLIC (anon + authenticated), and
-- USING (true) then permits everything to everyone — RLS is on, a policy
-- exists, the linter is satisfied, and the table is wide open.
--
-- That is not hypothetical here: password_resets shipped with
--   FOR ALL USING (true) WITH CHECK (true)
-- and no TO clause, exposing otp_code and reset_token to anyone with the
-- public anon key. Query 1 reported it as "policied".
-- database/task14c_password_reset_rls.sql drops it.
--
-- Read every row this returns. FOR SELECT on genuinely public directory data
-- (a doctor's published availability, a listed tariff) is fine. Anything with
-- cmd = ALL/INSERT/UPDATE/DELETE, or any SELECT over credentials, tokens,
-- payments or health data, is not.
SELECT
    c.relname                                   AS table_name,
    p.polname                                   AS policy_name,
    CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                  WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
                  ELSE 'ALL' END                AS cmd,
    COALESCE(
        (SELECT string_agg(r.rolname, ', ') FROM pg_roles r WHERE r.oid = ANY(p.polroles)),
        'PUBLIC (anon + authenticated)'
    )                                           AS granted_to,
    pg_get_expr(p.polqual, p.polrelid)          AS using_expr,
    pg_get_expr(p.polwithcheck, p.polrelid)     AS with_check_expr
  FROM pg_policy p
  JOIN pg_class c     ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   -- Unrestricted: no USING clause, or one that is literally true.
   AND (p.polqual IS NULL OR pg_get_expr(p.polqual, p.polrelid) = 'true')
 ORDER BY (p.polcmd <> 'r') DESC, c.relname;   -- non-SELECT first: worst first


-- ── Remediation notes ────────────────────────────────────────────────────
-- If the first query shows tables with rls_enabled = false, the blanket fix is
-- to turn RLS on for them and add no policy — deny-all, matching `dentists`.
-- The backend keeps working because it uses the service key. Review the list
-- BEFORE running anything like this, and add policies only where a non-service
-- key genuinely needs access:
--
--   ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
--
-- database/nextgen_rls_fix.sql has the policy patterns already used here
-- (owner-reads-own-rows, admin-reads-all) if you do need one.
