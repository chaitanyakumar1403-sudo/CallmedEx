-- ═══════════════════════════════════════════════════════════════════════════
-- Task 14 — Registration integrity & location canonicalisation
--
-- Why this exists
-- ---------------
-- `_build_profile_data` (backend/app/routers/auth.py) has been emitting three
-- columns that no table ever had. The insert was rejected by PostgREST and the
-- old `_create_role_profile` swallowed the error into an in-process dict, so
-- affected providers finished signup, could log in, and used their own
-- dashboards — while having NO row in `doctors` / `organizations`. Every
-- patient-facing search joins those tables, so those providers were invisible
-- to patients. One live doctor (25 published availability blocks, shown as
-- "DOCTOR VERIFIED" on their own workstation) was in exactly this state.
--
-- Idempotent — safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. The columns the signup payload has always sent ────────────────────
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS work_setting TEXT DEFAULT 'solo_clinic';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS is_independent BOOLEAN DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS official_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS official_email TEXT;

-- ── 2. Repair providers whose profile row was lost to the silent fallback ──
-- A user with a provider role and no profile row cannot be found by any
-- patient. Rebuild the row from what `users` still holds; verification_status
-- starts at 'pending' exactly as a fresh signup would, so nobody is silently
-- promoted to verified by a repair script.
INSERT INTO doctors (
    user_id, medical_license_number, specialization, qualification,
    years_of_experience, hospital_clinic_name, available_timings,
    consultation_mode, available_for_online, languages_spoken,
    verification_status
)
SELECT
    u.id, '', '', '', 0, '', '',
    -- 'pending', not 'verified': nobody has reviewed these credentials, and a
    -- migration must not make that call. The doctor completes the profile and
    -- an admin verifies, exactly as a fresh signup would.
    'both', TRUE, ARRAY['English']::text[], 'pending'
FROM users u
WHERE u.role = 'doctor'
  AND NOT EXISTS (SELECT 1 FROM doctors d WHERE d.user_id = u.id);

-- ── 3. District is the canonical location unit; city is derived ───────────
-- Deliberately NOT done here. "Visakhapatnam" is both a city and a district
-- and signup collected both as free text, so one place exists in the data as
-- 'Vizag', 'VISAKHAPATNAM', 'Visakhapatanam' and 'Vishakapatnam' with
-- 'Andhrapradesh' / 'Andhra Pradesh' / 'india' for the state. Collapsing those
-- needs the alias table, which lives in
-- backend/scripts/repair_location_and_profiles.py (run it after this file) and
-- in frontend/src/components/StateDistrictPicker.tsx, which is what stops new
-- signups from adding to the list. Plain SQL here would only mirror the
-- misspellings into a second column.

-- ── 4. Give every processing centre a position ────────────────────────────
-- `_ensure_base_location` falls back to the centre's coordinates when a
-- collector has no GPS fix and no geocodable address. The column existed but
-- was never populated, so that last resort always failed and every
-- phlebotomist stayed base_lat IS NULL — which made the advance roster pass
-- skip all of them and assign nobody, every night.
UPDATE processing_centers SET lat = 17.6868, lng = 83.2185
 WHERE lat IS NULL AND LOWER(TRIM(city)) IN ('visakhapatnam', 'vizag');

-- ── 5. One booking per patient per slot ───────────────────────────────────
-- The unique index that enforces this lives in task14b_booking_duplicate_guard.sql,
-- NOT here. Live duplicates already exist in production, so creating the index
-- in this file aborted the whole script (Supabase runs it as one transaction)
-- and rolled back every repair above it. task14b resolves those rows first,
-- and it is separated because closing somebody's booking is a decision an
-- operator should make deliberately, not a side effect of adding a column.
--
-- New duplicates are already blocked without any index: create_booking in
-- backend/app/routers/bookings.py returns the patient's existing booking
-- instead of writing a second one. The index is defence-in-depth against the
-- concurrent-request race that check cannot see.
