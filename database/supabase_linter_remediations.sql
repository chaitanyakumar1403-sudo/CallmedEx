-- ============================================================================
-- CallMedex — Supabase Linter Remediations
--
-- Resolves:
-- 1. WARN: Lint 0011 (function_search_path_mutable) on `sync_booking_date_time`
-- 2. INFO: Lint 0008 (rls_enabled_no_policy) on `dietitians`
-- 3. INFO: Lint 0008 (rls_enabled_no_policy) on `physiotherapists`
--
-- Idempotent and production safe.
-- ============================================================================

BEGIN;

-- ─── 1. Fix Function Search Path Mutable (Lint 0011) ────────────────────────
-- Pin search_path to public, pg_temp to prevent privilege escalation / search-path hijacking
CREATE OR REPLACE FUNCTION public.sync_booking_date_time()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.slot_start IS NOT NULL THEN
        NEW.booking_date := (NEW.slot_start AT TIME ZONE 'Asia/Kolkata')::date;
        NEW.slot_time    := to_char(NEW.slot_start AT TIME ZONE 'Asia/Kolkata', 'HH24:MI');
    END IF;
    RETURN NEW;
END;
$$;

-- ─── 2. Add RLS Policies for Dietitians (Lint 0008) ─────────────────────────
ALTER TABLE public.dietitians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dietitians_select_public" ON public.dietitians;
CREATE POLICY "dietitians_select_public" ON public.dietitians
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "dietitians_manage_own" ON public.dietitians;
CREATE POLICY "dietitians_manage_own" ON public.dietitians
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ─── 3. Add RLS Policies for Physiotherapists (Lint 0008) ───────────────────
ALTER TABLE public.physiotherapists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "physiotherapists_select_public" ON public.physiotherapists;
CREATE POLICY "physiotherapists_select_public" ON public.physiotherapists
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "physiotherapists_manage_own" ON public.physiotherapists;
CREATE POLICY "physiotherapists_manage_own" ON public.physiotherapists
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

COMMIT;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
