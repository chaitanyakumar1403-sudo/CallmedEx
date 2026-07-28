"""
Task 16: wiring `assign_booking` into booking creation.

Before this task, `assign_booking` was fully built and tested but had zero
callers — a home-collection booking never got a processing centre, never got
a sample row, and the advance-roster pass found nothing to assign. These
tests exercise `create_booking` end-to-end (not `assign_booking` in
isolation, which is already covered by test_processing_center.py) to prove
the wiring actually fires, that an unserviced city degrades gracefully
instead of failing checkout, that every pre-existing booking flow is
completely untouched, and that no centre identity reaches the patient.
"""
import uuid

import pytest

import app.routers.bookings as bookings_mod
import app.routers.family_members as fm_mod
import app.services.marketplace as marketplace_mod
import app.services.processing_center as pc_mod
from app.models.schemas import BookingCreate, ServiceType
from app.routers.bookings import create_booking
from app.services.marketplace import MarketplaceService
from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(bookings_mod, "supabase", fake)
    monkeypatch.setattr(fm_mod, "supabase", fake)
    monkeypatch.setattr(marketplace_mod, "supabase", fake)
    monkeypatch.setattr(pc_mod, "supabase", fake)
    MarketplaceService.invalidate_catalog()
    yield fake
    MarketplaceService.invalidate_catalog()


# ── Marketplace (old, org-based) seed helpers — mirrors test_marketplace.py ──

def _seed_catalog(fake, name, slug, category="lab_test", turnaround=6):
    cid = str(uuid.uuid4())
    fake.db.setdefault("service_catalog", []).append({
        "id": cid, "name": name, "slug": slug, "synonyms": [],
        "category": category, "is_active": True,
        "typical_turnaround_hours": turnaround,
    })
    return cid


def _seed_home_capable_provider(fake, catalog_id, city="hyderabad", mrp=350):
    """A verified, listed organization offering this test at home — this is
    what makes MarketplaceService.select_fulfilment's `walk_in_required` False."""
    pid = str(uuid.uuid4())
    fake.db.setdefault("provider_directory", []).append({
        "provider_user_id": pid, "display_name": "A Partner Centre",
        "provider_type": "organization", "subtype": "diagnostic_center",
        "city": city, "state": "AP", "rating": 5.0,
        "verification_status": "verified", "is_listed": True,
    })
    fake.db.setdefault("provider_settings", []).append({
        "provider_user_id": pid, "partner_discount_pct": 0,
        "home_service_enabled": True, "is_listed": True,
    })
    fake.db.setdefault("provider_services", []).append({
        "id": str(uuid.uuid4()), "provider_user_id": pid, "catalog_id": catalog_id,
        "name": "CBC", "mrp": mrp, "base_price": mrp, "home_available": True,
        "urgent_available": False, "is_active": True, "category": "lab_test",
    })
    fake.db.setdefault("organizations", []).append({
        "id": str(uuid.uuid4()), "user_id": pid,
    })
    return pid


# ── Processing centre (new) seed helpers — mirrors test_processing_center.py ─

def _seed_centre(fake, code, city, status="active"):
    cid = str(uuid.uuid4())
    fake.db.setdefault("processing_centers", []).append({
        "id": cid, "code": code, "name": code, "city": city,
        "lat": None, "lng": None, "status": status,
        "partner_lab_name": "", "daily_capacity": 0,
    })
    return cid


def _seed_area(fake, cid, city):
    fake.db.setdefault("processing_center_areas", []).append({
        "id": str(uuid.uuid4()), "processing_center_id": cid,
        "city": city, "pincode": None, "radius_km": None,
        "priority": 100, "is_active": True,
    })


def _seed_home_service(fake, code, name, tube="edta_lavender", base_price=350.0):
    sid = str(uuid.uuid4())
    fake.db.setdefault("home_services", []).append({
        "id": sid, "code": code, "name": name, "base_price": base_price,
        "is_active": True,
    })
    fake.db.setdefault("home_service_tubes", []).append({
        "home_service_id": sid, "tube_type_code": tube, "volume_ml": 3.0,
    })
    return sid


def _home_booking(**overrides):
    fields = dict(
        provider_id="", provider_type="",
        service_type=ServiceType.LAB_TEST,
        slot_id="", preferred_date="2026-07-29",
        selected_tests=["CBC"], total_price=350,
        city="Hyderabad", home=True,
    )
    fields.update(overrides)
    return BookingCreate(**fields)


# ── 1. Happy path: centre assigned, samples created ─────────────────────────

@pytest.mark.asyncio
async def test_home_collection_booking_gets_a_centre_and_samples(fake_db):
    cid_catalog = _seed_catalog(fake_db, "Complete Blood Count", "cbc")
    _seed_home_capable_provider(fake_db, cid_catalog, city="hyderabad")
    centre_id = _seed_centre(fake_db, "HYD-01", "hyderabad")
    _seed_area(fake_db, centre_id, "hyderabad")
    _seed_home_service(fake_db, "CBC", "Complete Blood Count")

    patient_id = str(uuid.uuid4())
    booking = _home_booking(catalog_id=cid_catalog)

    result = await create_booking(
        booking, current_user={"sub": patient_id, "role": "patient", "full_name": "Asha Rao"}
    )
    assert result.success

    row = fake_db.db["bookings"][0]
    assert row["booking_kind"] == "home_collection"
    assert row["collection_city"] == "Hyderabad"
    assert row["processing_center_id"] == centre_id
    assert row["provider_id"] == centre_id
    assert row["provider_type"] == "processing_center"

    samples = fake_db.db["samples"]
    assert len(samples) == 1
    assert samples[0]["status"] == "pending_collection"
    assert samples[0]["barcode"] is None
    assert samples[0]["processing_center_id"] == centre_id

    subjects = fake_db.db["booking_subjects"]
    assert len(subjects) == 1
    tests = fake_db.db["booking_tests"]
    assert len(tests) == 1

    # The account holder must have gotten a `self` family_members row.
    members = fake_db.db["family_members"]
    assert len(members) == 1
    assert members[0]["is_self"] is True
    assert members[0]["account_user_id"] == patient_id


@pytest.mark.asyncio
async def test_an_unmatched_selected_test_is_skipped_not_invented(fake_db):
    """A test name that matches no home_services row must not silently vanish
    as a made-up sample, but must also not take the whole booking down."""
    cid_catalog = _seed_catalog(fake_db, "Complete Blood Count", "cbc")
    _seed_home_capable_provider(fake_db, cid_catalog, city="hyderabad")
    centre_id = _seed_centre(fake_db, "HYD-01", "hyderabad")
    _seed_area(fake_db, centre_id, "hyderabad")
    _seed_home_service(fake_db, "CBC", "Complete Blood Count")

    booking = _home_booking(
        catalog_id=cid_catalog, selected_tests=["CBC", "Some Discontinued Test"]
    )
    result = await create_booking(
        booking, current_user={"sub": str(uuid.uuid4()), "role": "patient", "full_name": "X"}
    )
    assert result.success

    # One resolvable test -> one booking_tests row -> one sample. The
    # unresolved entry produced nothing, but nothing crashed either.
    assert len(fake_db.db["booking_tests"]) == 1
    assert len(fake_db.db["samples"]) == 1
    assert fake_db.db["bookings"][0]["processing_center_id"] == centre_id


# ── 2. Unserviced city: booking still succeeds, no centre, no samples ───────

@pytest.mark.asyncio
async def test_unserviced_city_booking_still_succeeds(fake_db):
    cid_catalog = _seed_catalog(fake_db, "Complete Blood Count", "cbc")
    # A home-capable partner exists in Rajahmundry (old marketplace), but no
    # processing centre covers it (new processing-centre layer).
    _seed_home_capable_provider(fake_db, cid_catalog, city="rajahmundry")
    _seed_home_service(fake_db, "CBC", "Complete Blood Count")

    booking = _home_booking(catalog_id=cid_catalog, city="Rajahmundry")
    result = await create_booking(
        booking, current_user={"sub": str(uuid.uuid4()), "role": "patient", "full_name": "Y"}
    )

    assert result.success
    row = fake_db.db["bookings"][0]
    assert row["booking_kind"] == "home_collection"
    assert row.get("processing_center_id") is None
    assert fake_db.db.get("samples", []) == []


# ── 3. Walk-in / non-home bookings are completely untouched ─────────────────

@pytest.mark.asyncio
async def test_walk_in_required_booking_is_left_alone(fake_db):
    """Patient asked for home (`home=True`), but no partner in this city can
    do it at home — `walk_in_required` is True, and the whole processing-
    centre bridge must not fire even though `home` was set."""
    cid_catalog = _seed_catalog(fake_db, "MRI", "mri")
    # Provider offers the test, but NOT at home.
    pid = str(uuid.uuid4())
    fake_db.db.setdefault("provider_directory", []).append({
        "provider_user_id": pid, "display_name": "Walk-in Only Centre",
        "provider_type": "organization", "subtype": "diagnostic_center",
        "city": "hyderabad", "state": "AP", "rating": 5.0,
        "verification_status": "verified", "is_listed": True,
    })
    fake_db.db.setdefault("provider_settings", []).append({
        "provider_user_id": pid, "partner_discount_pct": 0,
        "home_service_enabled": False, "is_listed": True,
    })
    fake_db.db.setdefault("provider_services", []).append({
        "id": str(uuid.uuid4()), "provider_user_id": pid, "catalog_id": cid_catalog,
        "name": "MRI", "mrp": 3000, "base_price": 3000, "home_available": False,
        "urgent_available": False, "is_active": True, "category": "imaging",
    })
    fake_db.db.setdefault("organizations", []).append({"id": str(uuid.uuid4()), "user_id": pid})

    booking = _home_booking(
        catalog_id=cid_catalog, service_type=ServiceType.IMAGING, selected_tests=["MRI"],
    )
    result = await create_booking(
        booking, current_user={"sub": str(uuid.uuid4()), "role": "patient", "full_name": "Z"}
    )
    assert result.success

    row = fake_db.db["bookings"][0]
    assert row.get("booking_kind") != "home_collection"
    assert row.get("processing_center_id") is None
    assert fake_db.db.get("booking_subjects", []) == []
    assert fake_db.db.get("booking_tests", []) == []
    assert fake_db.db.get("samples", []) == []


@pytest.mark.asyncio
async def test_a_plain_provider_selected_booking_is_untouched(fake_db):
    """A doctor/nurse-style booking where the patient (or an earlier step)
    already supplied provider_id/provider_type directly never enters the
    allocation branch at all, so it must be a complete no-op for this task."""
    provider_id = str(uuid.uuid4())
    booking = BookingCreate(
        provider_id=provider_id, provider_type="doctor",
        service_type=ServiceType.DOCTOR_APPOINTMENT,
        slot_id=f"{provider_id}|2026-07-29|09:00",
        total_price=500,
    )
    result = await create_booking(
        booking, current_user={"sub": str(uuid.uuid4()), "role": "patient", "full_name": "W"}
    )
    assert result.success

    row = fake_db.db["bookings"][0]
    assert row["provider_id"] == provider_id
    assert row["provider_type"] == "doctor"
    assert row.get("booking_kind") != "home_collection"
    assert fake_db.db.get("booking_subjects", []) == []
    assert fake_db.db.get("booking_tests", []) == []
    assert fake_db.db.get("samples", []) == []
    assert fake_db.db.get("family_members", []) == []


# ── 4. No centre/lab identity in the patient response ───────────────────────

@pytest.mark.asyncio
async def test_patient_response_leaks_no_centre_identity(fake_db):
    import json

    cid_catalog = _seed_catalog(fake_db, "Complete Blood Count", "cbc")
    _seed_home_capable_provider(fake_db, cid_catalog, city="hyderabad")
    centre_id = _seed_centre(fake_db, "HYD-01", "hyderabad")
    _seed_area(fake_db, centre_id, "hyderabad")
    _seed_home_service(fake_db, "CBC", "Complete Blood Count")

    booking = _home_booking(catalog_id=cid_catalog)
    result = await create_booking(
        booking, current_user={"sub": str(uuid.uuid4()), "role": "patient", "full_name": "Asha"}
    )

    blob = json.dumps(
        result.model_dump() if hasattr(result, "model_dump") else result, default=str
    ).lower()

    assert centre_id.lower() not in blob
    assert "processing_center" not in blob
    assert "hyd-01" not in blob
    assert "laboratory" not in blob
