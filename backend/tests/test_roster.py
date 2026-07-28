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


def _booking(fake, centre_id, lat, lng, date=DATE, patient_id=None):
    bid = str(uuid.uuid4())
    fake.db.setdefault("bookings", []).append({
        "id": bid, "processing_center_id": centre_id,
        "patient_id": patient_id or str(uuid.uuid4()),
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


def test_declining_a_realtime_job_is_rejected_not_silently_queued(db):
    """decline_job is the advance-roster decline path only.

    A realtime/urgent dispatch_requests row never has scheduled_for set — that
    column is only populated by run_roster_pass. Passing one to decline_job
    must not silently fall through to "needs_manual_assignment"; that status
    is supposed to mean "every roster candidate declined or was out of
    radius", which is not what happened here.
    """
    centre = str(uuid.uuid4())
    phlebo = _phlebo(db, centre, 17.385, 78.487)
    booking_id = _booking(db, centre, 17.386, 78.488)
    req_id = str(uuid.uuid4())
    db.db.setdefault("dispatch_requests", []).append({
        "id": req_id, "booking_id": booking_id,
        "assignment_mode": "realtime", "scheduled_for": None,
        "status": "provider_accepted", "declined_by": [],
    })

    with pytest.raises(ValueError):
        decline_job(req_id, phlebo)

    req = db.db["dispatch_requests"][0]
    assert req["status"] != "needs_manual_assignment"
    assert req["status"] == "provider_accepted"


def test_an_advance_request_with_no_scheduled_for_is_rejected_not_reassigned(db):
    """Belt and braces: even with assignment_mode='advance', a missing
    scheduled_for means _available_phlebos would query roster_date=None and
    match nothing — silently reassigning to nobody. Refuse instead."""
    centre = str(uuid.uuid4())
    phlebo = _phlebo(db, centre, 17.385, 78.487)
    booking_id = _booking(db, centre, 17.386, 78.488)
    req_id = str(uuid.uuid4())
    db.db.setdefault("dispatch_requests", []).append({
        "id": req_id, "booking_id": booking_id,
        "assignment_mode": "advance", "scheduled_for": None,
        "status": "provider_accepted", "declined_by": [],
    })

    with pytest.raises(ValueError):
        decline_job(req_id, phlebo)


def test_the_advance_radius_is_ten_kilometres(db):
    assert ADVANCE_RADIUS_KM == 10.0


def test_the_inserted_dispatch_request_carries_patient_location_and_id(db):
    """dispatch_requests.patient_lat/patient_lng are DOUBLE PRECISION NOT NULL
    with no default against real Postgres (23502 otherwise). FakeSupabase
    doesn't enforce that, so assert directly on what got inserted instead of
    relying on an exception."""
    centre = str(uuid.uuid4())
    patient = str(uuid.uuid4())
    _phlebo(db, centre, 17.385, 78.487)
    booking_id = _booking(db, centre, 17.386, 78.488, patient_id=patient)

    assigned = run_roster_pass(centre, DATE)
    assert len(assigned) == 1

    req = next(r for r in db.db["dispatch_requests"] if r["booking_id"] == booking_id)
    assert req["patient_lat"] == 17.386
    assert req["patient_lng"] == 78.488
    assert req["patient_id"] == patient


# ── Family members and roster HTTP endpoints (Task 12) ──────────────────────

from fastapi import HTTPException

import inspect

import app.routers.family_members as fm_mod
import app.routers.roster as roster_router_mod
from app.middleware.pc_auth import require_pc_admin
from app.routers.family_members import delete_member, ensure_self_member
from app.routers.family_members import list_members, update_member
from app.routers.roster import RosterEntry
from app.routers.roster import decline as decline_endpoint
from app.routers.roster import run_pass, set_roster


@pytest.fixture
def fm_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(fm_mod, "supabase", fake)
    return fake


def test_the_account_holder_becomes_a_family_member_row(fm_db):
    """Uniform subjects are what make per-person barcodes fall out of the schema."""
    uid = str(uuid.uuid4())
    member = ensure_self_member(uid, "Chaitanya")
    assert member["is_self"] is True
    assert member["account_user_id"] == uid
    assert len(fm_db.db["family_members"]) == 1


def test_ensuring_self_twice_creates_one_row(fm_db):
    uid = str(uuid.uuid4())
    first = ensure_self_member(uid, "Chaitanya")
    second = ensure_self_member(uid, "Chaitanya")
    assert first["id"] == second["id"]
    assert len(fm_db.db["family_members"]) == 1


def _member(fake, account_id, is_self=False, full_name="Member"):
    """Seed a family_members row directly, bypassing add_member, so tests can
    set up two accounts' data without going through the endpoint under test."""
    mid = str(uuid.uuid4())
    fake.db.setdefault("family_members", []).append({
        "id": mid, "account_user_id": account_id, "full_name": full_name,
        "relationship": "self" if is_self else "", "gender": "", "mobile": "",
        "date_of_birth": None, "is_self": is_self,
    })
    return mid


# ── Cross-account family-member isolation (Fix round 2) ─────────────────────


async def test_account_a_cannot_update_account_bs_family_member(fm_db):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    b_member_id = _member(fm_db, b, full_name="Bob")

    with pytest.raises(HTTPException) as exc:
        await update_member(b_member_id, {"full_name": "Hacked"}, {"sub": a})
    assert exc.value.status_code == 404

    row = next(r for r in fm_db.db["family_members"] if r["id"] == b_member_id)
    assert row["full_name"] == "Bob"          # B's row untouched


async def test_account_a_cannot_delete_account_bs_family_member(fm_db):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    b_member_id = _member(fm_db, b, full_name="Bob")

    with pytest.raises(HTTPException) as exc:
        await delete_member(b_member_id, {"sub": a})
    assert exc.value.status_code == 404

    assert any(r["id"] == b_member_id for r in fm_db.db["family_members"])  # still exists


async def test_account_as_list_never_returns_account_bs_members(fm_db):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    _member(fm_db, a, full_name="A-side")
    _member(fm_db, b, full_name="B-side")

    result = await list_members({"sub": a, "full_name": "A"})
    names = {m["full_name"] for m in result["members"]}
    assert "B-side" not in names
    assert all(m["account_user_id"] == a for m in result["members"])


async def test_update_member_cannot_reassign_is_self_or_account_user_id(fm_db):
    a, other = str(uuid.uuid4()), str(uuid.uuid4())
    mid = _member(fm_db, a, is_self=False, full_name="A-member")

    result = await update_member(
        mid,
        {"is_self": True, "account_user_id": other, "full_name": "Renamed"},
        {"sub": a},
    )

    row = next(r for r in fm_db.db["family_members"] if r["id"] == mid)
    assert row["is_self"] is False
    assert row["account_user_id"] == a
    assert row["full_name"] == "Renamed"      # the legitimate field still applies
    assert result["member"]["is_self"] is False


async def test_the_account_holders_self_row_cannot_be_deleted(fm_db):
    a = str(uuid.uuid4())
    self_id = _member(fm_db, a, is_self=True, full_name="Self")

    with pytest.raises(HTTPException) as exc:
        await delete_member(self_id, {"sub": a})
    assert exc.value.status_code == 400

    assert any(r["id"] == self_id for r in fm_db.db["family_members"])


# ── The roster write endpoints are actually admin-gated (Fix round 2) ───────


async def test_require_pc_admin_rejects_a_technician():
    staff = {"processing_center_id": str(uuid.uuid4()), "pc_role": "technician"}
    with pytest.raises(HTTPException) as exc:
        await require_pc_admin(staff)
    assert exc.value.status_code == 403


def test_the_roster_write_endpoints_are_wired_to_require_pc_admin():
    """The existing roster tests call set_roster/run_pass directly with a
    hand-built staff dict, which bypasses FastAPI's dependency resolution
    entirely — nothing else proves these routes actually declare
    require_pc_admin rather than the weaker get_current_pc_staff. Inspect the
    real signature default instead of assuming the wiring is correct."""
    for fn in (set_roster, run_pass):
        staff_param = inspect.signature(fn).parameters["staff"]
        assert staff_param.default.dependency is require_pc_admin, (
            f"{fn.__name__} is not gated by require_pc_admin"
        )


@pytest.fixture
def roster_router_db(monkeypatch):
    """Task 9's carry-forward: decline_job raises ValueError for a non-advance
    dispatch request. The /decline endpoint must turn that into HTTP 400, not
    a 500 — this fixture patches the supabase client the ROUTER module sees
    (app.routers.roster imports decline_job/run_roster_pass directly from
    app.services.roster, but that service module reads its own `supabase`
    name, so it must be patched there too)."""
    fake = FakeSupabase()
    monkeypatch.setattr(roster_mod, "supabase", fake)
    return fake


async def test_a_phlebotomist_cannot_decline_another_phlebotomists_job(roster_router_db):
    """I2: nothing verified the caller was actually assigned to the job, so
    any phlebotomist could decline (and reassign) any advance job by ID."""
    centre = str(uuid.uuid4())
    a = _phlebo(roster_router_db, centre, 17.385, 78.487)
    b = _phlebo(roster_router_db, centre, 17.390, 78.490)
    booking_id = _booking(roster_router_db, centre, 17.386, 78.488)
    req_id = str(uuid.uuid4())
    roster_router_db.db.setdefault("dispatch_requests", []).append({
        "id": req_id, "booking_id": booking_id,
        "assignment_mode": "advance", "scheduled_for": DATE,
        "status": "provider_accepted", "declined_by": [],
        "assigned_provider_id": a,
    })

    with pytest.raises(HTTPException) as exc:
        await decline_endpoint(req_id, {"sub": b, "role": "phlebotomist"})
    assert exc.value.status_code == 403

    req = roster_router_db.db["dispatch_requests"][0]
    assert req["assigned_provider_id"] == a          # unchanged, not reassigned
    assert req["declined_by"] == []                  # not even recorded as declined


async def test_declining_a_realtime_job_via_the_endpoint_returns_400_not_500(roster_router_db):
    """A phlebotomist declining a realtime (non-roster) job must get a clean
    400 explaining why, never an unhandled 500 from the service's ValueError."""
    centre = str(uuid.uuid4())
    phlebo = _phlebo(roster_router_db, centre, 17.385, 78.487)
    booking_id = _booking(roster_router_db, centre, 17.386, 78.488)
    req_id = str(uuid.uuid4())
    roster_router_db.db.setdefault("dispatch_requests", []).append({
        "id": req_id, "booking_id": booking_id,
        "assignment_mode": "realtime", "scheduled_for": None,
        "status": "provider_accepted", "declined_by": [],
    })

    with pytest.raises(HTTPException) as exc:
        await decline_endpoint(req_id, {"sub": phlebo, "role": "phlebotomist"})
    assert exc.value.status_code == 400

    req = roster_router_db.db["dispatch_requests"][0]
    assert req["status"] == "provider_accepted"  # untouched, not silently queued


# ── set_roster is centre-scoped (Fix round 1) ───────────────────────────────


@pytest.fixture
def roster_put_db(monkeypatch):
    """set_roster reads/writes via `app.routers.roster`'s own `supabase` name
    (imported straight from app.database), not the services module's — so
    that's what has to be patched here."""
    fake = FakeSupabase()
    monkeypatch.setattr(roster_router_mod, "supabase", fake)
    return fake


async def test_an_admin_cannot_edit_another_centres_roster_row(roster_put_db):
    """HYD-01's admin passing a VSP-01 phlebotomist must not touch VSP-01's row."""
    mine, theirs = str(uuid.uuid4()), str(uuid.uuid4())
    theirs_phlebo = _phlebo(roster_put_db, theirs, 17.385, 78.487, available=True)

    with pytest.raises(HTTPException):
        await set_roster(
            DATE,
            [RosterEntry(phlebotomist_user_id=theirs_phlebo, status="leave")],
            staff={"processing_center_id": mine},
        )

    row = next(
        r for r in roster_put_db.db["phlebotomist_roster"]
        if r["phlebotomist_user_id"] == theirs_phlebo
    )
    assert row["status"] == "available"
    assert row["processing_center_id"] == theirs


async def test_the_cross_centre_attempt_raises_403(roster_put_db):
    mine, theirs = str(uuid.uuid4()), str(uuid.uuid4())
    theirs_phlebo = _phlebo(roster_put_db, theirs, 17.385, 78.487, available=True)

    with pytest.raises(HTTPException) as exc:
        await set_roster(
            DATE,
            [RosterEntry(phlebotomist_user_id=theirs_phlebo, status="leave")],
            staff={"processing_center_id": mine},
        )
    assert exc.value.status_code == 403


async def test_an_admin_can_still_update_their_own_centres_existing_row(roster_put_db):
    centre = str(uuid.uuid4())
    mine_phlebo = _phlebo(roster_put_db, centre, 17.385, 78.487, available=True)

    await set_roster(
        DATE,
        [RosterEntry(phlebotomist_user_id=mine_phlebo, status="leave", max_jobs=3)],
        staff={"processing_center_id": centre},
    )

    row = next(
        r for r in roster_put_db.db["phlebotomist_roster"]
        if r["phlebotomist_user_id"] == mine_phlebo
    )
    assert row["status"] == "leave"
    assert row["max_jobs"] == 3
    # still exactly one row for this phlebo/date — an update, not a second insert
    assert len([
        r for r in roster_put_db.db["phlebotomist_roster"]
        if r["phlebotomist_user_id"] == mine_phlebo
    ]) == 1


async def test_an_admin_can_still_insert_a_new_roster_row_for_their_own_phlebo(roster_put_db):
    centre = str(uuid.uuid4())
    uid = str(uuid.uuid4())
    roster_put_db.db.setdefault("phlebotomists", []).append({
        "user_id": uid, "processing_center_id": centre,
        "base_lat": 17.385, "base_lng": 78.487, "base_pincode": "",
    })
    # No existing phlebotomist_roster row for this phlebo/date yet.

    await set_roster(
        DATE,
        [RosterEntry(phlebotomist_user_id=uid, status="available", max_jobs=2)],
        staff={"processing_center_id": centre},
    )

    rows = [
        r for r in roster_put_db.db["phlebotomist_roster"]
        if r["phlebotomist_user_id"] == uid
    ]
    assert len(rows) == 1
    assert rows[0]["status"] == "available"
    assert rows[0]["processing_center_id"] == centre
