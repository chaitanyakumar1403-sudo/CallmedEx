-- ============================================================================
-- CallMedex — Supabase linter follow-up to schema_sync_patch.sql
-- Clears: 0011 function_search_path_mutable (WARN)  x1
--         0008 rls_enabled_no_policy        (INFO)  x9
--
-- Idempotent. Safe to re-run.
--
-- Context: the FastAPI backend connects with SUPABASE_SERVICE_KEY, which has
-- BYPASSRLS. The Next.js frontend has NO Supabase client at all (verified: no
-- @supabase/supabase-js dependency, no NEXT_PUBLIC_SUPABASE_* vars) — it talks
-- only to FastAPI via frontend/src/lib/api.ts. Nothing therefore reaches these
-- tables as anon/authenticated, so deny-by-default is the correct end state.
-- ============================================================================

BEGIN;

-- ─── 1. WARN 0011 — sync_booking_date_time has a mutable search_path ──────
-- A trigger function without a pinned search_path can be hijacked: a role able
-- to create objects in a schema earlier on the resolution path could shadow an
-- unqualified function/operator the body relies on, and the body then runs with
-- the caller's privileges on every booking INSERT/UPDATE.
--
-- Fix: pin search_path to '' and resolve everything explicitly. pg_catalog is
-- always searched implicitly, so to_char / the ::date cast / AT TIME ZONE all
-- still resolve; qualifying to_char makes that intent unambiguous.
--
-- CREATE OR REPLACE keeps the existing trigger binding (triggers reference the
-- function by OID), so trg_sync_booking_date_time does NOT need recreating.
CREATE OR REPLACE FUNCTION public.sync_booking_date_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF NEW.slot_start IS NOT NULL THEN
        NEW.booking_date := (NEW.slot_start AT TIME ZONE 'Asia/Kolkata')::date;
        NEW.slot_time    := pg_catalog.to_char(
                                NEW.slot_start AT TIME ZONE 'Asia/Kolkata',
                                'HH24:MI'
                            );
    END IF;
    RETURN NEW;
END;
$$;

-- ─── 2. INFO 0008 — RLS enabled with zero policies on 9 tables ────────────
-- These tables already deny everything (RLS on + no policy = deny), so this is
-- an advisory, not a hole. But "no policy" and "deliberately deny-all" look
-- identical to the linter and to the next person reading the schema. Writing
-- the deny explicitly records the intent and clears the finding.
--
-- USING (false) covers SELECT/UPDATE/DELETE; WITH CHECK (false) covers
-- INSERT/UPDATE. Role `public` covers anon + authenticated. service_role holds
-- BYPASSRLS and is unaffected, so the backend keeps full access.
--
-- Matches the "Deny all access" convention already used for doctors, documents,
-- health_packages, organizations, pharmacies, phlebotomists, slots and staff.

DO $$
DECLARE
    t TEXT;
    deny_tables TEXT[] := ARRAY[
        -- Credential material. Must never be readable by anon: the dropped
        -- "Service role manages password_resets" policy (USING true) previously
        -- exposed OTP codes and reset tokens — an account-takeover vector.
        'password_resets',
        -- Layer 0 marketplace tables. RLS was switched on by the project's
        -- rls_auto_enable() event trigger, not by layer0_foundation.sql, which
        -- is why they arrived policy-less.
        'provider_availability',
        'provider_blocked_dates',
        'provider_branches',
        'provider_packages',
        'provider_services',
        'provider_settings',
        'provider_slots',
        -- Verification authority record: AI + government-registry decisions and
        -- reviewer identity. Admin-only by design, served through FastAPI.
        'verification_reviews'
    ];
BEGIN
    FOREACH t IN ARRAY deny_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Deny all access" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Deny all access" ON public.%I '
            'FOR ALL TO public USING (false) WITH CHECK (false)', t
        );
    END LOOP;
END;
$$;

COMMIT;

-- ─── 3. Verify ────────────────────────────────────────────────────────────
-- Expect 9 rows, each with policy_count = 1:
--
--   SELECT tablename, COUNT(policyname) AS policy_count
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('password_resets','provider_availability',
--                        'provider_blocked_dates','provider_branches',
--                        'provider_packages','provider_services',
--                        'provider_settings','provider_slots',
--                        'verification_reviews')
--    GROUP BY tablename ORDER BY tablename;
--
-- Expect search_path pinned to "" :
--
--   SELECT proname, proconfig FROM pg_proc
--    WHERE proname = 'sync_booking_date_time';

-- ============================================================================
-- IMPORTANT — do NOT "fix" this by adding permissive read policies.
-- If you later add a direct browser→Supabase client (e.g. for Realtime dispatch
-- tracking), grant narrow per-table SELECT policies scoped to auth.uid() at that
-- point. Blanket USING (true) on provider_* would expose your entire provider
-- catalogue, pricing and commission_pct to any anon key holder.
-- ============================================================================
