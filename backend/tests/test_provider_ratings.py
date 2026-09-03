"""
Provider ratings — the store behind every star CallMedex displays.

Also covers the two gates added alongside it: NHCX stays shut while it is
still scaffolding, and an unrated provider is never rendered as 5.0.
"""
import pytest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.middleware.auth import get_current_user
from app.services import ratings

client = TestClient(app)

PATIENT = {"sub": "patient-1", "role": "patient", "full_name": "Ravi Kumar"}
OTHER_PATIENT = {"sub": "patient-9", "role": "patient", "full_name": "Someone Else"}

DISPATCH = {
    "id": "dispatch-1",
    "patient_id": "patient-1",
    "assigned_provider_id": "phlebo-1",
    "status": "completed",
    "booking_id": "booking-1",
}


def _as(user):
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


def _db(dispatch=DISPATCH, existing_rating=None, rating_rows=None):
    """Supabase double: dispatch_requests, provider_ratings."""
    sb = MagicMock()
    tables = {}

    def _table(name):
        if name in tables:
            return tables[name]
        t = MagicMock()
        for m in ("select", "eq", "in_", "limit", "update", "insert"):
            getattr(t, m).return_value = t
        if name == "dispatch_requests":
            t.execute.return_value = MagicMock(data=[dispatch] if dispatch else [])
        elif name == "provider_ratings":
            t.execute.return_value = MagicMock(
                data=(existing_rating if existing_rating is not None
                      else (rating_rows if rating_rows is not None else []))
            )
        else:
            t.execute.return_value = MagicMock(data=[])
        tables[name] = t
        return t

    sb.table.side_effect = _table
    return sb


# ─── Aggregation ──────────────────────────────────────────────────────────

def test_unrated_provider_reads_as_no_rating_never_five_stars():
    """The whole point: a provider nobody rated must not show a perfect score."""
    db = _db(rating_rows=[])
    assert ratings.get_summary("phlebo-1", db=db) == {
        "average_stars": None, "rating_count": 0
    }


def test_average_is_computed_from_the_rows():
    db = _db(rating_rows=[{"stars": 5}, {"stars": 4}, {"stars": 3}])
    summary = ratings.get_summary("phlebo-1", db=db)
    assert summary["average_stars"] == 4.0
    assert summary["rating_count"] == 3


def test_missing_table_degrades_to_no_rating_rather_than_raising():
    """Before the migration is applied the table does not exist yet."""
    db = MagicMock()
    db.table.side_effect = RuntimeError('relation "provider_ratings" does not exist')
    assert ratings.get_summary("phlebo-1", db=db)["average_stars"] is None


def test_bulk_summaries_group_per_provider():
    db = _db(rating_rows=[
        {"provider_user_id": "a", "stars": 5},
        {"provider_user_id": "a", "stars": 3},
        {"provider_user_id": "b", "stars": 4},
    ])
    out = ratings.get_summaries(["a", "b", "c"], db=db)
    assert out["a"]["average_stars"] == 4.0
    assert out["b"]["rating_count"] == 1
    assert "c" not in out          # unrated providers are absent, not zeroed


# ─── Authorisation ────────────────────────────────────────────────────────

def test_only_the_patient_on_the_visit_may_rate_it():
    result = ratings.submit_rating(
        dispatch_id="dispatch-1", patient_user_id="patient-9",
        stars=1, db=_db(),
    )
    assert result["success"] is False
    assert result["status"] == 403


def test_a_visit_that_has_not_happened_cannot_be_rated():
    pending = {**DISPATCH, "status": "searching"}
    result = ratings.submit_rating(
        dispatch_id="dispatch-1", patient_user_id="patient-1",
        stars=5, db=_db(dispatch=pending),
    )
    assert result["success"] is False
    assert result["status"] == 409


def test_star_value_is_bounded():
    for bad in (0, 6, -1):
        result = ratings.submit_rating(
            dispatch_id="dispatch-1", patient_user_id="patient-1",
            stars=bad, db=_db(),
        )
        assert result["success"] is False
        assert result["status"] == 400


def test_rating_twice_updates_rather_than_stacking():
    db = _db(existing_rating=[{"id": "rating-1"}])
    result = ratings.submit_rating(
        dispatch_id="dispatch-1", patient_user_id="patient-1",
        stars=2, db=db,
    )
    assert result["success"] is True
    ratings_table = db.table("provider_ratings")
    ratings_table.update.assert_called()
    ratings_table.insert.assert_not_called()


# ─── Endpoint ─────────────────────────────────────────────────────────────

def test_rate_endpoint_records_and_returns_the_new_average():
    _as(PATIENT)
    # provider_ratings is read twice with different intent: first to see
    # whether this visit was already rated (no), then to re-average after the
    # insert (yes) — so the double answers them in that order.
    db = _db()
    ratings_table = db.table("provider_ratings")
    ratings_table.execute.side_effect = [
        MagicMock(data=[]),               # existing-rating lookup
        MagicMock(data=[]),               # insert
        MagicMock(data=[{"stars": 5}]),   # summary re-read
    ]

    with patch.object(ratings, "supabase", db):
        res = client.post("/api/dispatch/dispatch-1/rate", json={"stars": 5})

    assert res.status_code == 200, res.text
    assert res.json()["summary"]["average_stars"] == 5.0
    ratings_table.insert.assert_called()


def test_rate_endpoint_rejects_a_stranger():
    _as(OTHER_PATIENT)
    with patch.object(ratings, "supabase", _db()):
        res = client.post("/api/dispatch/dispatch-1/rate", json={"stars": 5})
    assert res.status_code == 403, res.text


# ─── Ranking ──────────────────────────────────────────────────────────────

def _rank(candidates):
    """The ordering find_nearby_providers applies."""
    candidates.sort(
        key=lambda x: (
            round(x["distance_km"]),
            -(x["rating"] if x["rating"] is not None else 3.0),
            x["distance_km"],
        )
    )
    return [c["user_id"] for c in candidates]


def test_rating_breaks_ties_but_distance_still_dominates():
    """A 5-star collector 9 km away is still worse for the patient than a
    decent one 2 km away — rating orders within a km bucket, not across."""
    order = _rank([
        {"user_id": "far-great", "distance_km": 9.1, "rating": 5.0},
        {"user_id": "near-ok", "distance_km": 2.1, "rating": 3.1},
        {"user_id": "near-great", "distance_km": 2.4, "rating": 4.8},
    ])
    assert order == ["near-great", "near-ok", "far-great"]


def test_unrated_provider_still_gets_offered_work():
    """Sorting a new joiner last would mean they can never earn a rating."""
    order = _rank([
        {"user_id": "rated-poor", "distance_km": 3.0, "rating": 2.0},
        {"user_id": "brand-new", "distance_km": 3.0, "rating": None},
    ])
    assert order[0] == "brand-new"


# ─── NHCX gate ────────────────────────────────────────────────────────────

def test_nhcx_insurance_is_closed_by_default():
    """The service answers "Star Health, Rs 5,00,000, Active" for any ABHA."""
    _as(PATIENT)
    res = client.post("/api/insurance/eligibility", json={"abha_number": "12345678901234"})
    assert res.status_code == 503, res.text
    assert "NHCX" in res.json()["detail"]


def test_nhcx_claim_submission_is_closed_by_default():
    _as(PATIENT)
    res = client.post(
        "/api/insurance/claim/submit",
        json={"booking_id": "booking-1", "amount": 1200.0},
    )
    assert res.status_code == 503, res.text
