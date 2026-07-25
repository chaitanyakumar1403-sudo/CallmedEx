-- ============================================================================
-- Phase 5 — link existing provider services to the canonical test catalogue
--
-- provider_services rows created before service_catalog existed carry
-- catalog_id = NULL. The marketplace still finds them via a name fallback, but
-- the browse grid ranks tests by how many partners offer them, and that count
-- reads zero until the link exists.
--
-- Matching is deliberately conservative: exact name, then exact synonym, then a
-- whole-word containment. A loose match here would put a partner's "MRI Brain
-- With Contrast" under plain "X-Ray" and misprice a patient's booking, so
-- anything ambiguous is left NULL for a human to map.
--
-- Idempotent: only ever fills NULLs, never overwrites an existing mapping.
-- ============================================================================

BEGIN;

-- 1) Exact name match, case- and whitespace-insensitive.
UPDATE provider_services ps
   SET catalog_id = sc.id
  FROM service_catalog sc
 WHERE ps.catalog_id IS NULL
   AND sc.is_active
   AND LOWER(TRIM(ps.name)) = LOWER(TRIM(sc.name));

-- 2) Exact synonym match — "CBC" and "Haemogram" both resolve to
--    Complete Blood Count.
UPDATE provider_services ps
   SET catalog_id = sc.id
  FROM service_catalog sc
 WHERE ps.catalog_id IS NULL
   AND sc.is_active
   AND EXISTS (
       SELECT 1 FROM unnest(sc.synonyms) AS syn
        WHERE LOWER(TRIM(syn)) = LOWER(TRIM(ps.name))
   );

-- 3) Whole-word containment, and only where exactly ONE catalogue entry
--    matches. "Complete Blood Count (CBC)" resolves; anything matching two
--    entries is left for manual mapping rather than guessed at.
UPDATE provider_services ps
   SET catalog_id = m.catalog_id
  FROM (
      SELECT ps2.id AS service_id, MIN(sc.id::text)::uuid AS catalog_id
        FROM provider_services ps2
        JOIN service_catalog sc
          ON sc.is_active
         AND LOWER(ps2.name) ~ ('\m' || LOWER(sc.name) || '\M')
       WHERE ps2.catalog_id IS NULL
       GROUP BY ps2.id
      HAVING COUNT(DISTINCT sc.id) = 1
  ) m
 WHERE ps.id = m.service_id
   AND ps.catalog_id IS NULL;

-- 4) Any partner still without an MRP is treated as pricing at their base
--    price, so they remain comparable in search with no advertised saving.
UPDATE provider_services
   SET mrp = base_price
 WHERE mrp IS NULL;

COMMIT;

-- Review what remains unmapped, for manual attention:
--   SELECT id, provider_user_id, name
--     FROM provider_services
--    WHERE catalog_id IS NULL AND is_active;
