-- ─────────────────────────────────────────────────────────────────────────
-- Provider ratings — the store behind every star CallMedex shows.
--
-- Before this, `nurses.rating REAL DEFAULT 5.0`, `acceptance_rate DEFAULT
-- 100.0` and `total_completed DEFAULT 0` existed on the role tables and
-- nothing ever wrote to them, so every provider read back a flat 5.0 that no
-- patient had given. The dispatch engine ranked on distance alone and its own
-- comment marked rating as future work.
--
-- One row per rated visit. Aggregates are computed from these rows rather
-- than kept as a running column, so a figure on screen can always be traced
-- to the visits that produced it.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS provider_ratings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dispatch_request_id UUID,
    booking_id          UUID,
    stars               SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment             TEXT DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One rating per visit. A patient may change their mind (the app upserts),
    -- but they cannot stack five ratings onto one collection.
    CONSTRAINT provider_ratings_one_per_dispatch
        UNIQUE (dispatch_request_id, patient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_ratings_provider
    ON provider_ratings(provider_user_id);
CREATE INDEX IF NOT EXISTS idx_provider_ratings_created
    ON provider_ratings(provider_user_id, created_at DESC);

-- Convenience aggregate. The backend can read this directly instead of
-- pulling every row to average them.
-- security_invoker=on ensures the view executes with the querying role's permissions/RLS,
-- clearing Supabase Database Linter error 0010 (security_definer_view).
CREATE OR REPLACE VIEW provider_rating_summary WITH (security_invoker = on) AS
SELECT
    provider_user_id,
    ROUND(AVG(stars)::numeric, 2)::real AS average_stars,
    COUNT(*)::int                       AS rating_count,
    MAX(created_at)                     AS last_rated_at
FROM provider_ratings
GROUP BY provider_user_id;

-- ── Retire the fabricated defaults ───────────────────────────────────────
-- A provider with no ratings must read as "no rating yet" (NULL), never as a
-- perfect 5.0 nobody awarded. Only the default for new rows changes, and
-- untouched 5.0/100.0 placeholders are cleared so they stop being displayed
-- as real figures.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['nurses', 'phlebotomists', 'doctors'] LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = t AND column_name = 'rating'
        ) THEN
            EXECUTE format('ALTER TABLE %I ALTER COLUMN rating DROP DEFAULT', t);
            EXECUTE format('UPDATE %I SET rating = NULL WHERE rating = 5.0', t);
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = t AND column_name = 'acceptance_rate'
        ) THEN
            EXECUTE format('ALTER TABLE %I ALTER COLUMN acceptance_rate DROP DEFAULT', t);
            EXECUTE format('UPDATE %I SET acceptance_rate = NULL WHERE acceptance_rate = 100.0', t);
        END IF;
    END LOOP;
END $$;

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE provider_ratings ENABLE ROW LEVEL SECURITY;

-- A patient sees and writes only their own ratings.
DROP POLICY IF EXISTS provider_ratings_own_patient ON provider_ratings;
CREATE POLICY provider_ratings_own_patient ON provider_ratings
    FOR ALL
    USING (patient_user_id = auth.uid())
    WITH CHECK (patient_user_id = auth.uid());

-- A provider may read the ratings written about them, but never edit them.
DROP POLICY IF EXISTS provider_ratings_subject_read ON provider_ratings;
CREATE POLICY provider_ratings_subject_read ON provider_ratings
    FOR SELECT
    USING (provider_user_id = auth.uid());
