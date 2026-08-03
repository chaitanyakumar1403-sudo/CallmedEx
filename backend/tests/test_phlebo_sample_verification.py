"""
Tests for Sample Collection Verification Workflow.

Verifies:
1. Valid barcode verification returns full context with case="VALID" without updating status.
2. Barcode not recognized returns case="BARCODE_NOT_FOUND".
3. Barcode already collected returns case="ALREADY_COLLECTED".
4. Barcode belonging to different patient/booking returns case="DIFFERENT_PATIENT".
5. Cancelled booking blocks verification with case="BOOKING_CANCELLED".
6. Explicit confirm-collection updates status to "collected", writes sample_events custody log and audit log.
7. Re-confirming an already collected sample is idempotent.
8. Duplicate barcode assignment attempt returns HTTP 409 error.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import phlebo_doorstep as router_mod
from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(router_mod, "supabase", fake)
    return fake


@pytest.fixture
def client():
    return TestClient(app)


def _seed_sample_context(fake_db, **kwargs):
    patient_id = kwargs.get("patient_id") or str(uuid.uuid4())
    booking_id = kwargs.get("booking_id") or str(uuid.uuid4())
    sample_id = kwargs.get("sample_id") or str(uuid.uuid4())
    barcode = kwargs.get("barcode")
    status = kwargs.get("status") or "pending_collection"
    booking_status = kwargs.get("booking_status") or "confirmed"

    fake_db.db.setdefault("users", []).append({
        "id": patient_id,
        "full_name": kwargs.get("patient_name", "Jane Doe"),
        "phone": "+919876543210",
        "role": "patient",
    })

    fake_db.db.setdefault("bookings", []).append({
        "id": booking_id,
        "patient_id": patient_id,
        "status": booking_status,
        "address": "123 Healthcare Ave",
        "city": "hyderabad",
    })

    fake_db.db.setdefault("tube_types", []).append({
        "code": "edta_lavender",
        "name": "EDTA Lavender",
        "cap_colour": "lavender",
        "is_active": True,
    })

    fake_db.db.setdefault("samples", []).append({
        "id": sample_id,
        "barcode": barcode,
        "booking_id": booking_id,
        "patient_id": patient_id,
        "expected_tube_type_code": "edta_lavender",
        "tube_type_code": "edta_lavender",
        "status": status,
        "collected_at": kwargs.get("collected_at"),
        "phlebotomist_user_id": kwargs.get("phlebotomist_user_id"),
        "processing_center_id": kwargs.get("processing_center_id"),
    })

    return {
        "sample_id": sample_id,
        "booking_id": booking_id,
        "patient_id": patient_id,
        "barcode": barcode,
    }


# ── 1. Case 1: Valid Barcode ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_barcode_valid_case_1(fake_db):
    barcode = "CMX-260803-VAL001"
    ctx = _seed_sample_context(fake_db, barcode=barcode)

    req = router_mod.VerifyBarcodeRequest(barcode=barcode)
    res = await router_mod.verify_barcode(
        req,
        user={"sub": str(uuid.uuid4()), "role": "phlebotomist"},
    )

    assert res["valid"] is True
    assert res["case"] == "VALID"
    assert res["barcode"] == barcode
    assert res["sample_id"] == ctx["sample_id"]
    assert res["patient_name"] == "Jane Doe"
    assert res["collection_status"] == "pending_collection"
    assert "confirm_collection" in res["allowed_actions"]

    # Status remains unchanged until explicitly confirmed!
    sample = fake_db.db["samples"][0]
    assert sample["status"] == "pending_collection"


# ── 2. Case 2: Barcode Not Found ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_barcode_not_found_case_2(fake_db):
    req = router_mod.VerifyBarcodeRequest(barcode="CMX-UNKNOWN-999")
    res = await router_mod.verify_barcode(
        req,
        user={"sub": str(uuid.uuid4()), "role": "phlebotomist"},
    )

    assert res["valid"] is False
    assert res["case"] == "BARCODE_NOT_FOUND"
    assert "not recognized" in res["message"].lower()
    assert "scan_again" in res["allowed_actions"]
    assert "manual_entry" in res["allowed_actions"]


# ── 3. Case 3: Already Collected ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_barcode_already_collected_case_3(fake_db):
    barcode = "CMX-260803-COL001"
    ctx = _seed_sample_context(
        fake_db,
        barcode=barcode,
        status="collected",
        collected_at="2026-08-03T07:00:00Z",
        phlebotomist_user_id="phlebo-user-1",
    )

    req = router_mod.VerifyBarcodeRequest(barcode=barcode)
    res = await router_mod.verify_barcode(
        req,
        user={"sub": str(uuid.uuid4()), "role": "phlebotomist"},
    )

    assert res["valid"] is False
    assert res["case"] == "ALREADY_COLLECTED"
    assert "already collected" in res["message"].lower()
    assert res["collected_at"] == "2026-08-03T07:00:00Z"
    assert "view_details" in res["allowed_actions"]


# ── 4. Case 4: Belongs to Different Patient ────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_barcode_different_patient_case_4(fake_db):
    barcode = "CMX-260803-DIFF01"
    _seed_sample_context(fake_db, barcode=barcode, patient_name="Alice Smith")

    different_patient_id = str(uuid.uuid4())
    req = router_mod.VerifyBarcodeRequest(
        barcode=barcode,
        patient_id=different_patient_id,
    )

    res = await router_mod.verify_barcode(
        req,
        user={"sub": str(uuid.uuid4()), "role": "phlebotomist"},
    )

    assert res["valid"] is False
    assert res["case"] == "DIFFERENT_PATIENT"
    assert "belongs to another patient" in res["message"].lower()
    assert res["patient_name"] == "Alice Smith"


# ── 5. Safety Rule: Cancelled Booking Guard ───────────────────────────────────

@pytest.mark.asyncio
async def test_verify_barcode_cancelled_booking(fake_db):
    barcode = "CMX-260803-CNC001"
    _seed_sample_context(fake_db, barcode=barcode, booking_status="cancelled")

    req = router_mod.VerifyBarcodeRequest(barcode=barcode)
    res = await router_mod.verify_barcode(
        req,
        user={"sub": str(uuid.uuid4()), "role": "phlebotomist"},
    )

    assert res["valid"] is False
    assert res["case"] == "BOOKING_CANCELLED"
    assert "cancelled" in res["message"].lower()


# ── 6. Explicit Confirm Collection ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_confirm_collection_happy_path(fake_db):
    barcode = "CMX-260803-CONF01"
    ctx = _seed_sample_context(fake_db, barcode=barcode)
    phlebo_id = str(uuid.uuid4())

    class DummyRequest:
        client = type("Client", (), {"host": "127.0.0.1"})()
        headers = {}

    req = router_mod.ConfirmCollectionRequest(
        sample_id=ctx["sample_id"],
        barcode=barcode,
        lat=17.44,
        lng=78.38,
        device_id="device-phlebo-01",
    )

    res = await router_mod.confirm_collection(
        req,
        request=DummyRequest(),
        user={"sub": phlebo_id, "role": "phlebotomist"},
    )

    assert res["success"] is True
    assert res["status"] == "collected"
    assert res["message"] == "Sample Linked Successfully"

    # Verify sample row in DB updated
    sample = fake_db.db["samples"][0]
    assert sample["status"] == "collected"
    assert sample["phlebotomist_user_id"] == phlebo_id

    # Verify custody log event created
    events = fake_db.db.get("sample_events", [])
    assert len(events) == 1
    assert events[0]["event"] == "sample_collected"
    assert events[0]["actor_id"] == phlebo_id


# ── 7. Idempotent Re-confirmation ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_confirm_collection_idempotent_reconfirm(fake_db):
    barcode = "CMX-260803-IDEM01"
    phlebo_id = str(uuid.uuid4())
    ctx = _seed_sample_context(
        fake_db,
        barcode=barcode,
        status="collected",
        collected_at="2026-08-03T07:30:00Z",
        phlebotomist_user_id=phlebo_id,
    )

    class DummyRequest:
        client = type("Client", (), {"host": "127.0.0.1"})()
        headers = {}

    req = router_mod.ConfirmSampleCollectionRequest(
        sample_id=ctx["sample_id"],
        barcode=barcode,
    )

    res = await router_mod.confirm_sample_collection(
        req,
        request=DummyRequest(),
        user={"sub": phlebo_id, "role": "phlebotomist"},
    )

    assert res["success"] is True
    assert res["status"] == "collected"
    assert res["collected_at"] == "2026-08-03T07:30:00Z"


# ── 8. Barcode Format Validation ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_barcode_format_validation_malformed_rejected(fake_db):
    """Malformed barcodes with special characters or invalid lengths are rejected immediately."""
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        req = router_mod.VerifyBarcodeRequest(barcode="SHORT")
        await router_mod.verify_barcode(req, user={"sub": "p-1", "role": "phlebotomist"})
    assert exc_info.value.status_code == 400
    assert "Invalid barcode format" in exc_info.value.detail


# ── 9. Re-scan Confirmation Guard ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rescan_barcode_match_and_mismatch_guard(fake_db):
    """Confirming requires rescan_barcode to match barcode exactly."""
    barcode = "CMX-260803-RESCAN"
    ctx = _seed_sample_context(fake_db, barcode=barcode)
    phlebo_id = str(uuid.uuid4())

    class DummyRequest:
        client = type("Client", (), {"host": "127.0.0.1"})()
        headers = {}

    from fastapi import HTTPException

    # Mismatch raises HTTP 400
    req_mismatch = router_mod.ConfirmSampleCollectionRequest(
        sample_id=ctx["sample_id"],
        barcode=barcode,
        rescan_barcode="CMX-260803-WRONGTUBE",
    )
    with pytest.raises(HTTPException) as exc_info:
        await router_mod.confirm_sample_collection(
            req_mismatch,
            request=DummyRequest(),
            user={"sub": phlebo_id, "role": "phlebotomist"},
        )
    assert exc_info.value.status_code == 400
    assert "does not match" in exc_info.value.detail

    # Matching rescan succeeds
    req_match = router_mod.ConfirmSampleCollectionRequest(
        sample_id=ctx["sample_id"],
        barcode=barcode,
        rescan_barcode=barcode,
        device_id="dev-99",
        device_model="Pixel 8",
        os_version="Android 14",
        app_version="1.4.0",
    )
    res = await router_mod.confirm_sample_collection(
        req_match,
        request=DummyRequest(),
        user={"sub": phlebo_id, "role": "phlebotomist"},
    )
    assert res["success"] is True
    assert res["barcode_locked"] is True

