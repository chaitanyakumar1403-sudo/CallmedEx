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


@pytest.mark.asyncio
async def test_one_centres_staff_never_resolves_to_another_centre(fake_db):
    """The isolation boundary: HYD-01's technician must never see VSP-01."""
    uid_a, cid_a = _seed_staff(fake_db, pc_role="technician")
    uid_b, cid_b = _seed_staff(fake_db, pc_role="admin")
    assert cid_a != cid_b

    staff_a = await get_current_pc_staff({"sub": uid_a, "role": "processing_center"})
    assert staff_a["processing_center_id"] == cid_a
    assert staff_a["pc_role"] == "technician"

    staff_b = await get_current_pc_staff({"sub": uid_b, "role": "processing_center"})
    assert staff_b["processing_center_id"] == cid_b
    assert staff_b["pc_role"] == "admin"


@pytest.mark.asyncio
async def test_missing_jwt_user_id_and_sub_is_rejected(fake_db):
    """Missing both sub and user_id in JWT payload must raise HTTPException 403."""
    uid, cid = _seed_staff(fake_db)
    with pytest.raises(HTTPException) as exc:
        await get_current_pc_staff({"role": "processing_center"})
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_user_with_deactivated_and_active_rows_resolves_to_active(fake_db):
    """When a user has both deactivated and active staff rows, resolve to the active one."""
    uid = str(uuid.uuid4())
    cid_inactive = str(uuid.uuid4())
    cid_active = str(uuid.uuid4())

    # Seed deactivated row first (at cid_inactive)
    fake_db.db.setdefault("processing_center_staff", []).append({
        "id": str(uuid.uuid4()), "processing_center_id": cid_inactive,
        "user_id": uid, "pc_role": "technician", "is_active": False,
    })

    # Then seed active row (at cid_active)
    fake_db.db.setdefault("processing_center_staff", []).append({
        "id": str(uuid.uuid4()), "processing_center_id": cid_active,
        "user_id": uid, "pc_role": "admin", "is_active": True,
    })

    # Must resolve to the active row, not the deactivated one
    staff = await get_current_pc_staff({"sub": uid, "role": "processing_center"})
    assert staff["processing_center_id"] == cid_active
    assert staff["pc_role"] == "admin"


# ── Centre resolution and coverage ──────────────────────────────────────────

import app.services.processing_center as pc_mod
from app.services.processing_center import check_coverage, normalise_city, resolve_center


@pytest.fixture
def pc_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(pc_mod, "supabase", fake)
    return fake


def _seed_centre(fake, code, city, lat=None, lng=None, status="active"):
    cid = str(uuid.uuid4())
    fake.db.setdefault("processing_centers", []).append({
        "id": cid, "code": code, "name": code, "city": city,
        "lat": lat, "lng": lng, "status": status,
        "partner_lab_name": "", "daily_capacity": 0,
    })
    return cid


def _seed_area(fake, cid, city=None, pincode=None, radius_km=None, priority=100, active=True):
    fake.db.setdefault("processing_center_areas", []).append({
        "id": str(uuid.uuid4()), "processing_center_id": cid,
        "city": city, "pincode": pincode, "radius_km": radius_km,
        "priority": priority, "is_active": active,
    })


def _seed_aliases(fake):
    for alias, canon in (("vizag", "visakhapatnam"),
                         ("visakhapatnam", "visakhapatnam"),
                         ("hyderabad", "hyderabad")):
        fake.db.setdefault("city_aliases", []).append(
            {"alias": alias, "canonical_city": canon})


def test_city_normalisation_handles_the_vizag_problem(pc_db):
    _seed_aliases(pc_db)
    for raw in ("Vizag", "VIZAG", "  vizag  ", "Visakhapatnam"):
        assert normalise_city(raw) == "visakhapatnam"


def test_an_unknown_city_normalises_to_itself_lowercased(pc_db):
    _seed_aliases(pc_db)
    assert normalise_city("Rajahmundry") == "rajahmundry"


def test_pincode_beats_city(pc_db):
    _seed_aliases(pc_db)
    a = _seed_centre(pc_db, "HYD-01", "hyderabad")
    b = _seed_centre(pc_db, "HYD-02", "hyderabad")
    _seed_area(pc_db, a, city="hyderabad")
    _seed_area(pc_db, b, pincode="500081")
    assert resolve_center(city="Hyderabad", pincode="500081")["code"] == "HYD-02"


def test_city_beats_geo(pc_db):
    _seed_aliases(pc_db)
    near = _seed_centre(pc_db, "HYD-01", "hyderabad", lat=17.4, lng=78.5)
    far = _seed_centre(pc_db, "VSP-01", "visakhapatnam", lat=17.7, lng=83.2)
    _seed_area(pc_db, far, city="visakhapatnam")
    _seed_area(pc_db, near, radius_km=500)
    got = resolve_center(city="Vizag", lat=17.4, lng=78.5)
    assert got["code"] == "VSP-01"


def test_geo_is_the_last_resort(pc_db):
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad", lat=17.385, lng=78.487)
    _seed_area(pc_db, cid, radius_km=25)
    got = resolve_center(city="Unknownpur", lat=17.40, lng=78.50)
    assert got["code"] == "HYD-01"


def test_a_point_outside_every_radius_resolves_to_nothing(pc_db):
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad", lat=17.385, lng=78.487)
    _seed_area(pc_db, cid, radius_km=25)
    assert resolve_center(city="Unknownpur", lat=19.0, lng=72.8) is None


def test_a_paused_centre_is_never_selected(pc_db):
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad", status="paused")
    _seed_area(pc_db, cid, city="hyderabad")
    assert resolve_center(city="Hyderabad") is None


def test_an_inactive_area_row_is_never_selected(pc_db):
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad")
    _seed_area(pc_db, cid, city="hyderabad", active=False)
    assert resolve_center(city="Hyderabad") is None


def test_two_centres_in_one_city_resolve_deterministically(pc_db):
    """Proves HYD-02 needs no code change — only a row."""
    _seed_aliases(pc_db)
    a = _seed_centre(pc_db, "HYD-01", "hyderabad")
    b = _seed_centre(pc_db, "HYD-02", "hyderabad")
    _seed_area(pc_db, a, city="hyderabad", priority=200)
    _seed_area(pc_db, b, city="hyderabad", priority=50)
    assert resolve_center(city="Hyderabad")["code"] == "HYD-02"
    assert resolve_center(city="Hyderabad")["code"] == "HYD-02"


def test_coverage_leaks_nothing_but_a_boolean(pc_db):
    """This is the seam where a leak would be easiest, so it is a separate
    function from resolve_center on purpose."""
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad")
    _seed_area(pc_db, cid, city="hyderabad")
    assert check_coverage(city="Hyderabad") == {"serviceable": True}
    assert check_coverage(city="Rajahmundry") == {"serviceable": False}


def test_geo_fallback_breaks_ties_on_priority_then_distance(pc_db):
    """Two centres cover the point. Priority wins even when it is the farther
    one — this is what lets a second centre be added as a row, not a code change."""
    _seed_aliases(pc_db)
    near = _seed_centre(pc_db, "HYD-01", "hyderabad", lat=17.3850, lng=78.4870)
    far = _seed_centre(pc_db, "HYD-02", "hyderabad", lat=17.4500, lng=78.5500)
    _seed_area(pc_db, near, radius_km=50, priority=200)
    _seed_area(pc_db, far, radius_km=50, priority=50)

    # Priority 50 beats priority 200 despite being farther away.
    assert resolve_center(city="Unknownpur", lat=17.3851, lng=78.4871)["code"] == "HYD-02"


def test_geo_fallback_uses_distance_when_priority_is_equal(pc_db):
    """With priority tied, the nearer centre must win, deterministically."""
    _seed_aliases(pc_db)
    near = _seed_centre(pc_db, "HYD-01", "hyderabad", lat=17.3850, lng=78.4870)
    far = _seed_centre(pc_db, "HYD-02", "hyderabad", lat=17.4500, lng=78.5500)
    _seed_area(pc_db, near, radius_km=50, priority=100)
    _seed_area(pc_db, far, radius_km=50, priority=100)

    assert resolve_center(city="Unknownpur", lat=17.3851, lng=78.4871)["code"] == "HYD-01"
    # Deterministic across repeated calls, not incidentally ordered.
    assert resolve_center(city="Unknownpur", lat=17.3851, lng=78.4871)["code"] == "HYD-01"


def test_normalise_city_handles_none_and_blank_input(pc_db):
    _seed_aliases(pc_db)
    assert normalise_city(None) == ""
    assert normalise_city("") == ""
    assert normalise_city("   ") == ""


# ── Booking assignment ──────────────────────────────────────────────────────

from app.services.processing_center import assign_booking


def _seed_booking(fake, city="hyderabad", pincode="", lat=None, lng=None):
    bid = str(uuid.uuid4())
    fake.db.setdefault("bookings", []).append({
        "id": bid, "patient_id": str(uuid.uuid4()), "provider_id": None,
        "provider_type": "", "service_type": "lab_test", "status": "pending",
        "booking_kind": "home_collection", "processing_center_id": None,
        "collection_city": city, "collection_pincode": pincode,
        "collection_lat": lat, "collection_lng": lng,
    })
    return bid


def _seed_subject_with_tests(fake, booking_id, services):
    """services: [(home_service_id, [tube_code, ...])]"""
    sid = str(uuid.uuid4())
    fake.db.setdefault("booking_subjects", []).append({
        "id": sid, "booking_id": booking_id, "family_member_id": str(uuid.uuid4()),
    })
    for svc_id, tubes in services:
        bt_id = str(uuid.uuid4())
        fake.db.setdefault("booking_tests", []).append({
            "id": bt_id, "booking_id": booking_id, "booking_subject_id": sid,
            "home_service_id": svc_id, "price_charged": 100.0, "source": "booking",
        })
        for tube in tubes:
            fake.db.setdefault("home_service_tubes", []).append({
                "home_service_id": svc_id, "tube_type_code": tube, "volume_ml": 3.0,
            })
    return sid


def test_assignment_creates_one_sample_per_subject_and_tube(pc_db):
    """The spec's worked example: patient CBC+LFT+KFT, mother CBC => 3 tubes."""
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad")
    _seed_area(pc_db, cid, city="hyderabad")
    bid = _seed_booking(pc_db)
    _seed_subject_with_tests(pc_db, bid, [
        ("cbc", ["edta_lavender"]), ("lft", ["sst_gold"]), ("kft", ["sst_gold"])])
    _seed_subject_with_tests(pc_db, bid, [("cbc", ["edta_lavender"])])

    assert assign_booking(bid) == cid

    samples = pc_db.db["samples"]
    assert len(samples) == 3
    assert all(s["status"] == "pending_collection" for s in samples)
    assert all(s["barcode"] is None for s in samples)
    assert all(s["processing_center_id"] == cid for s in samples)
    assert sorted(s["expected_tube_type_code"] for s in samples) == [
        "edta_lavender", "edta_lavender", "sst_gold"]


def test_assignment_writes_a_registered_custody_event_per_sample(pc_db):
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad")
    _seed_area(pc_db, cid, city="hyderabad")
    bid = _seed_booking(pc_db)
    _seed_subject_with_tests(pc_db, bid, [("cbc", ["edta_lavender"])])

    assign_booking(bid)
    events = pc_db.db["sample_events"]
    assert len(events) == 1
    assert events[0]["event"] == "registered"
    assert events[0]["processing_center_id"] == cid


def test_assignment_sets_provider_id_without_loosening_the_not_null(pc_db):
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad")
    _seed_area(pc_db, cid, city="hyderabad")
    bid = _seed_booking(pc_db)
    _seed_subject_with_tests(pc_db, bid, [("cbc", ["edta_lavender"])])

    assign_booking(bid)
    booking = pc_db.db["bookings"][0]
    assert booking["processing_center_id"] == cid
    assert booking["provider_id"] == cid
    assert booking["provider_type"] == "processing_center"


def test_assignment_is_idempotent(pc_db):
    """A retried booking creation must not double the tubes."""
    _seed_aliases(pc_db)
    cid = _seed_centre(pc_db, "HYD-01", "hyderabad")
    _seed_area(pc_db, cid, city="hyderabad")
    bid = _seed_booking(pc_db)
    _seed_subject_with_tests(pc_db, bid, [("cbc", ["edta_lavender"])])

    assert assign_booking(bid) == cid
    assert assign_booking(bid) == cid
    assert len(pc_db.db["samples"]) == 1


def test_an_unserviced_booking_is_not_assigned_and_creates_no_samples(pc_db):
    _seed_aliases(pc_db)
    bid = _seed_booking(pc_db, city="rajahmundry")
    _seed_subject_with_tests(pc_db, bid, [("cbc", ["edta_lavender"])])
    assert assign_booking(bid) is None
    assert pc_db.db.get("samples", []) == []


# ── Task 15: full-migration structural audit ────────────────────────────────
#
# Tasks 1-14 built database/task1_processing_center_foundation.sql up across
# eight sections. These tests audit the *finished* file as a whole: every new
# table is guarded by the RLS loop, the migration is exactly one transaction,
# and statements that ALTER a table added by an earlier section only run
# after that table exists.
#
# Note: a COMMIT-before-NOTIFY ordering check already lives in
# test_migration_exists_and_is_transactional above (added during Task 1's fix
# round) — it is not repeated here.

def test_every_new_table_appears_in_the_rls_loop():
    """Lint 0008: a table without a deny-all policy is reachable by anon."""
    sql = _sql()
    created = set(re.findall(r"CREATE TABLE IF NOT EXISTS (\w+)", sql))
    rls_block = sql.split("new_tables TEXT[] := ARRAY[")[1].split("];")[0]
    guarded = set(re.findall(r"'(\w+)'", rls_block))
    assert created - guarded == set(), f"unguarded tables: {created - guarded}"


def test_the_migration_has_exactly_one_transaction():
    sql = _sql()
    assert sql.count("BEGIN;") == 1
    assert sql.count("COMMIT;") == 1
    assert sql.index("BEGIN;") < sql.index("COMMIT;")


def test_batches_are_created_before_samples_references_them():
    """Statement order matters: the ALTER would fail otherwise."""
    sql = _sql()
    assert sql.index("CREATE TABLE IF NOT EXISTS sample_batches") < \
           sql.index("ADD COLUMN IF NOT EXISTS batch_id")


def test_booking_subjects_exists_before_samples_references_it():
    sql = _sql()
    assert sql.index("CREATE TABLE IF NOT EXISTS booking_subjects") < \
           sql.index("ADD COLUMN IF NOT EXISTS booking_subject_id")
