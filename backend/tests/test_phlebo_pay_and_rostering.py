"""
Two rules the platform stated but did not enforce.

1. Full-time collectors are salaried: incentives only, no per-collection
   accrual. The rate column DEFAULTs to 150.00 and the one-time UPDATE in
   phase1_sample_lifecycle.sql only zeroed the rows that existed when that
   migration ran — so every full-time phlebotomist who signed up afterwards
   was quietly earning Rs150 a tube on top of their salary.

2. Tomorrow's bookings are assigned by the nightly advance roster pass, which
   required an explicit phlebotomist_roster row marked 'available'. Nothing
   creates those rows automatically, so a centre that never opened the roster
   page had zero available collectors every night and next-day bookings fell
   through to the same-day 90-minute trigger — invisible on the collector's
   dashboard until 90 minutes before the appointment.
"""
import uuid
from datetime import date, timedelta

import pytest

import app.services.roster as roster_mod
from app.routers.auth import _build_profile_data
from app.models.schemas import Gender, UserRole, PhlebType, UserSignup

from tests.test_sample_lifecycle import FakeSupabase


TOMORROW = (date.today() + timedelta(days=1)).isoformat()


def _signup(phleb_type):
    # The real signup payload shape: .local is rejected by the email validator
    # as reserved, and confirm_password / gender / date_of_birth are all
    # required for an individual practitioner.
    return UserSignup(
        full_name="Test Collector",
        email=f"{uuid.uuid4().hex[:8]}@example.com",
        mobile="9000000000",
        password="Str0ngPassw0rd!",
        confirm_password="Str0ngPassw0rd!",
        gender=Gender.OTHER,
        date_of_birth="1995-01-01",
        role=UserRole.PHLEBOTOMIST,
        phleb_type=phleb_type,
    )


# ── 1. Salaried collectors accrue nothing per tube ───────────────────────────

def test_a_full_time_collector_is_created_with_a_zero_collection_rate():
    """Otherwise the column DEFAULT of 150.00 pays them per tube on top of salary."""
    profile = _build_profile_data(_signup(PhlebType.FULL_TIME), str(uuid.uuid4()))
    assert profile["phleb_type"] == "full_time"
    assert profile["per_collection_rate"] == 0.00


def test_a_part_time_collector_keeps_the_per_collection_rate():
    profile = _build_profile_data(_signup(PhlebType.PART_TIME), str(uuid.uuid4()))
    assert profile["phleb_type"] == "part_time"
    assert profile["per_collection_rate"] == 150.00


def test_the_rate_is_written_explicitly_and_never_left_to_the_column_default():
    """The DB default is 150.00, so silence means 'pay them'."""
    for pt in (PhlebType.FULL_TIME, PhlebType.PART_TIME):
        profile = _build_profile_data(_signup(pt), str(uuid.uuid4()))
        assert "per_collection_rate" in profile


# ── 2. Rostering defaults to available ───────────────────────────────────────

@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(roster_mod, "supabase", fake)
    return fake


def _seed_phlebo(fake, centre="c1", base=(17.38, 78.48), phleb_type="full_time"):
    uid = str(uuid.uuid4())
    fake.db.setdefault("phlebotomists", []).append({
        "user_id": uid, "processing_center_id": centre,
        "base_lat": base[0], "base_lng": base[1], "phleb_type": phleb_type,
    })
    return uid


def _roster(fake, uid, status, centre="c1", roster_date=TOMORROW):
    fake.db.setdefault("phlebotomist_roster", []).append({
        "phlebotomist_user_id": uid, "processing_center_id": centre,
        "roster_date": roster_date, "status": status, "max_jobs": 0,
    })


def test_a_collector_with_no_roster_row_is_available(fake_db):
    """The reported gap: nobody creates roster rows, so nobody was assignable."""
    uid = _seed_phlebo(fake_db)

    available = roster_mod._available_phlebos("c1", TOMORROW)

    assert [p["user_id"] for p in available] == [uid]


def test_an_explicit_leave_row_takes_a_collector_out(fake_db):
    uid = _seed_phlebo(fake_db)
    _roster(fake_db, uid, "leave")

    assert roster_mod._available_phlebos("c1", TOMORROW) == []


def test_an_explicit_unavailable_row_takes_a_collector_out(fake_db):
    uid = _seed_phlebo(fake_db)
    _roster(fake_db, uid, "unavailable")

    assert roster_mod._available_phlebos("c1", TOMORROW) == []


def test_an_explicit_available_row_keeps_a_collector_in(fake_db):
    uid = _seed_phlebo(fake_db)
    _roster(fake_db, uid, "available")

    assert [p["user_id"] for p in roster_mod._available_phlebos("c1", TOMORROW)] == [uid]


def test_a_collector_with_no_base_location_is_still_not_assignable(fake_db):
    """Defaulting to available must not mean dispatching to an unknown address."""
    fake_db.db.setdefault("phlebotomists", []).append({
        "user_id": str(uuid.uuid4()), "processing_center_id": "c1",
        "base_lat": None, "base_lng": None, "phleb_type": "full_time",
    })

    assert roster_mod._available_phlebos("c1", TOMORROW) == []


def test_only_this_centres_collectors_are_considered(fake_db):
    mine = _seed_phlebo(fake_db, centre="c1")
    _seed_phlebo(fake_db, centre="c2")

    assert [p["user_id"] for p in roster_mod._available_phlebos("c1", TOMORROW)] == [mine]
