"""
Advance rostering.

Tomorrow's slots are assigned this evening, so live GPS is useless — assignment
anchors on the phlebotomist's base location instead. A phlebo may decline; the
job goes to the next-nearest rather than to nobody.
"""
import uuid

import pytest

import app.services.roster as roster_mod
from app.services.roster import ADVANCE_RADIUS_KM, decline_job, run_roster_pass
from tests.test_sample_lifecycle import FakeSupabase

DATE = "2026-07-29"


@pytest.fixture
def db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(roster_mod, "supabase", fake)
    return fake


def _phlebo(fake, centre_id, lat, lng, available=True, date=DATE):
    uid = str(uuid.uuid4())
    fake.db.setdefault("phlebotomists", []).append({
        "user_id": uid, "processing_center_id": centre_id,
        "base_lat": lat, "base_lng": lng, "base_pincode": "",
    })
    fake.db.setdefault("phlebotomist_roster", []).append({
        "id": str(uuid.uuid4()), "processing_center_id": centre_id,
        "phlebotomist_user_id": uid, "roster_date": date,
        "status": "available" if available else "leave", "max_jobs": 0,
    })
    return uid


def _booking(fake, centre_id, lat, lng, date=DATE):
    bid = str(uuid.uuid4())
    fake.db.setdefault("bookings", []).append({
        "id": bid, "processing_center_id": centre_id,
        "booking_kind": "home_collection", "status": "confirmed",
        "collection_lat": lat, "collection_lng": lng,
        "collection_date": date, "priority": "normal",
    })
    return bid


def test_assignment_anchors_on_base_location_not_live_gps(db):
    centre = str(uuid.uuid4())
    near = _phlebo(db, centre, 17.385, 78.487)
    _phlebo(db, centre, 17.60, 78.90)          # farther from base
    _booking(db, centre, 17.390, 78.490)

    assigned = run_roster_pass(centre, DATE)
    assert len(assigned) == 1
    assert assigned[0]["phlebotomist_user_id"] == near


def test_a_phlebo_of_another_centre_is_never_assigned(db):
    """Even when strictly nearer — they could not submit the tube afterwards."""
    mine, theirs = str(uuid.uuid4()), str(uuid.uuid4())
    _phlebo(db, theirs, 17.3850, 78.4870)      # right next door
    ours = _phlebo(db, mine, 17.4200, 78.5200)
    _booking(db, mine, 17.3851, 78.4871)

    assigned = run_roster_pass(mine, DATE)
    assert [a["phlebotomist_user_id"] for a in assigned] == [ours]


def test_a_booking_beyond_the_radius_is_left_for_manual_assignment(db):
    centre = str(uuid.uuid4())
    _phlebo(db, centre, 17.385, 78.487)
    _booking(db, centre, 19.076, 72.877)       # Mumbai
    assert run_roster_pass(centre, DATE) == []
    assert db.db.get("dispatch_requests", []) == []


def test_a_phlebo_on_leave_is_skipped(db):
    centre = str(uuid.uuid4())
    _phlebo(db, centre, 17.385, 78.487, available=False)
    _booking(db, centre, 17.386, 78.488)
    assert run_roster_pass(centre, DATE) == []


def test_load_is_balanced_rather_than_dumped_on_the_nearest(db):
    centre = str(uuid.uuid4())
    a = _phlebo(db, centre, 17.385, 78.487)
    b = _phlebo(db, centre, 17.386, 78.488)
    for _ in range(4):
        _booking(db, centre, 17.3855, 78.4875)

    assigned = run_roster_pass(centre, DATE)
    counts = {}
    for row in assigned:
        counts[row["phlebotomist_user_id"]] = counts.get(row["phlebotomist_user_id"], 0) + 1
    assert sorted(counts.values()) == [2, 2]
    assert set(counts) == {a, b}


def test_assignments_are_advance_mode_and_dated(db):
    centre = str(uuid.uuid4())
    _phlebo(db, centre, 17.385, 78.487)
    _booking(db, centre, 17.386, 78.488)

    run_roster_pass(centre, DATE)
    req = db.db["dispatch_requests"][0]
    assert req["assignment_mode"] == "advance"
    assert req["scheduled_for"] == DATE
    assert req["status"] == "provider_accepted"


def test_the_pass_is_idempotent(db):
    centre = str(uuid.uuid4())
    _phlebo(db, centre, 17.385, 78.487)
    _booking(db, centre, 17.386, 78.488)

    run_roster_pass(centre, DATE)
    run_roster_pass(centre, DATE)
    assert len(db.db["dispatch_requests"]) == 1


def test_declining_reassigns_to_the_next_nearest(db):
    centre = str(uuid.uuid4())
    first = _phlebo(db, centre, 17.3850, 78.4870)
    second = _phlebo(db, centre, 17.3900, 78.4900)
    _booking(db, centre, 17.3851, 78.4871)

    assigned = run_roster_pass(centre, DATE)
    req_id = assigned[0]["dispatch_request_id"]
    assert assigned[0]["phlebotomist_user_id"] == first

    result = decline_job(req_id, first)
    assert result["phlebotomist_user_id"] == second
    assert first in db.db["dispatch_requests"][0]["declined_by"]


def test_a_declined_job_is_never_re_offered_to_the_same_phlebo(db):
    centre = str(uuid.uuid4())
    only = _phlebo(db, centre, 17.385, 78.487)
    _booking(db, centre, 17.386, 78.488)

    req_id = run_roster_pass(centre, DATE)[0]["dispatch_request_id"]
    assert decline_job(req_id, only) is None          # nobody left
    req = db.db["dispatch_requests"][0]
    assert req["status"] == "needs_manual_assignment"
    assert req["declined_by"] == [only]


def test_the_advance_radius_is_ten_kilometres(db):
    assert ADVANCE_RADIUS_KM == 10.0
