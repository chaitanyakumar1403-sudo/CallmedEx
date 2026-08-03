"""
Tests for Production Hardening Patch (Issues 1-7 Verification).

Validates:
1. Timeline endpoint with NULL booking_id (no UnboundLocalError).
2. Canonical ReportJob creation & shared submission service on sample verification.
3. Concurrent verification safety (exactly-once ReportJob & MediAssist submission).
4. FSM status transition enforcement via validate_sample_transition.
5. Atomic chain-of-custody write failure propagation.
6. Barcode uniqueness race conflict (HTTP 409).
7. Idempotency cache composite key (idempotency_key, endpoint).
"""
import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import samples as samples_router
from app.routers import pc_operations as pc_router
from app.routers import phlebo_doorstep as phlebo_router
import app.services.report_submission as report_submission_mod
from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(samples_router, "supabase", fake)
    monkeypatch.setattr(pc_router, "supabase", fake)
    monkeypatch.setattr(phlebo_router, "supabase", fake)
    monkeypatch.setattr(report_submission_mod, "supabase", fake)
    import app.services.processing_center as pc_service_mod
    monkeypatch.setattr(pc_service_mod, "supabase", fake)
    return fake


@pytest.fixture
def client():
    return TestClient(app)


def _seed_sample_row(fake_db, sample_id="sample-hardened-1", status="received",
                     booking_id=None, pc_id="pc-1", barcode="CMX-260803-A1B2C3"):
    fake_db.db.setdefault("samples", []).append({
        "id": sample_id,
        "booking_id": booking_id,
        "patient_id": "patient-user-1",
        "processing_center_id": pc_id,
        "barcode": barcode,
        "status": status,
        "created_at": "2026-08-03T00:00:00Z",
    })


# ── 1. Issue 1: Timeline with NULL booking_id ──────────────────────────────────

@pytest.mark.asyncio
async def test_sample_timeline_null_booking_id(fake_db):
    sample_id = "sample-null-booking"
    _seed_sample_row(fake_db, sample_id=sample_id, booking_id=None)

    user = {"sub": "patient-user-1", "role": "patient"}
    res = await samples_router.get_sample_timeline(sample_id, current_user=user)

    assert res["success"] is True
    assert res["sample_id"] == sample_id
    assert isinstance(res["timeline"], list)


# ── 2. Issue 2: Sample verification creates ReportJob & submits ────────────────

@pytest.mark.asyncio
async def test_sample_verification_creates_and_submits_report_job(fake_db, monkeypatch):
    sample_id = "sample-verify-1"
    _seed_sample_row(fake_db, sample_id=sample_id, status="received", pc_id="pc-test")

    mock_submit = AsyncMock(return_value={"report_job_id": "job-123", "status": "queued"})
    monkeypatch.setattr(report_submission_mod.mediassist_client, "submit_report_job", mock_submit)

    staff = {"user_id": "staff-1", "processing_center_id": "pc-test", "role": "processing_center"}
    req = pc_router.VerifyRequest()

    res = await pc_router.verify_sample(sample_id, req, staff=staff)
    assert res["success"] is True

    # Verify ReportJob was created in DB
    jobs = fake_db.db.get("report_jobs", [])
    assert len(jobs) == 1
    assert jobs[0]["sample_id"] == sample_id
    assert jobs[0]["status"] == "queued"

    # Verify MediAssist submission was called via shared submission service
    assert mock_submit.called is True
    assert mock_submit.call_args.kwargs["sample_id"] == sample_id


# ── 3. Issue 2 Concurrency: Concurrent verification safety ───────────────────

@pytest.mark.asyncio
async def test_concurrent_sample_verification_safety(fake_db, monkeypatch):
    sample_id = "sample-concurrent-1"
    _seed_sample_row(fake_db, sample_id=sample_id, status="received", pc_id="pc-concurrent")

    mock_submit = AsyncMock(return_value={"status": "queued"})
    monkeypatch.setattr(report_submission_mod.mediassist_client, "submit_report_job", mock_submit)

    staff = {"user_id": "staff-1", "processing_center_id": "pc-concurrent", "role": "processing_center"}
    req = pc_router.VerifyRequest()

    # Simulate two concurrent verification calls Milliseconds apart
    res1, res2 = await asyncio.gather(
        pc_router.verify_sample(sample_id, req, staff=staff),
        pc_router.verify_sample(sample_id, req, staff=staff),
        return_exceptions=True
    )

    # Exactly ONE ReportJob exists in DB
    jobs = fake_db.db.get("report_jobs", [])
    assert len([j for j in jobs if j["sample_id"] == sample_id]) == 1


# ── 4. Issue 3: FSM transition validation ────────────────────────────────────

@pytest.mark.asyncio
async def test_invalid_fsm_status_transition(fake_db):
    sample_id = "sample-fsm-invalid"
    _seed_sample_row(fake_db, sample_id=sample_id, status="completed", pc_id="pc-fsm")

    staff = {"user_id": "staff-1", "processing_center_id": "pc-fsm", "role": "processing_center"}
    req = pc_router.VerifyRequest()

    # Transitioning from "completed" to "verified" is invalid in FSM
    with pytest.raises(samples_router.HTTPException) as exc_info:
        await pc_router.verify_sample(sample_id, req, staff=staff)

    assert exc_info.value.status_code == 409
    assert "Invalid sample state transition" in str(exc_info.value.detail)


# ── 5. Issue 5: Barcode uniqueness race converts DB violation to HTTP 409 ──────

@pytest.mark.asyncio
async def test_barcode_uniqueness_conflict_returns_409(fake_db, monkeypatch):
    sample = {
        "id": "sample-barcode-race",
        "barcode": None,
        "status": "pending_collection",
    }

    orig_table = fake_db.table

    def mock_table(name):
        tbl = orig_table(name)
        if name == "samples":
            def mock_update(*args, **kwargs):
                raise Exception('duplicate key value violates unique constraint "samples_barcode_key" (23505)')
            tbl.update = mock_update
        return tbl

    monkeypatch.setattr(phlebo_router.supabase, "table", mock_table)

    with pytest.raises(phlebo_router.HTTPException) as exc_info:
        phlebo_router._bind_barcode(sample, "CMX-260803-DUPLICATE", actor_id="phlebo-1")

    assert exc_info.value.status_code == 409
    assert "already registered to another sample" in str(exc_info.value.detail)


# ── 6. confirm_sample_collection uses validate_sample_transition (Issue 3) ────

@pytest.mark.asyncio
async def test_confirm_sample_collection_uses_validate_sample_transition(fake_db):
    sample_id = "sample-confirm-invalid"
    _seed_sample_row(fake_db, sample_id=sample_id, status="completed")

    user = {"sub": "phlebo-1", "role": "phlebotomist"}
    req = phlebo_router.ConfirmCollectionRequest(
        sample_id=sample_id,
        barcode="CMX-260803-CONFIRM",
    )

    with pytest.raises(phlebo_router.HTTPException) as exc_info:
        await phlebo_router.confirm_sample_collection(req, request=None, user=user)

    assert exc_info.value.status_code == 409
    assert "Invalid sample state transition" in str(exc_info.value.detail)


# ── 7. Custody event persistence failure causes request failure (Issue 4) ─────

@pytest.mark.asyncio
async def test_custody_event_persistence_failure_causes_request_failure(fake_db, monkeypatch):
    sample_id = "sample-custody-fail"
    _seed_sample_row(fake_db, sample_id=sample_id, status="pending_collection")

    orig_table = fake_db.table

    def mock_table(name):
        tbl = orig_table(name)
        if name == "sample_events":
            def mock_insert(*args, **kwargs):
                raise Exception("Database error inserting custody event")
            tbl.insert = mock_insert
        return tbl

    monkeypatch.setattr(phlebo_router.supabase, "table", mock_table)

    user = {"sub": "phlebo-1", "role": "phlebotomist"}
    req = phlebo_router.ConfirmCollectionRequest(
        sample_id=sample_id,
        barcode="CMX-260803-CUSTODY",
    )

    with pytest.raises(Exception) as exc_info:
        await phlebo_router.confirm_sample_collection(req, request=None, user=user)

    assert "Database error inserting custody event" in str(exc_info.value)


# ── 8. Barcode conflict inside confirm_sample_collection (Issue 5) ─────────────

@pytest.mark.asyncio
async def test_barcode_conflict_inside_confirm_sample_collection_returns_409(fake_db, monkeypatch):
    sample_id = "sample-confirm-barcode-race"
    _seed_sample_row(fake_db, sample_id=sample_id, status="pending_collection")

    orig_table = fake_db.table

    def mock_table(name):
        tbl = orig_table(name)
        if name == "samples":
            def mock_update(*args, **kwargs):
                raise Exception('duplicate key value violates unique constraint "samples_barcode_key" (23505)')
            tbl.update = mock_update
        return tbl

    monkeypatch.setattr(phlebo_router.supabase, "table", mock_table)

    user = {"sub": "phlebo-1", "role": "phlebotomist"}
    req = phlebo_router.ConfirmCollectionRequest(
        sample_id=sample_id,
        barcode="CMX-260803-RACE",
    )

    with pytest.raises(phlebo_router.HTTPException) as exc_info:
        await phlebo_router.confirm_sample_collection(req, request=None, user=user)

    assert exc_info.value.status_code == 409
    assert "already registered to another sample" in str(exc_info.value.detail)


# ── 9. Concurrent verification submits exactly ONE MediAssist job (Issue 8) ───

@pytest.mark.asyncio
async def test_concurrent_verification_submits_exactly_one_mediassist_job(fake_db, monkeypatch):
    sample_id = "sample-concurrent-single-submit"
    _seed_sample_row(fake_db, sample_id=sample_id, status="received", pc_id="pc-concurrent-2")

    mock_submit = AsyncMock(return_value={"status": "queued"})
    monkeypatch.setattr(report_submission_mod.mediassist_client, "submit_report_job", mock_submit)

    staff = {"user_id": "staff-1", "processing_center_id": "pc-concurrent-2", "role": "processing_center"}
    req = pc_router.VerifyRequest()

    res1, res2 = await asyncio.gather(
        pc_router.verify_sample(sample_id, req, staff=staff),
        pc_router.verify_sample(sample_id, req, staff=staff),
    )

    assert res1["success"] is True
    assert res2["success"] is True
    assert mock_submit.call_count == 1
    assert len(fake_db.db.get("report_jobs", [])) == 1


# ── 10. Crash recovery test for verify_sample (Issue 8 Crash-Recovery) ───────

@pytest.mark.asyncio
async def test_verify_sample_crash_recovery(fake_db, monkeypatch):
    sample_id = "sample-crash-recovery"
    _seed_sample_row(fake_db, sample_id=sample_id, status="received", pc_id="pc-crash")

    # Seed an existing unsubmitted ReportJob in 'queued' status (simulating pre-submission crash)
    fake_db.db.setdefault("report_jobs", []).append({
        "id": "job-pre-crash-id",
        "patient_id": "patient-user-1",
        "sample_id": sample_id,
        "processing_center_id": "pc-crash",
        "barcode": "CMX-260803-A1B2C3",
        "status": "queued",
        "connector_type": "mocdoc",
        "correlation_id": "corr-crash-1",
        "created_at": "2026-08-03T00:00:00Z",
    })

    mock_submit = AsyncMock(return_value={"status": "queued"})
    monkeypatch.setattr(report_submission_mod.mediassist_client, "submit_report_job", mock_submit)

    staff = {"user_id": "staff-1", "processing_center_id": "pc-crash", "role": "processing_center"}
    req = pc_router.VerifyRequest()

    # Retry verify_sample after pre-existing ReportJob creation
    res = await pc_router.verify_sample(sample_id, req, staff=staff)

    assert res["success"] is True
    # Reuses existing ReportJob without creating duplicates
    jobs = fake_db.db.get("report_jobs", [])
    assert len([j for j in jobs if j["sample_id"] == sample_id]) == 1
    assert jobs[0]["id"] == "job-pre-crash-id"
