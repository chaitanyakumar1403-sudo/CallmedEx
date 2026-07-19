-- ============================================================================
-- CallMedex Database Schema Update (Admin & Supervisor Roles)
-- ============================================================================

-- This is a non-breaking addition. We add a 'managed_city' column to the users table.
-- If role = 'admin' and managed_city is NULL, the user is a Super Admin.
-- If role = 'admin' and managed_city is set (e.g. 'Visakhapatnam'), the user is a City Supervisor.

ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_city TEXT DEFAULT NULL;

-- Optional: Create an index on managed_city for faster filtering
CREATE INDEX IF NOT EXISTS idx_users_managed_city ON users(managed_city);
