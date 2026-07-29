"""
Task 2: Phlebo tube barcode binding via camera scan.

Extends POST /api/phlebo/scan-tube to bind a physical barcode (from camera
scan) to the sample record. Exercises:

  1. First scan with barcode -> barcode written to samples.barcode +
     sample_events event logged.
  2. Second scan with a *different* barcode -> warning, no overwrite.
  3. Tube-type mismatch still enforced alongside barcode binding.
  4. Barcode omitted (legacy path) -> no barcode change, no event.
"""
import uuid

import pytest

from app.routers import phlebo_doorstep as router_mod
from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(router_mod, "supabase", fake)
    yield fake


def _seed_sample(fake, sample_id, expected_tube="edta_lavender",
                  actual_tube=None, barcode=None, booking_id=None,
                  patient_id=None, phlebo_user_id=None):
    """Seed a single sample row in the fake database."""
    fake.db.setdefault("samples", []).append({
        "id": sample_id,
        "barcode": barcode,
        "expected_tube_type_code": expected_tube,
        "tube_type_code": actual_tube,
        "status": "pending_collection",
        "booking_id": booking_id or str(uuid.uuid4()),
        "patient_id": patient_id or str(uuid.uuid4()),
        "phlebotomist_user_id": phlebo_user_id,
        "booking_subject_id": None,
        "processing_center_id": None,
        "tube_mismatch_ack": False,
        "created_at": "2026-07-29T00:00:00Z",
    })


def _seed_tube_type(fake, code, name="Lavender EDTA", cap_colour="lavender"):
    """Seed a tube type so the lookup doesn't crash."""
    fake.db.setdefault("tube_types", []).append({
        "code": code,
        "name": name,
        "cap_colour": cap_colour,
        "is_active": True,
    })


# ── 1. Happy path: barcode bound on first scan ────────────────────────────────

@pytest.mark.asyncio
async def test_barcode_bound_on_first_scan(fake_db):
    sample_id = str(uuid.uuid4())
    _seed_sample(fake_db, sample_id)
    _seed_tube_type(fake_db, "edta_lavender")

    # Build a request object directly
    req = router_mod.ScanTubeRequest(
        sample_id=sample_id,
        scanned_tube_type_code="edta_lavender",
        scanned_barcode="CMX-260729-A1B2C3",
    )

    result = await router_mod.scan_tube(
        req,
        user={"sub": str(uuid.uuid4()), "role": "phlebotomist"},
    )

    # Tube type matches
    assert result["match"] is True

    # Barcode bound
    assert result["barcode_bound"] is True
    assert result["barcode_warning"] is None

    # Verify the sample row was updated
    sample = fake_db.db["samples"][0]
    assert sample["barcode"] == "CMX-260729-A1B2C3"

    # Verify a sample_events row was created for the binding
    events = [e for e in fake_db.db.get("sample_events", [])
              if e["sample_id"] == sample_id and e["event"] == "barcode_bound"]
    assert len(events) == 1
    assert "CMX-260729-A1B2C3" in events[0]["notes"]


# ── 2. Different barcode warns and does not overwrite ─────────────────────────

@pytest.mark.asyncio
async def test_different_barcode_warns_no_overwrite(fake_db):
    sample_id = str(uuid.uuid4())
    _seed_sample(fake_db, sample_id, barcode="CMX-260729-ORIGINAL")
    _seed_tube_type(fake_db, "edta_lavender")

    req = router_mod.ScanTubeRequest(
        sample_id=sample_id,
        scanned_tube_type_code="edta_lavender",
        scanned_barcode="CMX-260729-DIFFERENT",
    )

    result = await router_mod.scan_tube(
        req,
        user={"sub": str(uuid.uuid4()), "role": "phlebotomist"},
    )

    # Tube type still matches
    assert result["match"] is True

    # Barcode warning raised, not overwritten
    assert result["barcode_bound"] is False
    assert result["barcode_warning"] is not None
    assert "CMX-260729-ORIGINAL" in result["barcode_warning"]
    assert "does not match" in result["barcode_warning"].lower()

    # Original barcode preserved
    assert fake_db.db["samples"][0]["barcode"] == "CMX-260729-ORIGINAL"

    # No barcode_bound event logged
    events = [e for e in fake_db.db.get("sample_events", [])
              if e["sample_id"] == sample_id and e["event"] == "barcode_bound"]
    assert len(events) == 0


# ── 3. Same barcode rescanned is a no-op ──────────────────────────────────────

@pytest.mark.asyncio
async def test_same_barcode_noop(fake_db):
    sample_id = str(uuid.uuid4())
    _seed_sample(fake_db, sample_id, barcode="CMX-260729-EXISTING")
    _seed_tube_type(fake_db, "edta_lavender")

    req = router_mod.ScanTubeRequest(
        sample_id=sample_id,
        scanned_tube_type_code="edta_lavender",
        scanned_barcode="CMX-260729-EXISTING",
    )

    result = await router_mod.scan_tube(
        req,
        user={"sub": str(uuid.uuid4()), "role": "phlebotomist"},
    )

    assert result["match"] is True
    assert result["barcode_bound"] is False
    assert result["barcode_warning"] is None


# ── 4. Tube type mismatch still enforced alongside barcode bind ───────────────

@pytest.mark.asyncio
async def test_tube_mismatch_with_barcode_bind(fake_db):
    sample_id = str(uuid.uuid4())
    _seed_sample(fake_db, sample_id, expected_tube="edta_lavender")
    _seed_tube_type(fake_db, "edta_lavender", name="Lavender EDTA", cap_colour="lavender")
    _seed_tube_type(fake_db, "gold_serum", name="Gold Serum", cap_colour="gold")

    req = router_mod.ScanTubeRequest(
        sample_id=sample_id,
        scanned_tube_type_code="gold_serum",
        scanned_barcode="CMX-260729-BARCODE",
    )

    result = await router_mod.scan_tube(
        req,
        user={"sub": str(uuid.uuid4()), "role": "phlebotomist"},
    )

    # Tube type mismatch still flagged
    assert result["match"] is False
    assert result["warning"] is not None
    assert "mismatch" in result["warning"].lower()

    # But barcode was still bound
    assert result["barcode_bound"] is True
    assert fake_db.db["samples"][0]["barcode"] == "CMX-260729-BARCODE"


# ── 5. No barcode provided (legacy path) ──────────────────────────────────────

@pytest.mark.asyncio
async def test_no_barcode_legacy_path(fake_db):
    sample_id = str(uuid.uuid4())
    _seed_sample(fake_db, sample_id)
    _seed_tube_type(fake_db, "edta_lavender")

    # No scanned_barcode at all
    req = router_mod.ScanTubeRequest(
        sample_id=sample_id,
        scanned_tube_type_code="edta_lavender",
    )

    result = await router_mod.scan_tube(
        req,
        user={"sub": str(uuid.uuid4()), "role": "phlebotomist"},
    )

    assert result["match"] is True
    assert result["barcode_bound"] is False
    assert result["barcode_warning"] is None

    # Barcode remains None
    assert fake_db.db["samples"][0]["barcode"] is None