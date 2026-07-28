"""
Processing Center foundation tests.

The centre is an internal operational entity. Three things must hold:
  1. A booking always resolves to exactly one centre, deterministically.
  2. A city with no centre is refused BEFORE payment, never after.
  3. No centre or laboratory identity ever reaches a patient.
"""
import re
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[2] / "database" / "task1_processing_center_foundation.sql"


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def test_migration_exists_and_is_transactional():
    sql = _sql()
    assert sql.lstrip().startswith("BEGIN;")
    assert "COMMIT;" in sql
    assert "NOTIFY pgrst, 'reload schema';" in sql


def test_centre_tables_are_created():
    sql = _sql()
    for table in (
        "processing_centers",
        "processing_center_staff",
        "processing_center_areas",
        "city_aliases",
    ):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in sql, table


def test_every_new_table_has_a_deny_all_rls_policy():
    """The backend uses the service key and bypasses RLS; the frontend has no
    Supabase client at all. Anything reachable by anon is a bug."""
    sql = _sql()
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "Deny all access" in sql
    for table in ("processing_centers", "processing_center_staff",
                  "processing_center_areas", "city_aliases"):
        assert f"'{table}'" in sql, f"{table} missing from the RLS loop"


def test_seed_invents_no_laboratory_and_no_verified_status():
    """Commits c5d0fb3 and 68ea5eb: never seed a fake verified facility."""
    sql = _sql()
    assert "'HYD-01'" in sql and "'VSP-01'" in sql

    # Isolate the seed INSERT and assert on ITS column list and values, so this
    # test can actually fail if someone adds a laboratory name later.
    seed = re.search(
        r"INSERT INTO processing_centers\s*\(([^)]*)\)\s*VALUES(.*?);",
        sql, re.S)
    assert seed, "processing_centers seed INSERT not found"
    columns, values = seed.group(1), seed.group(2)

    assert "partner_lab_name" not in columns, "seed must not name a laboratory"
    assert "partner_lab_reference" not in columns
    assert "'onboarding'" in values, "centres must seed as onboarding"
    for forbidden in ("'active'", "'verified'"):
        assert forbidden not in values, f"seed must not pre-{forbidden.strip(chr(39))}"
