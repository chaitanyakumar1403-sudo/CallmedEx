-- ============================================================================
-- DEMO DATA — LOCAL AND QA ONLY. DO NOT RUN AGAINST PRODUCTION.
-- ============================================================================
-- This file inserts organizations with verification_status = 'verified' and a
-- password_hash of 'x'. Anything it creates is bookable by real patients and
-- appears in provider search as a genuine, verified facility.
--
-- It HAS been run against production at least once: the rows below previously
-- read "Vizag Diagnostics Center" and "Pending Labs", and patients saw the
-- former offered as a real diagnostic centre in the booking flow. The names are
-- now prefixed so that can never be mistaken again, but renaming this file does
-- not remove rows already inserted elsewhere — see database/cleanup_demo_seed.sql.
-- ============================================================================

-- Demo data for Layer 0 QA. Idempotent-ish via fixed UUIDs.
INSERT INTO users (id, full_name, email, mobile, password_hash, role, city, state)
VALUES
 ('11111111-1111-1111-1111-111111111111','[DEMO DATA] Test Diagnostic Centre','demo-org1@callmedex.test','9000000001','x','organization','Visakhapatnam','AP'),
 ('22222222-2222-2222-2222-222222222222','[DEMO DATA] Pending Test Lab','demo-org2@callmedex.test','9000000002','x','organization','Visakhapatnam','AP')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, user_id, organization_name, organization_type, verification_status)
VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','[DEMO DATA] Test Diagnostic Centre','diagnostic_center','verified'),
 ('aaaaaaaa-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','[DEMO DATA] Pending Test Lab','diagnostic_center','pending')
ON CONFLICT (id) DO NOTHING;

INSERT INTO provider_settings (provider_user_id, home_service_enabled, is_listed)
VALUES ('11111111-1111-1111-1111-111111111111', true, true)
ON CONFLICT (provider_user_id) DO NOTHING;

INSERT INTO provider_services (provider_user_id, name, category, base_price, home_available)
VALUES ('11111111-1111-1111-1111-111111111111','CBC','lab_test',299,true)
ON CONFLICT DO NOTHING;
