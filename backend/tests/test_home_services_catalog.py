"""
Home-service catalog tests.

The catalog is CallMedex's. A diagnostic centre publishes walk-in imaging in
provider_services; it does not publish anything a phlebotomist delivers.
"""
import re
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[2] / "database" / "task1_processing_center_foundation.sql"


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def test_catalog_tables_are_created():
    sql = _sql()
    for table in ("tube_types", "home_services",
                  "home_service_tubes", "home_service_city_pricing"):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in sql, table


def test_the_table_is_home_services_not_blood_tests():
    """service_kind lets ECG and home vitals land as rows, not a migration."""
    sql = _sql()
    assert "CREATE TABLE IF NOT EXISTS blood_tests" not in sql
    assert "service_kind" in sql
    for kind in ("'blood_test'", "'ecg'", "'vitals'"):
        assert kind in sql, kind


def test_all_ten_named_blood_tests_are_seeded():
    sql = _sql()
    for code in ("CBC", "LFT", "KFT", "LIPID", "HBA1C",
                 "THYROID", "VITD", "VITB12", "ESR", "CRP"):
        assert f"'{code}'" in sql, code


def test_five_tube_types_are_seeded():
    sql = _sql()
    for tube in ("edta_lavender", "sst_gold", "citrate_blue",
                 "fluoride_grey", "plain_red"):
        assert f"'{tube}'" in sql, tube


def test_pricing_override_is_keyed_on_centre():
    """CallMedex may price Vizag differently from Hyderabad. The centre may not."""
    sql = _sql()
    assert "UNIQUE (home_service_id, processing_center_id)" in sql


def test_family_and_booking_tables_are_created():
    sql = _sql()
    for table in ("family_members", "booking_subjects", "booking_tests"):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in sql, table


def test_bookings_gains_an_explicit_centre_reference():
    sql = _sql()
    assert "ADD COLUMN IF NOT EXISTS processing_center_id" in sql
    assert "booking_kind" in sql


def test_doorstep_addons_are_representable():
    """Spec 3 adds tests at the doorstep; the incentive rules already expect it."""
    sql = _sql()
    assert "'doorstep_addon'" in sql
    assert "added_by" in sql


def test_deleting_a_family_member_cannot_destroy_booking_history():
    """A cascade here would silently wipe prices and the added_by audit trail
    for every booking that person was ever part of."""
    sql = _sql()
    match = re.search(
        r"CREATE TABLE IF NOT EXISTS booking_subjects\s*\((.*?)\);",
        sql, re.S)
    assert match, "booking_subjects table not found"
    body = match.group(1)
    fm_line = [l for l in body.splitlines() if "family_member_id" in l and "REFERENCES" in l]
    assert fm_line, "family_member_id FK not found"
    assert "ON DELETE CASCADE" not in fm_line[0], (
        "booking_subjects.family_member_id must not cascade: deleting a family "
        f"member would destroy booking history. Found: {fm_line[0].strip()}")


import uuid

import pytest

import app.routers.home_services as hs_mod
from app.routers.home_services import price_for_city, soft_delete_home_service
from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(hs_mod, "supabase", fake)
    # urgent_surcharge_for_service delegates to PricingService, which holds its
    # own module-level client. Patch both or the surcharge tests silently read
    # the real database.
    import app.services.marketplace as marketplace_mod
    monkeypatch.setattr(marketplace_mod, "supabase", fake)
    return fake


def _service(fake, code="CBC", base=350.0, active=True):
    sid = str(uuid.uuid4())
    fake.db.setdefault("home_services", []).append({
        "id": sid, "code": code, "name": code, "service_kind": "blood_test",
        "base_price": base, "is_active": active, "category": "blood_test",
        "description": "", "fasting_required": False, "fasting_hours": 0,
        "preparation_instructions": "", "estimated_report_hours": 6,
        "home_collection_available": True,
    })
    return sid


def test_base_price_is_used_when_no_override_exists(db):
    sid = _service(db, base=350.0)
    assert price_for_city(sid, str(uuid.uuid4())) == 350.0


def test_a_city_override_wins_over_the_base_price(db):
    sid, centre = _service(db, base=350.0), str(uuid.uuid4())
    db.db.setdefault("home_service_city_pricing", []).append({
        "home_service_id": sid, "processing_center_id": centre,
        "price": 299.0, "is_active": True,
    })
    assert price_for_city(sid, centre) == 299.0


def test_an_inactive_override_falls_back_to_base(db):
    sid, centre = _service(db, base=350.0), str(uuid.uuid4())
    db.db.setdefault("home_service_city_pricing", []).append({
        "home_service_id": sid, "processing_center_id": centre,
        "price": 299.0, "is_active": False,
    })
    assert price_for_city(sid, centre) == 350.0


def test_another_citys_override_does_not_leak(db):
    sid = _service(db, base=350.0)
    db.db.setdefault("home_service_city_pricing", []).append({
        "home_service_id": sid, "processing_center_id": "hyderabad-centre",
        "price": 299.0, "is_active": True,
    })
    assert price_for_city(sid, "vizag-centre") == 350.0


def _seed_urgent_config(fake, confirmed, flat=200):
    fake.db.setdefault("platform_settings", []).append({
        "key": "urgent_surcharge",
        "value": {"mode": "flat", "flat_inr": flat, "percent": 0,
                  "min_inr": 0, "max_inr": 1000, "confirmed": confirmed},
    })


def test_an_unconfirmed_platform_rate_charges_nothing(db):
    """Commit 68ea5eb: never quote a surcharge nobody has agreed to."""
    from app.routers.home_services import urgent_surcharge_for_service
    sid = _service(db, base=350.0)
    _seed_urgent_config(db, confirmed=False)
    assert urgent_surcharge_for_service(sid, 350.0) == 0.0


def test_a_confirmed_platform_rate_is_used_when_there_is_no_override(db):
    from app.routers.home_services import urgent_surcharge_for_service
    sid = _service(db, base=350.0)
    _seed_urgent_config(db, confirmed=True, flat=200)
    assert urgent_surcharge_for_service(sid, 350.0) == 200.0


def test_a_per_service_override_beats_the_platform_rate(db):
    """An urgent CBC may be priced differently from an urgent Vitamin D."""
    from app.routers.home_services import urgent_surcharge_for_service
    sid = _service(db, base=350.0)
    db.db["home_services"][0]["urgent_surcharge_override"] = 120.0
    _seed_urgent_config(db, confirmed=True, flat=200)
    assert urgent_surcharge_for_service(sid, 350.0) == 120.0


def test_an_override_applies_even_when_the_platform_rate_is_unconfirmed(db):
    """The override IS the agreed rate for this test, so it stands alone."""
    from app.routers.home_services import urgent_surcharge_for_service
    sid = _service(db, base=350.0)
    db.db["home_services"][0]["urgent_surcharge_override"] = 120.0
    _seed_urgent_config(db, confirmed=False)
    assert urgent_surcharge_for_service(sid, 350.0) == 120.0


def test_a_zero_override_is_honoured_rather_than_treated_as_unset(db):
    """0 is a deliberate 'no surcharge on this test', not a missing value."""
    from app.routers.home_services import urgent_surcharge_for_service
    sid = _service(db, base=350.0)
    db.db["home_services"][0]["urgent_surcharge_override"] = 0.0
    _seed_urgent_config(db, confirmed=True, flat=200)
    assert urgent_surcharge_for_service(sid, 350.0) == 0.0


def test_delete_is_soft_when_the_service_has_been_booked(db):
    sid = _service(db)
    db.db.setdefault("booking_tests", []).append({
        "id": str(uuid.uuid4()), "home_service_id": sid,
        "booking_subject_id": str(uuid.uuid4()), "price_charged": 350.0,
    })
    assert soft_delete_home_service(sid)["hard_deleted"] is False
    assert db.db["home_services"][0]["is_active"] is False


def test_a_never_booked_service_can_be_hard_deleted(db):
    sid = _service(db)
    assert soft_delete_home_service(sid)["hard_deleted"] is True
    assert db.db["home_services"] == []
