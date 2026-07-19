-- ============================================================================
-- CallMedex Next-Gen Phase 3: Communication Layer & Privacy
-- Masked calling, secure chat, and centralized notification engine.
-- ============================================================================

-- ─── 1. Masked Communication Sessions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS communication_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    dispatch_request_id UUID,      -- References dispatch_requests if applicable
    patient_id UUID REFERENCES users(id),
    provider_id UUID REFERENCES users(id),
    virtual_number TEXT,           -- Twilio/Exotel provisioned number
    telephony_provider TEXT DEFAULT 'exotel',  -- 'twilio' or 'exotel'
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'error')),
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_sessions_booking ON communication_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_comm_sessions_patient ON communication_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_comm_sessions_provider ON communication_sessions(provider_id);
CREATE INDEX IF NOT EXISTS idx_comm_sessions_virtual ON communication_sessions(virtual_number);

ALTER TABLE communication_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients view own comm sessions" ON communication_sessions
    FOR SELECT USING (auth.uid() = patient_id);

-- ─── 2. Call Logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES communication_sessions(id),
    caller_id UUID,
    receiver_id UUID,
    direction TEXT,       -- 'patient_to_provider','provider_to_patient'
    duration_seconds INT DEFAULT 0,
    status TEXT DEFAULT 'initiated'
        CHECK (status IN ('initiated', 'ringing', 'connected', 'missed', 'failed', 'completed')),
    recording_url TEXT,   -- Optional call recording (with consent)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_session ON call_logs(session_id);

-- ─── 3. Chat Messages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id),
    dispatch_request_id UUID,
    sender_id UUID REFERENCES users(id),
    receiver_id UUID REFERENCES users(id),
    message_text TEXT,
    message_type TEXT DEFAULT 'text'
        CHECK (message_type IN ('text', 'image', 'location', 'system', 'prescription')),
    media_url TEXT,       -- For image/file messages
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_booking ON chat_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver ON chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_dispatch ON chat_messages(dispatch_request_id);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own messages" ON chat_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ─── 4. Notification Log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'push', 'in_app')),
    title TEXT,
    body TEXT,
    data JSONB DEFAULT '{}',       -- Arbitrary metadata (booking_id, dispatch_id, etc)
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);
