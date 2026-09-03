-- ============================================================================
-- CallMedex Phase 0 Migration: Mobile Auth & Device Token Prerequisites
-- Supports:
--   1. Patient Phone Uniqueness (Partial index on users.mobile for patient role)
--   2. Device Push Tokens (FCM/APNs registration)
--   3. Biometric Device Credentials (Public Key & Challenge Auth)
--   4. Refresh Token Tracking & Invalidation
-- ============================================================================

-- 1. Ensure token_version column exists on users table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'token_version'
    ) THEN
        ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1 NOT NULL;
    END IF;
END $$;

-- 2. Safe Deduplication for Pre-Existing Patient Mobile Numbers
-- If test runs created duplicate patient rows with the same mobile (e.g. +919876543210),
-- retain the most recently updated/created record as active and suffix older duplicates
-- so historical foreign key integrity is preserved without blocking the unique index.
DO $$
BEGIN
    WITH ranked_patients AS (
        SELECT id, mobile,
               ROW_NUMBER() OVER (
                   PARTITION BY mobile 
                   ORDER BY created_at DESC NULLS LAST, id DESC
               ) as rn
        FROM users
        WHERE role = 'patient' AND mobile IS NOT NULL AND mobile <> ''
    )
    UPDATE users u
    SET mobile = u.mobile || '_dup_' || SUBSTRING(u.id::text, 1, 8)
    FROM ranked_patients rp
    WHERE u.id = rp.id AND rp.rn > 1;
END $$;

-- 3. Partial Unique Index on users.mobile for Patients
-- Prevents duplicate patient records while allowing providers with same contact to exist safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_users_mobile_patient'
    ) THEN
        CREATE UNIQUE INDEX idx_users_mobile_patient
        ON users (mobile)
        WHERE role = 'patient' AND mobile IS NOT NULL AND mobile <> '';
    END IF;
END $$;

-- 4. Device Tokens Table (FCM & APNs Push Notifications)
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    push_token TEXT NOT NULL,
    device_name TEXT DEFAULT '',
    app_version TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_device_token UNIQUE (user_id, push_token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_push_token ON device_tokens(push_token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(is_active) WHERE is_active = TRUE;

-- 5. Biometric Credentials Table
CREATE TABLE IF NOT EXISTS biometric_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    device_name TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT uq_user_biometric_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_biometric_credentials_user ON biometric_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_biometric_credentials_device ON biometric_credentials(device_id);

-- 6. User Refresh Tokens Table (Optional server tracking in addition to token_version)
CREATE TABLE IF NOT EXISTS user_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    device_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_refresh_tokens_user ON user_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_refresh_tokens_hash ON user_refresh_tokens(token_hash);

-- 7. Row Level Security (RLS)
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Device tokens & credentials policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'device_tokens_user_policy') THEN
        CREATE POLICY device_tokens_user_policy ON device_tokens
            FOR ALL USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'biometric_user_policy') THEN
        CREATE POLICY biometric_user_policy ON biometric_credentials
            FOR ALL USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'refresh_tokens_user_policy') THEN
        CREATE POLICY refresh_tokens_user_policy ON user_refresh_tokens
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;
