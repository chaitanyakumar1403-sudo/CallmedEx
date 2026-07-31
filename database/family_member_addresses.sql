-- ═══════════════════════════════════════════════════════════════════════════
-- Family Members Address Support
-- Adds address fields to family_members so that when a booking is made for
-- a family member (e.g. a parent in a different city), their address is used
-- for phlebotomist dispatch rather than the account holder's address.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE family_members
    ADD COLUMN IF NOT EXISTS address  TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS city     TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS district TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS state    TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS pincode  TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS lat      DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS lng      DOUBLE PRECISION;