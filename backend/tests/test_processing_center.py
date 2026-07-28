"""
Processing Center foundation tests.

The centre is an internal operational entity. Three things must hold:
  1. A booking always resolves to exactly one centre, deterministically.
  2. A city with no centre is refused BEFORE payment, never after.
  3. No centre or laboratory identity ever reaches a patient.
"""
import re
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException

import app.middleware.pc_auth as pc_auth_mod
from app.middleware.pc_auth import get_current_pc_staff, require_pc_admin
from tests.test_sample_lifecycle import FakeSupabase

MIGRATION = Path(__file__).resolve().parents[2] / "database" / "task1_processing_center_foundation.sql"

NOTIFY_STMT = "NOTIFY pgrst, 'reload schema';"

# Any statement that writes to processing_centers (the house style seeds via
# INSERT ... ON CONFLICT DO NOTHING, but this also catches a later UPDATE).
PC_WRITE_STMT_RE = re.compile(
    r"(INSERT INTO processing_centers\b.*?;|UPDATE processing_centers\b.*?;)",
    re.S,
)


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def test_migration_exists_and_is_transactional():
    sql = _sql()

    # House style (database/phase1_sample_lifecycle.sql) puts a header comment
    # block before BEGIN;. Strip leading blank lines and `--` comment lines so
    # the first *real* statement is what gets checked, rather than requiring
    # the raw file to start with the literal text "BEGIN;".
    lines = sql.splitlines()
    i = 0
    while i < len(lines) and (not lines[i].strip() or lines[i].strip().startswith("--")):
        i += 1
    first_statement = "\n".join(lines[i:]).lstrip()
    assert first_statement.startswith("BEGIN;"), "first real statement must be BEGIN;"

    assert "COMMIT;" in sql
    assert NOTIFY_STMT in sql

    # NOTIFY must fire only after the transaction lands, never inside it.
    commit_pos = sql.index("COMMIT;")
    notify_pos = sql.index(NOTIFY_STMT)
    assert commit_pos < notify_pos, "NOTIFY must come after COMMIT, not inside the transaction"

    # NOTIFY must be the final statement: nothing but blank lines/comments
    # may trail it.
    after_notify = sql[notify_pos + len(NOTIFY_STMT):]
    for line in after_notify.splitlines():
        stripped = line.strip()
        assert not stripped or stripped.startswith("--"), (
            f"NOTIFY must be the final statement; found trailing content: {stripped!r}"
        )


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
    """Commits c5d0fb3 and 68ea5eb: never seed a fake verified facility.

    Checked two ways:
      1. The seed INSERT's own column list/values (catches a laboratory name
         or a pre-verified status sneaking into the seed itself).
      2. Every statement anywhere in the migration that writes to
         processing_centers (catches a later UPDATE that fabricates a lab
         name or flips a centre to 'active'/'verified' after a clean seed).
    """
    sql = _sql()
    assert "'HYD-01'" in sql and "'VSP-01'" in sql

    # --- 1. The seed INSERT's column list and values ---
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

    # --- 2. Every INSERT/UPDATE against processing_centers, anywhere ---
    write_statements = PC_WRITE_STMT_RE.findall(sql)
    assert write_statements, "expected at least the seed INSERT against processing_centers"

    for stmt in write_statements:
        for col in ("partner_lab_name", "partner_lab_reference"):
            m = re.search(col + r"\s*=\s*'([^']*)'", stmt)
            if m:
                assert m.group(1) == "", (
                    f"{col} must never be assigned a non-empty value: {stmt!r}"
                )

        bad_status = re.search(r"\bstatus\s*=\s*'(active|verified)'", stmt)
        if bad_status:
            raise AssertionError(
                f"processing_centers.status must never be force-set to "
                f"{bad_status.group(1)!r}: {stmt!r}"
            )


# ── PC auth tests ────────────────────────────────────────────────────────────

@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(pc_auth_mod, "supabase", fake)
    return fake


def _seed_staff(fake, pc_role="technician", is_active=True):
    uid, cid = str(uuid.uuid4()), str(uuid.uuid4())
    fake.db.setdefault("processing_center_staff", []).append({
        "id": str(uuid.uuid4()), "processing_center_id": cid,
        "user_id": uid, "pc_role": pc_role, "is_active": is_active,
    })
    return uid, cid


@pytest.mark.asyncio
async def test_staff_resolves_to_their_centre(fake_db):
    uid, cid = _seed_staff(fake_db)
    staff = await get_current_pc_staff({"sub": uid, "role": "processing_center"})
    assert staff["processing_center_id"] == cid
    assert staff["pc_role"] == "technician"


@pytest.mark.asyncio
async def test_a_non_pc_role_is_rejected(fake_db):
    uid, _ = _seed_staff(fake_db)
    with pytest.raises(HTTPException) as exc:
        await get_current_pc_staff({"sub": uid, "role": "patient"})
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_a_deactivated_staff_member_is_rejected(fake_db):
    uid, _ = _seed_staff(fake_db, is_active=False)
    with pytest.raises(HTTPException) as exc:
        await get_current_pc_staff({"sub": uid, "role": "processing_center"})
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_technician_cannot_pass_the_admin_gate(fake_db):
    uid, cid = _seed_staff(fake_db, pc_role="technician")
    staff = await get_current_pc_staff({"sub": uid, "role": "processing_center"})
    with pytest.raises(HTTPException) as exc:
        await require_pc_admin(staff)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_pc_admin_passes_the_admin_gate(fake_db):
    uid, cid = _seed_staff(fake_db, pc_role="admin")
    staff = await get_current_pc_staff({"sub": uid, "role": "processing_center"})
    assert (await require_pc_admin(staff))["processing_center_id"] == cid
