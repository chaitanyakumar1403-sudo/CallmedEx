-- ============================================================================
-- Remove the Layer 0 demo organizations from a database they should not be in.
-- ============================================================================
-- layer0_seed.sql inserts two organizations with fixed UUIDs and
-- verification_status = 'verified'. If it was ever run against production, real
-- patients can see and book them. Run this there.
--
-- Review before running. If either UUID has since been reused for a genuine
-- organization, or real bookings reference them, stop and resolve that first —
-- deleting a provider row with live bookings against it will orphan them.
--
-- Check first:
--   SELECT id, organization_name, verification_status FROM organizations
--    WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001',
--                 'aaaaaaaa-0000-0000-0000-000000000002');
--   SELECT count(*) FROM bookings WHERE provider_user_id IN (
--     '11111111-1111-1111-1111-111111111111',
--     '22222222-2222-2222-2222-222222222222');
-- ============================================================================

BEGIN;

DELETE FROM provider_settings WHERE provider_user_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222');

DELETE FROM organizations WHERE id IN (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002');

DELETE FROM users WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222');

-- Inspect the row counts above, then COMMIT. ROLLBACK if anything looks wrong.
COMMIT;
