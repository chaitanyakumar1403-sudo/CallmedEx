-- ============================================================================
-- Dental and physiotherapy provider types
--
-- The catalogue now carries 298 dental and 94 physiotherapy services, but
-- organizations.organization_type only allowed hospital / clinic /
-- diagnostic_center / poly_clinic. A dental clinic or physiotherapy centre had
-- nowhere truthful to register, so their services could never be attributed to
-- the right kind of provider and a patient searching "root canal" would find
-- the service but no one offering it.
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_organization_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_organization_type_check
  CHECK (organization_type IN (
    'clinic',
    'polyclinic',
    'poly_clinic',          -- both spellings have been in use historically
    'hospital',
    'diagnostic_center',
    'dental_clinic',
    'physiotherapy_center',
    'nursing_home'
  ));

-- provider_directory reads organization_type straight through as `subtype`, so
-- marketplace filtering by the new types works with no view change. Refreshed
-- here only so PostgREST re-reads it.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verify:
--   SELECT organization_type, COUNT(*) FROM organizations GROUP BY 1;
