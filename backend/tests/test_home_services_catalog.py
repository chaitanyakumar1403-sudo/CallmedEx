"""
Home-service catalog tests.

The catalog is CallMedex's. A diagnostic centre publishes walk-in imaging in
provider_services; it does not publish anything a phlebotomist delivers.
"""
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
