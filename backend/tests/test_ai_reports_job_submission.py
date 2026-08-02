"""
Tests for the rewired POST /api/reports/analyze + GET /api/reports/jobs/{id}
(backend/app/routers/ai_reports.py) — Task 4.

CallMedex no longer does OCR/AI report interpretation in-process. /analyze
now stores the upload and submits an async job to MediAssist AI via
app.integrations.mediassist_client.mediassist_client.submit_report_job,
which is monkeypatched here as an AsyncMock — no real network call, and no
real Supabase Storage call either (StorageService is monkeypatched at the
router's imported reference so these tests exercise router logic, not the
storage/HTTP integrations covered by test_mediassist_client.py).
"""
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

import app.routers.ai_reports as ai_reports_mod
from app.integrations.mediassist_client import MediAssistUnavailableError
from app.main import app
from app.middleware.auth import get_current_user
from tests.test_sample_lifecycle import FakeSupabase

PATIENT_ID = "patient-alice"
OTHER_PATIENT_ID = "patient-bob"

FAKE_PDF_BYTES = b"%PDF-1.4\n%fake pdf content for tests\n"


def _override_user(sub=PATIENT_ID, role="patient"):
    def _dep():
        return {"sub": sub, "role": role}
    return _dep


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = _override_user()
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(ai_reports_mod, "supabase", fake)
    # Seed a mobile + preferred_language so job submission has real values.
    fake.db.setdefault("users", []).append({"id": PATIENT_ID, "mobile": "+919000000001"})
    fake.db.setdefault("patients", []).append({"user_id": PATIENT_ID, "preferred_language": "te"})
    return fake


@pytest.fixture
def mock_storage(monkeypatch):
    """Bypass real Supabase Storage — return deterministic path/URL."""
    monkeypatch.setattr(
        ai_reports_mod.StorageService, "upload_document",
        staticmethod(lambda user_id, file_bytes, ext, bucket=None: f"{user_id}/fake.{ext}"),
    )
    monkeypatch.setattr(
        ai_reports_mod.StorageService, "signed_url",
        staticmethod(lambda path, expires=3600, bucket=None: f"https://storage.test/signed/{path}"),
    )


@pytest.fixture
def mock_submit_success(monkeypatch):
    mock = AsyncMock(return_value={"report_job_id": "mediassist-job-1", "status": "queued"})
    monkeypatch.setattr(ai_reports_mod.mediassist_client, "submit_report_job", mock)
    return mock


@pytest.fixture
def mock_submit_failure(monkeypatch):
    mock = AsyncMock(side_effect=MediAssistUnavailableError("MediAssist unavailable for POST /api/v1/report-jobs"))
    monkeypatch.setattr(ai_reports_mod.mediassist_client, "submit_report_job", mock)
    return mock


def _post_report(client, *, filename="report.pdf", content=FAKE_PDF_BYTES, content_type="application/pdf"):
    return client.post(
        "/api/reports/analyze",
        files={"file": (filename, content, content_type)},
    )


# ─── Valid upload → 202 + queued report_jobs row ────────────────────────────

def test_valid_upload_returns_202_and_queues_job(client, fake_db, mock_storage, mock_submit_success):
    resp = _post_report(client)

    assert resp.status_code == 202
    body = resp.json()
    assert body["success"] is True
    assert body["status"] == "queued"
    report_job_id = body["report_job_id"]
    assert report_job_id

    jobs = fake_db.db.get("report_jobs", [])
    assert len(jobs) == 1
    job = jobs[0]
    assert job["id"] == report_job_id
    assert job["patient_id"] == PATIENT_ID
    assert job["status"] == "queued"
    assert job["source_type"] == "lab_report"
    assert job["source_document_path"] == f"{PATIENT_ID}/fake.pdf"

    # submit_report_job was called with the patient's real phone/language.
    mock_submit_success.assert_awaited_once()
    _, kwargs = mock_submit_success.call_args
    assert kwargs["patient"]["patient_id"] == PATIENT_ID
    assert kwargs["patient"]["phone"] == "+919000000001"
    assert kwargs["patient"]["preferred_language"] == "te"
    assert kwargs["delivery"] == {"channels": ["whatsapp"]}
    assert kwargs["source_type"] == "lab_report"


# ─── Oversized file → 413 (unchanged) ───────────────────────────────────────

def test_oversized_file_returns_413(client, fake_db):
    oversized = b"%PDF-1.4\n" + b"0" * (10 * 1024 * 1024 + 1)
    resp = _post_report(client, content=oversized)
    assert resp.status_code == 413
    assert fake_db.db.get("report_jobs", []) == []


# ─── Unsupported MIME type → 400 (unchanged) ────────────────────────────────

def test_unsupported_mime_type_returns_400(client, fake_db):
    resp = _post_report(client, filename="notes.txt", content=b"hello", content_type="text/plain")
    assert resp.status_code == 400
    assert fake_db.db.get("report_jobs", []) == []


# ─── submit_report_job raising MediAssistUnavailableError → 502 + failed row ─

def test_submit_failure_returns_502_and_marks_job_failed(client, fake_db, mock_storage, mock_submit_failure):
    resp = _post_report(client)

    assert resp.status_code == 502

    jobs = fake_db.db.get("report_jobs", [])
    assert len(jobs) == 1
    job = jobs[0]
    assert job["status"] == "failed"
    assert job["failure_reason"]
    assert "MediAssist" in job["failure_reason"]


# ─── GET /jobs/{id} ──────────────────────────────────────────────────────────

def test_get_job_returns_status_for_owning_patient(client, fake_db):
    fake_db.db.setdefault("report_jobs", []).append({
        "id": "job-1",
        "patient_id": PATIENT_ID,
        "status": "processing",
        "failure_reason": None,
        "updated_at": "2026-08-02T10:00:00Z",
    })

    resp = client.get("/api/reports/jobs/job-1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["report_job_id"] == "job-1"
    assert body["status"] == "processing"
    assert body["failure_reason"] is None


def test_get_job_for_another_patient_returns_404(client, fake_db):
    fake_db.db.setdefault("report_jobs", []).append({
        "id": "job-2",
        "patient_id": OTHER_PATIENT_ID,
        "status": "queued",
        "failure_reason": None,
        "updated_at": "2026-08-02T10:00:00Z",
    })

    resp = client.get("/api/reports/jobs/job-2")
    assert resp.status_code == 404


def test_get_job_unknown_id_returns_404(client, fake_db):
    resp = client.get("/api/reports/jobs/does-not-exist")
    assert resp.status_code == 404
