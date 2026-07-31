-- ===========================================================================
-- Token Revocation Support — token_version column
-- Allows invalidating all existing JWTs for a user by incrementing the version.
-- Run: psql <DATABASE_URL> -f database/token_version.sql
-- ===========================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1;

COMMENT ON COLUMN users.token_version IS
    'Incremented on password change, logout, or admin-forced session invalidation. JWTs with a lower version are rejected.';