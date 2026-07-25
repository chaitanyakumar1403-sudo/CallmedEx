-- ============================================================================
-- Commercial terms alignment with the signed partner MOUs
--
-- 1. Platform fee is 20%, not the 15% that provider_settings has defaulted to
--    since Layer 0. Every MOU says 20% (dental §3.1 and §7, and the identical
--    20%/80% table in the doctor, physiotherapy and nursing agreements).
--
-- 2. Patient discounts are funded from CallMedex's 20% platform fee, never from
--    the partner's share: "The Dental Clinic/Hospital shall not be required to
--    bear any additional discount beyond the agreed commercial arrangement."
--    A partner_discount_pct above the platform fee would silently eat into the
--    partner's 80%, so it is constrained here as well as in application code.
--
-- 3. Urgent booking is confirmed to carry an extra charge and to rank first in
--    dispatch, but the AMOUNT is not yet agreed. The config is therefore marked
--    unconfirmed and holds no invented figure — priority ordering still applies.
--
-- Idempotent. Existing partner-specific values are NOT overwritten; only the
-- platform-wide defaults move.
-- ============================================================================

BEGIN;

-- ─── 1. Platform fee: 15% -> 20% ─────────────────────────────────────────
ALTER TABLE provider_settings ALTER COLUMN commission_pct SET DEFAULT 20.00;

-- Only rows still sitting on the old default are moved. A partner who has
-- separately negotiated a different rate keeps it.
UPDATE provider_settings SET commission_pct = 20.00 WHERE commission_pct = 15.00;

UPDATE platform_settings
   SET value = '{"percent": 20}'::jsonb,
       description = 'Platform fee per partner MOU (dental §3.1, and the same 20%/80% table in the doctor, physiotherapy and nursing agreements).'
 WHERE key = 'default_platform_fee_pct';

-- ─── 2. Discount cannot exceed the platform fee that funds it ────────────
ALTER TABLE provider_settings DROP CONSTRAINT IF EXISTS provider_settings_discount_within_fee;
ALTER TABLE provider_settings ADD CONSTRAINT provider_settings_discount_within_fee
    CHECK (
        partner_discount_pct IS NULL
        OR commission_pct IS NULL
        OR (partner_discount_pct >= 0 AND partner_discount_pct <= commission_pct)
    );

-- ─── 3. Urgent surcharge: confirmed in principle, unpriced ───────────────
UPDATE platform_settings
   SET value = '{"mode":"flat","flat_inr":0,"percent":0,"min_inr":0,"max_inr":0,"confirmed":false}'::jsonb,
       description = 'Priority booking surcharge. Confirmed as an extra charge and ranked first in dispatch; rate not yet agreed, so no amount is quoted. Set confirmed=true with a real figure to enable.'
 WHERE key = 'urgent_surcharge';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verify:
--   SELECT commission_pct, COUNT(*) FROM provider_settings GROUP BY 1;
--   SELECT key, value FROM platform_settings
--    WHERE key IN ('urgent_surcharge','default_platform_fee_pct');
