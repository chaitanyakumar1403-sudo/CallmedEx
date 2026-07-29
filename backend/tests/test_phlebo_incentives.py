"""
Task 6: Doorstep add-test incentive wiring.

Exercises:
  1. doorstep_addon creates a pending incentive_ledger entry at 5% of price.
  2. Sample acceptance credits the wallet with reason=incentive and flips
     the ledger status to credited.
  3. Retried acceptance does not double-credit (idempotent).
  4. Full-time (salaried) phlebos still earn upsell incentives.
  5. Missing/inactive incentive_rules are tolerated gracefully.
"""
import uuid
from datetime import datetime, timezone

import pytest

from app.routers import phlebo_doorstep as router_mod
from app.services import samples as samples_mod
from app.services import wallet as wallet_mod

# The incentive helpers live in phlebo_doorstep module-level.
from app.routers.phlebo_doorstep import _accrue_upsell_incentive
from app.services.samples import SampleService
from app.services.wallet import WalletService
from tests.test_sample_lifecycle import FakeSupabase


# ── Fixtures ───────────────────────────────────────────────────────────────────


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(router_mod, "supabase", fake)
    monkeypatch.setattr(samples_mod, "supabase", fake)
    monkeypatch.setattr(wallet_mod, "supabase", fake)
    return fake


def _seed_incentive_rule(fake, code="PHLEBO_UPSELL_SVC", reward_type="percent",
                         reward_value=5.0, is_active=True):
    fake.db.setdefault("incentive_rules", []).append({
        "id": str(uuid.uuid4()),
        "code": code,
        "name": "Add-on test upsell",
        "description": "",
        "applies_to_role": "phlebotomist",
        "trigger_event": "upsell_service",
        "reward_type": reward_type,
        "reward_value": reward_value,
        "min_order_value": 0.00,
        "is_active": is_active,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return fake.db["incentive_rules"][-1]


def _seed_phlebo(fake, user_id, rate=150.0, phleb_type="part_time"):
    fake.db.setdefault("phlebotomists", []).append({
        "user_id": user_id,
        "per_collection_rate": rate,
        "phleb_type": phleb_type,
        "home_lab_org_user_id": str(uuid.uuid4()),
    })


def _seed_sample(fake, sample_id, booking_id, phlebo_user_id, barcode="CMX-000001-ABCDEF"):
    fake.db.setdefault("samples", []).append({
        "id": sample_id,
        "barcode": barcode,
        "booking_id": booking_id,
        "patient_id": str(uuid.uuid4()),
        "phlebotomist_user_id": phlebo_user_id,
        "expected_tube_type_code": "edta_lavender",
        "tube_type_code": None,
        "status": "pending_collection",
        "booking_subject_id": str(uuid.uuid4()),
        "processing_center_id": str(uuid.uuid4()),
        "tube_mismatch_ack": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "handover_id": None,
    })


# ── 1. Accrual: addon creates pending incentive ───────────────────────────────


def test_accrue_pending_incentive_at_5_percent(fake_db):
    """doorstep_addon's _accrue_upsell_incentive creates a pending ledger entry."""
    rule = _seed_incentive_rule(fake_db)
    phlebo = str(uuid.uuid4())
    booking = str(uuid.uuid4())
    bt = str(uuid.uuid4())

    _accrue_upsell_incentive(phlebo, booking, bt, price_charged=1000.00)

    ledger = fake_db.db.get("incentive_ledger", [])
    assert len(ledger) == 1
    entry = ledger[0]
    assert entry["provider_user_id"] == phlebo
    assert entry["booking_id"] == booking
    assert entry["rule_id"] == rule["id"]
    assert entry["base_amount"] == 1000.00
    assert entry["reward_amount"] == 50.00  # 5% of 1000
    assert entry["status"] == "pending"


def test_accrue_skips_when_rule_missing(fake_db):
    """Missing incentive_rules table is tolerated gracefully."""
    phlebo = str(uuid.uuid4())
    _accrue_upsell_incentive(phlebo, str(uuid.uuid4()), str(uuid.uuid4()), 1000.00)
    assert len(fake_db.db.get("incentive_ledger", [])) == 0


def test_accrue_skips_when_rule_inactive(fake_db):
    """Inactive rules are skipped without error."""
    _seed_incentive_rule(fake_db, is_active=False)
    _accrue_upsell_incentive(str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()), 1000.00)
    assert len(fake_db.db.get("incentive_ledger", [])) == 0


def test_accrue_skips_zero_price(fake_db):
    """Zero price_charged produces no incentive entry."""
    _seed_incentive_rule(fake_db)
    _accrue_upsell_incentive(str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()), 0.00)
    assert len(fake_db.db.get("incentive_ledger", [])) == 0


# ── 2. Settlement: acceptance credits wallet + flips status ────────────────────


def test_acceptance_credits_incentive_and_flips_status(fake_db):
    """Accept samples -> incentive_ledger credited + wallet entry created."""
    phlebo = str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, rate=150)
    _seed_incentive_rule(fake_db)

    booking = str(uuid.uuid4())
    sid = str(uuid.uuid4())
    _seed_sample(fake_db, sid, booking, phlebo)

    # Pre-seed a pending incentive
    _accrue_upsell_incentive(phlebo, booking, str(uuid.uuid4()), price_charged=1000.00)

    assert len(fake_db.db["incentive_ledger"]) == 1
    assert fake_db.db["incentive_ledger"][0]["status"] == "pending"

    # Simulate acceptance
    by_id = {
        sid: fake_db.db["samples"][0],
    }
    result = SampleService._credit_for_accepted(
        phlebotomist_user_id=phlebo,
        accepted_ids=[sid],
        by_id=by_id,
        responder_user_id=str(uuid.uuid4()),
    )

    assert result["incentives_settled"] == 1

    # Ledger flipped to credited
    entry = fake_db.db["incentive_ledger"][0]
    assert entry["status"] == "credited"
    assert entry["credited_at"] is not None
    assert entry["wallet_transaction_id"] is not None
    assert entry["sample_id"] == sid

    # Wallet credited with reason=incentive
    txns = fake_db.db.get("wallet_transactions", [])
    incentive_txns = [t for t in txns if t["reason"] == "incentive"]
    assert len(incentive_txns) == 1
    assert incentive_txns[0]["amount"] == 50.00
    assert incentive_txns[0]["direction"] == "credit"


def test_settle_skips_when_no_pending_incentives(fake_db):
    """Acceptance without pending incentives still works fine."""
    phlebo = str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, rate=150)
    booking = str(uuid.uuid4())
    sid = str(uuid.uuid4())
    _seed_sample(fake_db, sid, booking, phlebo)

    result = SampleService._credit_for_accepted(
        phlebotomist_user_id=phlebo,
        accepted_ids=[sid],
        by_id={sid: fake_db.db["samples"][0]},
        responder_user_id=str(uuid.uuid4()),
    )
    assert result["incentives_settled"] == 0


# ── 3. Idempotency: retried acceptance does not double-credit ─────────────────


def test_no_double_credit_on_retry(fake_db):
    """Retrying acceptance after incentives are already settled is a no-op."""
    phlebo = str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, rate=150)
    _seed_incentive_rule(fake_db)

    booking = str(uuid.uuid4())
    sid = str(uuid.uuid4())
    _seed_sample(fake_db, sid, booking, phlebo)
    _accrue_upsell_incentive(phlebo, booking, str(uuid.uuid4()), price_charged=1000.00)

    by_id = {sid: fake_db.db["samples"][0]}

    # First acceptance
    first = SampleService._credit_for_accepted(
        phlebotomist_user_id=phlebo,
        accepted_ids=[sid],
        by_id=by_id,
        responder_user_id=str(uuid.uuid4()),
    )
    assert first["incentives_settled"] == 1

    # Second acceptance (retry)
    second = SampleService._credit_for_accepted(
        phlebotomist_user_id=phlebo,
        accepted_ids=[sid],
        by_id=by_id,
        responder_user_id=str(uuid.uuid4()),
    )
    assert second["incentives_settled"] == 0

    # Only one incentive wallet credit
    txns = fake_db.db.get("wallet_transactions", [])
    incentive_txns = [t for t in txns if t["reason"] == "incentive"]
    assert len(incentive_txns) == 1


# ── 4. Full-time phlebos still earn incentives ────────────────────────────────


def test_fulltime_phlebo_earns_incentive(fake_db):
    """Salaried phlebos (rate=0) still get upsell incentive credited."""
    phlebo = str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, rate=0, phleb_type="full_time")
    _seed_incentive_rule(fake_db)

    booking = str(uuid.uuid4())
    sid = str(uuid.uuid4())
    _seed_sample(fake_db, sid, booking, phlebo)
    _accrue_upsell_incentive(phlebo, booking, str(uuid.uuid4()), price_charged=500.00)

    by_id = {sid: fake_db.db["samples"][0]}
    result = SampleService._credit_for_accepted(
        phlebotomist_user_id=phlebo,
        accepted_ids=[sid],
        by_id=by_id,
        responder_user_id=str(uuid.uuid4()),
    )

    # Per-collection credit is 0 for salaried
    assert result["credited"] == 0
    assert result["amount"] == 0.0

    # But incentive is still settled
    assert result["incentives_settled"] == 1
    entry = fake_db.db["incentive_ledger"][0]
    assert entry["status"] == "credited"

    txns = fake_db.db.get("wallet_transactions", [])
    incentive_txns = [t for t in txns if t["reason"] == "incentive"]
    assert len(incentive_txns) == 1
    assert incentive_txns[0]["amount"] == 25.00  # 5% of 500


# ── 5. Summary breakouts incentive_month ──────────────────────────────────────


def test_get_summary_includes_incentive_month(fake_db):
    """get_summary returns incentive_month total."""
    phlebo = str(uuid.uuid4())

    # Credit some incentives directly
    WalletService.credit(phlebo, 50, "incentive", sample_id="i1", notes="Incentive 1")
    WalletService.credit(phlebo, 25, "incentive", sample_id="i2", notes="Incentive 2")

    summary = WalletService.get_summary(phlebo)
    assert summary["incentive_month"] == 75.0