-- ============================================================================
-- CallMedex RLS Fix: Add missing Row Level Security policies
-- Run this in Supabase SQL Editor AFTER all phase schemas have been applied.
-- Fixes: audit_log, booking_history, call_logs, legal_documents, provider_locations
-- ============================================================================

-- ─── 1. audit_log ─────────────────────────────────────────────────────────
-- Admins can read everything. Users can read entries where they are the actor.
-- Nobody can INSERT/UPDATE/DELETE directly — only the service key (backend) can.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop first to avoid duplicates on re-run
DROP POLICY IF EXISTS "Admins read all audit logs" ON audit_log;
DROP POLICY IF EXISTS "Users read own audit logs" ON audit_log;

CREATE POLICY "Admins read all audit logs" ON audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Users read own audit logs" ON audit_log
    FOR SELECT
    USING (auth.uid() = actor_id);


-- ─── 2. booking_history ───────────────────────────────────────────────────
-- Patients can see history for their own bookings.
-- Providers (staff/org/admin) can also see it.
ALTER TABLE booking_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients view own booking history" ON booking_history;
DROP POLICY IF EXISTS "Staff view booking history" ON booking_history;

CREATE POLICY "Patients view own booking history" ON booking_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM bookings
            WHERE bookings.id = booking_history.booking_id
            AND bookings.patient_id = auth.uid()
        )
    );

CREATE POLICY "Staff view booking history" ON booking_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'staff', 'organization', 'doctor', 'nurse', 'phlebotomist')
        )
    );


-- ─── 3. call_logs ─────────────────────────────────────────────────────────
-- Callers and receivers can see their own call logs. Admins see all.
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants view own call logs" ON call_logs;
DROP POLICY IF EXISTS "Admins view all call logs" ON call_logs;

CREATE POLICY "Participants view own call logs" ON call_logs
    FOR SELECT
    USING (
        auth.uid() = caller_id
        OR auth.uid() = receiver_id
    );

CREATE POLICY "Admins view all call logs" ON call_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );


-- ─── 4. legal_documents ───────────────────────────────────────────────────
-- All authenticated users can READ legal documents (they are public contracts).
-- Only admins can create/modify them (done via service key on backend).
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read legal documents" ON legal_documents;
DROP POLICY IF EXISTS "Admins manage legal documents" ON legal_documents;

CREATE POLICY "Anyone authenticated can read legal documents" ON legal_documents
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admins manage legal documents" ON legal_documents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );


-- ─── 5. provider_locations ────────────────────────────────────────────────
-- Providers can see and update only their own location.
-- Admins can see all locations (for operations map).
-- Patients cannot directly read this table (they get location via dispatch_requests).
ALTER TABLE provider_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers view own location" ON provider_locations;
DROP POLICY IF EXISTS "Providers update own location" ON provider_locations;
DROP POLICY IF EXISTS "Admins view all locations" ON provider_locations;

CREATE POLICY "Providers view own location" ON provider_locations
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Providers update own location" ON provider_locations
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Admins view all locations" ON provider_locations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );


-- ─── 6. Also fix communication_sessions (no explicit policy was added) ────
ALTER TABLE communication_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients view own comm sessions" ON communication_sessions;
DROP POLICY IF EXISTS "Providers view own comm sessions" ON communication_sessions;

CREATE POLICY "Patients view own comm sessions" ON communication_sessions
    FOR SELECT
    USING (auth.uid() = patient_id);

CREATE POLICY "Providers view own comm sessions" ON communication_sessions
    FOR SELECT
    USING (auth.uid() = provider_id);


-- ─── 7. Verify: list tables and their policy counts ───────────────────────
-- Run this after to confirm policies are in place:
-- SELECT tablename, COUNT(policyname) AS policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('audit_log','booking_history','call_logs','legal_documents','provider_locations','communication_sessions')
-- GROUP BY tablename
-- ORDER BY tablename;
