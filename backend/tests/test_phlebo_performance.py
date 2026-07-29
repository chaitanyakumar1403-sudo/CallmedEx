"""
Task 10: Phlebo "My Performance" scorecard + availability self-service.

Exercises:
  1. Performance returns completed slots, cancellation_pct for current month.
  2. Last month's jobs are excluded (month boundary).
  3. cancellation_pct is null when no jobs exist.
  4. incentives_month and fines_month sum correctly from wallet_transactions.
  5. Availability upsert creates a new roster row.
  6. Availability upsert updates an existing row.
  7. Availability rejects past dates.
  8. Availability rejects bad status values.
  9. Availability rejects non-phlebo users.
"""
import uuid
from datetime import datetime, timezone

import pytest

from app.routers import phlebo_stats as stats_mod
from tests.test_sample_lifecycle import FakeQuery, FakeSupabase, FakeResult


# ── Extended Fake with gte support ──────────────────────────────────────────

class FakeQueryWithGte(FakeQuery):
    """Extends FakeQuery with .gte() and .lte() support."""

    def gte(self, col, val):
        self.filters.append(("gte", col, val))
        return self

    def lte(self, col, val):
        self.filters.append(("lte", col, val))
        return self

    def _matches(self, row):
        # Run the parent checks first
        for kind, col, val in self.filters:
            if kind == "eq" and row.get(col) != val:
                return False
            if kind == "neq" and row.get(col) == val:
                return False
            if kind == "in" and row.get(col) not in val:
                return False
            if kind == "is" and val == "null" and row.get(col) is not None:
                return False
            if kind == "negated_is" and val == "null" and row.get(col) is None:
                return False
            if kind == "ilike":
                pattern = str(val).lower()
                cell = str(row.get(col, "") or "").lower()
                if pattern.startswith("%") and pattern.endswith("%"):
                    if pattern[1:-1] not in cell:
                        return False
                elif pattern.startswith("%"):
                    if not cell.endswith(pattern[1:]):
                        return False
                elif pattern.endswith("%"):
                    if not cell.startswith(pattern[:-1]):
                        return False
                elif cell != pattern:
                    return False
            if kind == "gte":
                rv = row.get(col)
                if rv is None or rv < val:
                    return False
            if kind == "lte":
                rv = row.get(col)
                if rv is None or rv > val:
                    return False
        return True


class FakeSupabaseGte(FakeSupabase):
    """Like FakeSupabase but tables use FakeQueryWithGte for gte support."""

    def table(self, name):
        return FakeQueryWithGte(self.db, name)


# ── Helpers ─────────────────────────────────────────────────────────────────

def _phlebo_user(uid=None):
    return {"sub": uid or str(uuid.uuid4()), "role": "phlebotomist"}


def _non_phlebo_user(uid=None):
    return {"sub": uid or str(uuid.uuid4()), "role": "patient"}


def _seed_dispatch(fake, phlebo_id, status, days_offset=0):
    """Seed a dispatch_requests row. days_offset=0 = today, negative = past."""
    created_at = datetime.now(timezone.utc).isoformat()
    if days_offset != 0:
        # Simple offset: just change the month for boundary tests
        from datetime import timedelta
        created_at = (datetime.now(timezone.utc) + timedelta(days=days_offset)).isoformat()
    fake.db.setdefault("dispatch_requests", []).append({
        "id": str(uuid.uuid4()),
        "assigned_provider_id": phlebo_id,
        "status": status,
        "provider_type": "phlebotomist",
        "created_at": created_at,
    })


def _seed_wallet_txn(fake, phlebo_id, reason, direction, amount, days_offset=0):
    """Seed a wallet_transactions row."""
    from datetime import timedelta
    created_at = (datetime.now(timezone.utc) + timedelta(days=days_offset)).isoformat()
    fake.db.setdefault("wallet_transactions", []).append({
        "id": str(uuid.uuid4()),
        "provider_user_id": phlebo_id,
        "reason": reason,
        "direction": direction,
        "amount": amount,
        "created_at": created_at,
    })


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabaseGte()
    monkeypatch.setattr(stats_mod, "supabase", fake)
    return fake


# ── 1. Performance returns completed slots and cancellation_pct ─────────────

@pytest.mark.asyncio
async def test_performance_basic(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = _phlebo_user(phlebo_id)

    # Seed: 6 completed, 2 cancelled this month
    for _ in range(6):
        _seed_dispatch(fake_db, phlebo_id, "completed")
    for _ in range(2):
        _seed_dispatch(fake_db, phlebo_id, "cancelled")

    result = await stats_mod.performance(user=user)

    assert result["slots_completed"] == 6
    assert result["cancellation_pct"] == 25.0  # 2/8 = 25%
    assert result["month_label"] == datetime.now(timezone.utc).strftime("%B %Y")


# ── 2. Last month's jobs are excluded ───────────────────────────────────────

@pytest.mark.asyncio
async def test_performance_month_boundary(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = _phlebo_user(phlebo_id)

    # 3 completed this month (days_offset=0)
    for _ in range(3):
        _seed_dispatch(fake_db, phlebo_id, "completed", days_offset=0)
    # 2 completed last month (days_offset=-35) — should be excluded
    for _ in range(2):
        _seed_dispatch(fake_db, phlebo_id, "completed", days_offset=-35)

    result = await stats_mod.performance(user=user)

    assert result["slots_completed"] == 3  # Only this month's


# ── 3. cancellation_pct is null when no jobs exist ──────────────────────────

@pytest.mark.asyncio
async def test_performance_no_jobs(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = _phlebo_user(phlebo_id)

    result = await stats_mod.performance(user=user)

    assert result["slots_completed"] == 0
    assert result["cancellation_pct"] is None


# ── 4. incentives_month and fines_month sum correctly ───────────────────────

@pytest.mark.asyncio
async def test_performance_wallet(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = _phlebo_user(phlebo_id)

    # Incentives this month: 2 entries totalling 150
    _seed_wallet_txn(fake_db, phlebo_id, "incentive", "credit", 100.0)
    _seed_wallet_txn(fake_db, phlebo_id, "incentive", "credit", 50.0)
    # Fines this month: 1 entry of 25
    _seed_wallet_txn(fake_db, phlebo_id, "penalty", "debit", 25.0)
    # Last month's incentive — should be excluded
    _seed_wallet_txn(fake_db, phlebo_id, "incentive", "credit", 200.0, days_offset=-35)

    # Seed one completed so total > 0 (ensures cancellation_pct is not null)
    _seed_dispatch(fake_db, phlebo_id, "completed")

    result = await stats_mod.performance(user=user)

    assert result["incentives_month"] == 150.0
    assert result["fines_month"] == 25.0


# ── 5. Availability upsert creates a new roster row ─────────────────────────

@pytest.mark.asyncio
async def test_availability_create(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = _phlebo_user(phlebo_id)
    centre_id = str(uuid.uuid4())

    # Seed the phlebotomist profile with processing_center_id
    fake_db.db.setdefault("phlebotomists", []).append({
        "user_id": phlebo_id,
        "processing_center_id": centre_id,
    })

    from datetime import date
    tomorrow = date.today().isoformat()

    result = await stats_mod.set_availability(
        stats_mod.AvailabilityRequest(date=tomorrow, status="leave"),
        user=user,
    )

    assert result["ok"] is True
    assert result["status"] == "leave"

    # Verify the row was created
    roster_rows = fake_db.db.get("phlebotomist_roster", [])
    assert len(roster_rows) == 1
    assert roster_rows[0]["phlebotomist_user_id"] == phlebo_id
    assert roster_rows[0]["status"] == "leave"


# ── 6. Availability upsert updates an existing row ──────────────────────────

@pytest.mark.asyncio
async def test_availability_update(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = _phlebo_user(phlebo_id)
    centre_id = str(uuid.uuid4())

    fake_db.db.setdefault("phlebotomists", []).append({
        "user_id": phlebo_id,
        "processing_center_id": centre_id,
    })

    from datetime import date
    tomorrow = date.today().isoformat()

    # Pre-create a roster row
    fake_db.db.setdefault("phlebotomist_roster", []).append({
        "id": str(uuid.uuid4()),
        "phlebotomist_user_id": phlebo_id,
        "processing_center_id": centre_id,
        "roster_date": tomorrow,
        "status": "available",
    })

    # Now update it to unavailable
    result = await stats_mod.set_availability(
        stats_mod.AvailabilityRequest(date=tomorrow, status="unavailable"),
        user=user,
    )

    assert result["ok"] is True
    assert result["status"] == "unavailable"

    roster_rows = fake_db.db.get("phlebotomist_roster", [])
    assert len(roster_rows) == 1
    assert roster_rows[0]["status"] == "unavailable"


# ── 7. Availability rejects past dates ──────────────────────────────────────

@pytest.mark.asyncio
async def test_availability_rejects_past_date(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = _phlebo_user(phlebo_id)

    from datetime import date, timedelta
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    with pytest.raises(Exception) as exc:
        await stats_mod.set_availability(
            stats_mod.AvailabilityRequest(date=yesterday, status="available"),
            user=user,
        )
    assert "past" in str(exc.value).lower()


# ── 8. Availability rejects bad status values ───────────────────────────────

@pytest.mark.asyncio
async def test_availability_rejects_bad_status(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = _phlebo_user(phlebo_id)

    from datetime import date
    tomorrow = date.today().isoformat()

    with pytest.raises(Exception) as exc:
        await stats_mod.set_availability(
            stats_mod.AvailabilityRequest(date=tomorrow, status="invalid"),
            user=user,
        )
    assert "Bad status" in str(exc.value)


# ── 9. Availability rejects non-phlebo users ────────────────────────────────

@pytest.mark.asyncio
async def test_availability_rejects_non_phlebo(fake_db):
    user = _non_phlebo_user()

    with pytest.raises(Exception) as exc:
        await stats_mod.set_availability(
            stats_mod.AvailabilityRequest(date="2026-08-01", status="available"),
            user=user,
        )
    assert "Phlebotomists only" in str(exc.value)


# ── 10. Roster fetch returns own rows for a date window ───────────────────────

@pytest.mark.asyncio
async def test_roster_fetch_own_rows(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = _phlebo_user(phlebo_id)

    # Seed a few roster rows for the phlebo
    fake_db.db.setdefault("phlebotomist_roster", []).extend([
        {"phlebotomist_user_id": phlebo_id, "roster_date": "2026-08-01", "status": "available"},
        {"phlebotomist_user_id": phlebo_id, "roster_date": "2026-08-02", "status": "leave"},
        {"phlebotomist_user_id": phlebo_id, "roster_date": "2026-08-05", "status": "unavailable"},
    ])
    # A different phlebo's row — should NOT be returned
    other_id = str(uuid.uuid4())
    fake_db.db["phlebotomist_roster"].append({
        "phlebotomist_user_id": other_id, "roster_date": "2026-08-01", "status": "available",
    })

    result = await stats_mod.get_roster(
        user=user,
        from_date="2026-08-01",
        to_date="2026-08-07",
    )
    assert "roster" in result
    assert len(result["roster"]) == 3
    dates = {r["roster_date"] for r in result["roster"]}
    assert dates == {"2026-08-01", "2026-08-02", "2026-08-05"}


# ── 11. Roster fetch respects window filter ───────────────────────────────────

@pytest.mark.asyncio
async def test_roster_window_filter(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = _phlebo_user(phlebo_id)

    fake_db.db.setdefault("phlebotomist_roster", []).extend([
        {"phlebotomist_user_id": phlebo_id, "roster_date": "2026-08-01", "status": "available"},
        {"phlebotomist_user_id": phlebo_id, "roster_date": "2026-08-10", "status": "leave"},
        {"phlebotomist_user_id": phlebo_id, "roster_date": "2026-08-15", "status": "unavailable"},
    ])

    result = await stats_mod.get_roster(
        user=user,
        from_date="2026-08-05",
        to_date="2026-08-12",
    )
    assert len(result["roster"]) == 1
    assert result["roster"][0]["roster_date"] == "2026-08-10"


# ── 12. Roster fetch rejects non-phlebo users ─────────────────────────────────

@pytest.mark.asyncio
async def test_roster_rejects_non_phlebo(fake_db):
    user = _non_phlebo_user()
    with pytest.raises(Exception) as exc:
        await stats_mod.get_roster(user=user, from_date="2026-08-01", to_date="2026-08-07")
    assert "Phlebotomists only" in str(exc.value)


# ── 13. Roster fetch requires both date params ────────────────────────────────

@pytest.mark.asyncio
async def test_roster_requires_params(fake_db):
    user = _phlebo_user()
    with pytest.raises(Exception) as exc:
        await stats_mod.get_roster(user=user, from_date="", to_date="2026-08-07")
    assert "from and to" in str(exc.value).lower()