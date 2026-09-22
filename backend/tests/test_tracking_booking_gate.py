from datetime import datetime, timedelta, timezone

import pytest

import app.services.dispatch_engine as de
from tests.test_sample_lifecycle import FakeSupabase

IST = timezone(timedelta(hours=5, minutes=30))


@pytest.fixture
def db(monkeypatch):
    fake = FakeSupabase()
    fake.db["users"] = [{"id": "ph-1", "full_name": "R Venkata Ramana Murthy"}]
    fake.db["provider_locations"] = [{"user_id": "ph-1", "current_lat": 17.72, "current_lng": 83.30, "users": {"full_name": "R Venkata Ramana Murthy"}}]
    monkeypatch.setattr(de, "supabase", fake)
    return fake


def _dispatch(db, booking_status, scheduled_for, status="provider_accepted"):
    db.db["bookings"] = [{"id": "b1", "status": booking_status, "slot_id": f"x|{scheduled_for}|07:00"}]
    db.db["dispatch_requests"] = [{
        "id": "d1", "booking_id": "b1", "status": status, "assignment_mode": "advance",
        "scheduled_for": scheduled_for, "assigned_provider_id": "ph-1", "provider_type": "phlebotomist",
        "patient_lat": 17.73, "patient_lng": 83.31,
    }]


@pytest.mark.asyncio
async def test_closed_booking_closes_its_tracking(db):
    tomorrow = (datetime.now(IST) + timedelta(days=1)).date().isoformat()
    _dispatch(db, "cancelled", tomorrow)
    out = await de.UniversalDispatchEngine.get_live_tracking("d1")
    assert out["status"] == "cancelled"


@pytest.mark.asyncio
async def test_advance_job_for_a_past_day_is_not_tracked(db):
    yesterday = (datetime.now(IST) - timedelta(days=1)).date().isoformat()
    _dispatch(db, "confirmed", yesterday)
    out = await de.UniversalDispatchEngine.get_live_tracking("d1")
    assert out["status"] == "cancelled"


@pytest.mark.asyncio
async def test_advance_job_before_travel_hides_live_location(db):
    tomorrow = (datetime.now(IST) + timedelta(days=1)).date().isoformat()
    _dispatch(db, "confirmed", tomorrow)
    out = await de.UniversalDispatchEngine.get_live_tracking("d1")
    assert out["status"] == "provider_accepted" and out["assignment_mode"] == "advance"
    assert out["slot_time"] == "07:00"
    assert out["provider"] == {"name": "R Venkata Ramana Murthy"}  # no lat/lng/eta
