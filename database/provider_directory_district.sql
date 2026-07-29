-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: provider_directory gains `district`
-- Run in: Supabase SQL Editor (idempotent — safe to re-run)
--
-- Why: the Consultation page's Walk-in / Home Visit tabs filter providers by
-- State → District. Doctors get district from the /api/providers/search/doctors
-- join, but organisations come through the provider_directory view, which only
-- exposed city + state — a dental clinic in a district whose town name differs
-- from the district name was unfindable. Adding u.district makes org filtering
-- exact.
--
-- Notes:
--  * `district` is appended at the END of each SELECT branch — Postgres allows
--    CREATE OR REPLACE VIEW to add columns only at the end, and all three
--    UNION branches must stay positionally aligned.
--  * security_invoker=on is preserved (layer0_rls_hardening.sql set it;
--    dropping it would reintroduce Supabase linter 0010).
--  * No table changes, no data changes, no downtime.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW provider_directory WITH (security_invoker = on) AS
SELECT
    u.id AS provider_user_id,
    'organization' AS provider_type,
    o.organization_name AS display_name,
    o.organization_type AS subtype,
    u.city, u.state,
    NULL::double precision AS lat,
    NULL::double precision AS lng,
    5.0::real AS rating,
    o.verification_status,
    COALESCE(ps.is_listed, true) AS is_listed,
    COALESCE(ps.home_service_enabled, false) AS home_service_enabled,
    u.district
FROM organizations o
JOIN users u ON u.id = o.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(o.organization_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'doctor', u.full_name, d.specialization,
    u.city, u.state, NULL, NULL, d.rating, d.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, false),
    u.district
FROM doctors d
JOIN users u ON u.id = d.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(u.full_name), ''), '') <> ''
UNION ALL
SELECT
    u.id, 'pharmacy', ph.pharmacy_name, ph.pharmacy_type,
    u.city, u.state, NULL, NULL, 5.0, ph.verification_status,
    COALESCE(ps.is_listed, true), COALESCE(ps.home_service_enabled, ph.home_delivery),
    u.district
FROM pharmacies ph
JOIN users u ON u.id = ph.user_id
LEFT JOIN provider_settings ps ON ps.provider_user_id = u.id
WHERE COALESCE(NULLIF(TRIM(ph.pharmacy_name), ''), '') <> '';

-- Verify: expect 'district' as the last column.
-- SELECT column_name, ordinal_position FROM information_schema.columns
--  WHERE table_name = 'provider_directory' ORDER BY ordinal_position;
