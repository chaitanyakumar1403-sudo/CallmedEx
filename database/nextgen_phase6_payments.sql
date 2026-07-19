-- ============================================================================
-- CallMedex Phase 6D: Payments & Settlements Schema
-- Razorpay integration, payment tracking, provider settlements
-- Run AFTER: schema.sql, nextgen_phase1_schema.sql
-- ============================================================================

-- ─── Payments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES users(id),
    provider_id UUID REFERENCES users(id),  -- Doctor/Org who receives the money

    -- Amounts
    amount REAL NOT NULL DEFAULT 0,
    platform_fee REAL DEFAULT 0,            -- CallMedex commission
    provider_payout REAL DEFAULT 0,          -- Amount to be sent to provider
    currency TEXT DEFAULT 'INR',

    -- Razorpay fields
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    razorpay_transfer_id TEXT,              -- For Route (split payment)

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'authorized', 'captured', 'settled', 'refunded', 'failed')),
    payment_method TEXT DEFAULT '',          -- 'upi', 'card', 'netbanking', 'wallet'
    gateway_response JSONB DEFAULT '{}',    -- Full Razorpay webhook payload

    -- Metadata
    description TEXT DEFAULT '',
    receipt_number TEXT DEFAULT '',
    invoice_url TEXT DEFAULT '',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    captured_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_patient ON payments(patient_id);
CREATE INDEX idx_payments_provider ON payments(provider_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_razorpay ON payments(razorpay_order_id);

-- ─── Settlements (Provider Payouts) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES users(id),
    payment_id UUID REFERENCES payments(id),

    amount REAL NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'INR',

    -- Razorpay Route transfer
    razorpay_transfer_id TEXT,
    razorpay_account_id TEXT,              -- Provider's linked Razorpay account

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reversed')),

    settlement_date DATE,
    bank_reference TEXT DEFAULT '',
    notes TEXT DEFAULT '',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_settlements_provider ON settlements(provider_id);
CREATE INDEX idx_settlements_payment ON settlements(payment_id);
CREATE INDEX idx_settlements_status ON settlements(status);

-- ─── Refunds ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    patient_id UUID NOT NULL REFERENCES users(id),

    amount REAL NOT NULL DEFAULT 0,
    reason TEXT DEFAULT '',
    razorpay_refund_id TEXT,
    status TEXT NOT NULL DEFAULT 'initiated'
        CHECK (status IN ('initiated', 'processing', 'completed', 'failed')),

    initiated_by UUID REFERENCES users(id),  -- admin or system
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_patient ON refunds(patient_id);

-- ─── RLS Policies ────────────────────────────────────────────────────────

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Payments: patients see their own, providers see their received payments
CREATE POLICY "payments_patient_view" ON payments
    FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "payments_provider_view" ON payments
    FOR SELECT USING (provider_id = auth.uid());
CREATE POLICY "payments_admin_all" ON payments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Settlements: providers see their own
CREATE POLICY "settlements_provider_view" ON settlements
    FOR SELECT USING (provider_id = auth.uid());
CREATE POLICY "settlements_admin_all" ON settlements
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Refunds: patients see their own
CREATE POLICY "refunds_patient_view" ON refunds
    FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "refunds_admin_all" ON refunds
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );
