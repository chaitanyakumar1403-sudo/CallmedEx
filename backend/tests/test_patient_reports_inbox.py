"""
Patient My Reports inbox — Task 4.

Tests that GET /api/patient/my-samples returns report fields for samples
that have a report_url, and that other patients' samples never leak.
"""
import json
import uuid

import pytest

import app.routers.patient_samples as patient_samples_mod
from app.routers.patient_samples import my_samples
from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(patient_samples_mod, "supabase", fake)
    return fake


def _seed(
    fake,
    *,
    patient_id="patient-alice",
    sample_id=None,
    barcode="CMX-000001-ABCDEF",
    status="report_ready",
    report_url=None,
    report_status=None,
    report_uploaded_at=None,
    collected_at="2026-07-28T08:00:00Z",
    test_names=None,
):
    sid = sample_id or str(uuid.uuid4())
    fake.db.setdefault("samples", []).append({
        "id": sid,
        "barcode": barcode,
        "patient_id": patient_id,
        "booking_id": str(uuid.uuid4()),
        "status": status,
        "expected_tube_type_code": "red",
        "created_at": "2026-07-28T06:00:00Z",
        "collected_at": collected_at,
        "verified_at": "2026-07-28T10:00:00Z",
        "sent_to_lab_at": "2026-07-28T11:00:00Z",
        "report_url": report_url,
        "report_status": report_status,
        "report_uploaded_at": report_uploaded_at,
    })
    return sid


def _seed_booking_test(fake, sample_id, home_service_id, test_name="Complete Blood Count"):
    """Link a sample to a test name via sample_tests → booking_tests → home_services."""
    bt_id = str(uuid.uuid4())
    fail_db = fake.db
    fail_db.setdefault("sample_tests", []).append({
        "sample_id": sample_id,
        "booking_test_id": bt_id,
    })
    fail_db.setdefault("booking_tests", []).append({
        "id": bt_id,
        "home_service_id": home_service_id,
    })
    fail_db.setdefault("home_services", []).append({
        "id": home_service_id,
        "name": test_name,
        "code": test_name.upper().replace(" ", "_"),
    })


def _seed_subject(fake, sample_id, patient_id, family_member_id=None):
    """Link a sample to a subject name via booking_subjects → family_members."""
    subject_id = str(uuid.uuid4())
    fm_id = family_member_id or str(uuid.uuid4())
    fake.db.setdefault("booking_subjects", []).append({
        "id": subject_id,
        "family_member_id": fm_id,
    })
    # Update the sample to point at this subject
    for s in fake.db.setdefault("samples", []):
        if s["id"] == sample_id:
            s["booking_subject_id"] = subject_id
    fake.db.setdefault("family_members", []).append({
        "id": fm_id,
        "full_name": "Alice Patient",
    })


# ── Sample with a report ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sample_with_report_returns_report_fields(fake_db):
    """A sample that has a report_url must include report fields in the response."""
    pid = "patient-alice"
    sid = _seed(
        fake_db,
        patient_id=pid,
        barcode="CMX-REPORT-001",
        report_url="https://reports.example.com/r1.pdf",
        report_status="final",
        report_uploaded_at="2026-07-29T12:00:00Z",
    )
    _seed_booking_test(fake_db, sid, str(uuid.uuid4()), "Complete Blood Count")
    _seed_subject(fake_db, sid, pid)

    result = await my_samples({"sub": pid, "role": "patient"})
    assert result["count"] == 1
    s = result["samples"][0]
    assert s["barcode"] == "CMX-REPORT-001"
    assert s["report_url"] == "https://reports.example.com/r1.pdf"
    assert s["report_status"] == "final"
    assert s["report_uploaded_at"] == "2026-07-29T12:00:00Z"


@pytest.mark.asyncio
async def test_sample_without_report_omits_report_fields(fake_db):
    """A sample that has no report yet must still include report fields as None."""
    pid = "patient-alice"
    sid = _seed(
        fake_db,
        patient_id=pid,
        barcode="CMX-NOREPORT-001",
        status="collected",
        report_url=None,
        report_status=None,
        report_uploaded_at=None,
    )
    _seed_booking_test(fake_db, sid, str(uuid.uuid4()), "Blood Sugar Fasting")
    _seed_subject(fake_db, sid, pid)

    result = await my_samples({"sub": pid, "role": "patient"})
    assert result["count"] == 1
    s = result["samples"][0]
    assert s["barcode"] == "CMX-NOREPORT-001"
    assert s["report_url"] is None
    assert s["report_status"] is None
    assert s["report_uploaded_at"] is None


# ── Other patients' samples never leak ────────────────────────────────────────

@pytest.mark.asyncio
async def test_other_patients_samples_never_leak(fake_db):
    """Alice must never see Bob's samples, even if Bob's has a report."""
    alice = "patient-alice"
    bob = "patient-bob"

    # Alice's sample with a report
    sid_a = _seed(
        fake_db,
        patient_id=alice,
        barcode="CMX-ALICE-001",
        report_url="https://reports.example.com/alice.pdf",
        report_status="final",
        report_uploaded_at="2026-07-29T12:00:00Z",
    )
    _seed_booking_test(fake_db, sid_a, str(uuid.uuid4()), "Lipid Profile")
    _seed_subject(fake_db, sid_a, alice)

    # Bob's sample with a report
    sid_b = _seed(
        fake_db,
        patient_id=bob,
        barcode="CMX-BOB-001",
        report_url="https://reports.example.com/bob.pdf",
        report_status="final",
        report_uploaded_at="2026-07-29T13:00:00Z",
    )
    _seed_booking_test(fake_db, sid_b, str(uuid.uuid4()), "Thyroid Profile")
    _seed_subject(fake_db, sid_b, bob)

    result = await my_samples({"sub": alice, "role": "patient"})
    assert result["count"] == 1
    assert result["samples"][0]["barcode"] == "CMX-ALICE-001"
    assert result["samples"][0]["report_url"] == "https://reports.example.com/alice.pdf"

    bob_result = await my_samples({"sub": bob, "role": "patient"})
    assert bob_result["count"] == 1
    assert bob_result["samples"][0]["barcode"] == "CMX-BOB-001"
    assert bob_result["samples"][0]["report_url"] == "https://reports.example.com/bob.pdf"


# ── Leak guard — forbidden fields never reach the patient ─────────────────────

@pytest.mark.asyncio
async def test_leak_guard_excludes_internal_fields(fake_db):
    """processing_center_id, batch_id, lab_reference must never appear in response."""
    pid = "patient-alice"
    centre_id = str(uuid.uuid4())
    batch_id = str(uuid.uuid4())
    sid = _seed(
        fake_db,
        patient_id=pid,
        barcode="CMX-SAFE-001",
        report_url="https://reports.example.com/safe.pdf",
    )
    # Inject forbidden fields into the sample row
    for s in fake_db.db["samples"]:
        if s["id"] == sid:
            s["processing_center_id"] = centre_id
            s["batch_id"] = batch_id
            s["lab_reference"] = "LABREF-HIDDEN-999"

    _seed_booking_test(fake_db, sid, str(uuid.uuid4()), "Complete Blood Count")
    _seed_subject(fake_db, sid, pid)

    result = await my_samples({"sub": pid, "role": "patient"})
    blob = json.dumps(result, default=str)
    assert centre_id not in blob
    assert batch_id not in blob
    assert "LABREF-HIDDEN-999" not in blob
    assert "processing_center_id" not in blob
    assert "batch_id" not in blob
    assert "lab_reference" not in blob

    # But the report fields must still be present
    assert result["samples"][0]["report_url"] == "https://reports.example.com/safe.pdf"


# ── Non-patient access is denied ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_non_patient_role_is_denied(fake_db):
    """Phlebotomist, doctor, staff callers must get 403."""
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await my_samples({"sub": "phlebo-1", "role": "phlebotomist"})
    assert exc.value.status_code == 403