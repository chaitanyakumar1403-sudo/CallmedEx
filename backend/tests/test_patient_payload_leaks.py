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

import app.routers.home_services as hs_mod
import app.services.processing_center as pc_mod
from app.routers.home_services import coverage, patient_search
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
