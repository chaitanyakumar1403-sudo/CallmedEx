"""
Leak guards.

A patient books from CallMedex. They must never learn which processing centre
or which laboratory handled their sample — that is the entire premise of the
model, and it is one careless select("*") away from being false.

These tests assert against SERIALISED JSON so a leak fails the build rather
than shipping quietly.
"""
import json
import uuid

import pytest

import app.routers.bookings as bookings_mod
import app.routers.home_services as hs_mod
import app.services.processing_center as pc_mod
import app.services.samples as samples_mod
from app.routers.bookings import get_my_bookings
from app.routers.home_services import coverage, patient_search
from app.routers.samples import track_sample
from tests.test_sample_lifecycle import FakeSupabase

FORBIDDEN = (
    "processing_center",
    "processing_center_id",
    "partner_lab",
    "partner_lab_name",
    "laboratory",
    "laboratory_name",
    "laboratory_org_id",
    "HYD-01",
    "VSP-01",
)


@pytest.fixture
def db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(hs_mod, "supabase", fake)
    monkeypatch.setattr(pc_mod, "supabase", fake)

    centre_id = str(uuid.uuid4())
    fake.db["processing_centers"] = [{
        "id": centre_id, "code": "HYD-01", "name": "Hyderabad Processing Centre 01",
        "city": "hyderabad", "lat": 17.385, "lng": 78.487, "status": "active",
        "partner_lab_name": "Some Partner Laboratory Pvt Ltd",
        "partner_lab_reference": "SPL-9931", "daily_capacity": 400,
    }]
    fake.db["processing_center_areas"] = [{
        "id": str(uuid.uuid4()), "processing_center_id": centre_id,
        "city": "hyderabad", "pincode": None, "radius_km": None,
        "priority": 100, "is_active": True,
    }]
    fake.db["city_aliases"] = [{"alias": "hyderabad", "canonical_city": "hyderabad"}]
    fake.db["home_services"] = [{
        "id": str(uuid.uuid4()), "code": "CBC", "name": "Complete Blood Count",
        "service_kind": "blood_test", "category": "blood_test", "description": "",
        "base_price": 350.0, "is_active": True, "home_collection_available": True,
        "fasting_required": False, "fasting_hours": 0,
        "preparation_instructions": "", "estimated_report_hours": 6,
    }]
    return fake


def _assert_clean(payload):
    blob = json.dumps(payload, default=str).lower()
    for needle in FORBIDDEN:
        assert needle.lower() not in blob, f"leaked {needle!r} in {blob}"


@pytest.mark.asyncio
async def test_patient_search_leaks_no_centre_or_laboratory(db):
    # q=None explicitly: calling the handler directly bypasses FastAPI's
    # dependency resolution, so the bare `Query(default=None)` sentinel would
    # otherwise reach the function as-is instead of being resolved to None.
    _assert_clean(await patient_search(city="Hyderabad", q=None))


@pytest.mark.asyncio
async def test_patient_search_still_returns_a_usable_price(db):
    """The guard must not pass by returning nothing."""
    result = await patient_search(city="Hyderabad", q=None)
    assert result["serviceable"] is True
    assert result["services"][0]["price"] == 350.0
    assert result["services"][0]["name"] == "Complete Blood Count"


@pytest.mark.asyncio
async def test_coverage_returns_a_boolean_and_nothing_else(db):
    assert await coverage(city="Hyderabad") == {"serviceable": True}
    assert await coverage(city="Rajahmundry") == {"serviceable": False}


@pytest.mark.asyncio
async def test_an_unserviced_search_leaks_nothing_either(db):
    _assert_clean(await patient_search(city="Rajahmundry", q=None))


def test_the_patient_field_allowlist_excludes_every_internal_column():
    """Match on name SEGMENTS, not substrings: 'available' contains 'lab'."""
    from app.routers.home_services import PATIENT_FIELDS
    banned = {"center", "centre", "lab", "laboratory", "partner", "processing"}
    for field in PATIENT_FIELDS:
        segments = set(field.split("_"))
        assert not (segments & banned), f"{field} exposes {segments & banned}"


def test_home_services_and_walk_in_services_are_different_tables():
    """A diagnostic centre publishes walk-in imaging; it publishes nothing a
    phlebotomist delivers."""
    from pathlib import Path
    router = (Path(__file__).resolve().parents[1] / "app" / "routers"
              / "home_services.py").read_text(encoding="utf-8")
    assert "provider_services" not in router


# ── C2: pre-existing patient endpoints leaking columns THIS migration added ──
#
# home_services.py's PATIENT_FIELDS guard only ever covered the two brand-new
# patient endpoints. Nobody re-checked the PRE-EXISTING /api/samples/{id}/track
# and /api/bookings/my endpoints against the centre/laboratory columns this
# migration bolted onto `samples`, `sample_events` and `bookings`.

@pytest.fixture
def samples_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(samples_mod, "supabase", fake)
    return fake


@pytest.mark.asyncio
async def test_patient_sample_tracking_leaks_no_centre_or_lab_reference(samples_db):
    patient_id = str(uuid.uuid4())
    centre_id = str(uuid.uuid4())
    batch_id = str(uuid.uuid4())
    sample_id = str(uuid.uuid4())

    samples_db.db["samples"] = [{
        "id": sample_id, "barcode": "CMX-000001-ABCDEF",
        "patient_id": patient_id, "phlebotomist_user_id": str(uuid.uuid4()),
        "destination_org_user_id": str(uuid.uuid4()),
        "processing_center_id": centre_id, "batch_id": batch_id,
        "lab_reference": "LABREF-XYZ-999",
        "status": "received", "sample_type": "blood",
    }]
    samples_db.db["sample_events"] = [{
        "id": str(uuid.uuid4()), "sample_id": sample_id, "event": "received",
        "processing_center_id": centre_id, "location_label": "Bench 3, HYD-01",
        "actor_role": "staff", "created_at": "2026-07-28T00:00:00Z",
    }]

    result = await track_sample(sample_id, current_user={"sub": patient_id, "role": "patient"})

    blob = json.dumps(result, default=str)
    assert "LABREF-XYZ-999" not in blob
    assert centre_id not in blob
    assert batch_id not in blob
    assert "processing_center" not in blob
    assert "lab_reference" not in blob
    assert "batch_id" not in blob
    assert "location_label" not in blob

    # The guard must not pass by returning nothing useful.
    assert result["sample"]["status"] == "received"
    assert result["sample"]["barcode"] == "CMX-000001-ABCDEF"
    assert len(result["sample"]["events"]) == 1


@pytest.mark.asyncio
async def test_non_patient_callers_still_get_the_full_custody_trail(samples_db):
    """Staff/phlebotomist/admin callers are NOT patients — narrowing the leak
    fix to the patient path must not blind the centre or the collector."""
    patient_id = str(uuid.uuid4())
    phlebo_id = str(uuid.uuid4())
    centre_id = str(uuid.uuid4())
    sample_id = str(uuid.uuid4())

    samples_db.db["samples"] = [{
        "id": sample_id, "barcode": "CMX-000002-ABCDEF",
        "patient_id": patient_id, "phlebotomist_user_id": phlebo_id,
        "destination_org_user_id": str(uuid.uuid4()),
        "processing_center_id": centre_id, "batch_id": str(uuid.uuid4()),
        "lab_reference": "LABREF-INTERNAL-001",
        "status": "received", "sample_type": "blood",
    }]
    samples_db.db["sample_events"] = []

    result = await track_sample(sample_id, current_user={"sub": phlebo_id, "role": "phlebotomist"})
    assert result["sample"]["processing_center_id"] == centre_id
    assert result["sample"]["lab_reference"] == "LABREF-INTERNAL-001"


@pytest.fixture
def bookings_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(bookings_mod, "supabase", fake)
    return fake


@pytest.mark.asyncio
async def test_patient_bookings_list_leaks_no_centre_identity(bookings_db):
    patient_id = str(uuid.uuid4())
    centre_id = str(uuid.uuid4())

    bookings_db.db["bookings"] = [{
        "id": str(uuid.uuid4()), "patient_id": patient_id,
        "provider_id": centre_id, "provider_type": "processing_center",
        "processing_center_id": centre_id,
        "service_type": "lab_test", "status": "confirmed",
        "slot_start": "2026-07-29T08:00:00", "slot_end": "2026-07-29T08:30:00",
        "created_at": "2026-07-28T00:00:00Z",
    }]

    result = await get_my_bookings(current_user={"sub": patient_id})

    blob = json.dumps(result.model_dump() if hasattr(result, "model_dump") else result, default=str)
    assert centre_id not in blob
    assert "processing_center" not in blob

    bookings_out = (
        result.data["bookings"] if hasattr(result, "data") else result["data"]["bookings"]
    )
    assert len(bookings_out) == 1
    assert bookings_out[0]["status"] == "confirmed"          # still usable


@pytest.mark.asyncio
async def test_a_non_processing_center_booking_keeps_its_provider_fields(bookings_db):
    """The fix targets the processing-centre abstraction specifically — a
    walk-in organization booking's provider_id/provider_type must survive."""
    patient_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())

    bookings_db.db["bookings"] = [{
        "id": str(uuid.uuid4()), "patient_id": patient_id,
        "provider_id": org_id, "provider_type": "organization",
        "service_type": "lab_test", "status": "pending_review",
        "created_at": "2026-07-28T00:00:00Z",
    }]

    result = await get_my_bookings(current_user={"sub": patient_id})
    bookings_out = (
        result.data["bookings"] if hasattr(result, "data") else result["data"]["bookings"]
    )
    assert bookings_out[0]["provider_id"] == org_id
    assert bookings_out[0]["provider_type"] == "organization"
