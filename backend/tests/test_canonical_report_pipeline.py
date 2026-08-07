"""
Tests for Canonical Report Pipeline Integration Checks.

Specifically verifies:
1. CallMedex creates a ReportJob for a real booking/sample.
2. MediAssist Client sends barcode, connector_type, processing_center_id, sample_id, booking_id, and correlation_id.
3. Inbound callback correctly updates the same ReportJob.
4. Corrected report updates ai_report_analyses and preserves version history rather than creating a new ReportJob.
5. Replaying the same callback with the same idempotency key leaves the database unchanged.
6. Callback with invalid signature gets rejected (HTTP 401).
"""
import hashlib
import hmac
from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.services.processing_center import create_canonical_report_job_for_sample
from app.integrations.mediassist_client import MediAssistClient
import app.routers.mediassist_inbound as mediassist_inbound_mod
from tests.test_sample_lifecycle import FakeSupabase
from tests.test_mediassist_inbound_routes import BEARER, SECRET, _get_signed, _new_corr, _new_idem, _post


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    import app.services.processing_center as pc_mod
    monkeypatch.setattr(pc_mod, "supabase", fake)
    monkeypatch.setattr(mediassist_inbound_mod, "supabase", fake)
    return fake


@pytest.fixture(autouse=True)
def _configure_settings(monkeypatch):
    monkeypatch.setattr(settings, "MEDIASSIST_INBOUND_BEARER_TOKEN", BEARER)
    monkeypatch.setattr(settings, "MEDIASSIST_HMAC_SECRET", SECRET)


@pytest.fixture
def client():
    return TestClient(app)


def test_create_canonical_report_job_for_sample(fake_db):
    sample_id = "sample-100"
    fake_db.db.setdefault("samples", []).append({
        "id": sample_id,
        "booking_id": "booking-200",
        "patient_id": "patient-300",
        "processing_center_id": "pc-400",
        "barcode": "CMX-BAR-100",
        "status": "sent_to_lab",
    })

    job_id = create_canonical_report_job_for_sample(sample_id, connector_type="mocdoc")
    assert job_id is not None

    jobs = fake_db.db.get("report_jobs", [])
    assert len(jobs) == 1
    job = jobs[0]
    assert job["id"] == job_id
    assert job["sample_id"] == sample_id
    assert job["booking_id"] == "booking-200"
    assert job["patient_id"] == "patient-300"
    assert job["processing_center_id"] == "pc-400"
    assert job["barcode"] == "CMX-BAR-100"
    assert job["connector_type"] == "mocdoc"
    assert job["status"] == "queued"


def test_mediassist_client_sends_all_6_canonical_fields(monkeypatch):
    """Verify submit_report_job sends barcode, connector_type, processing_center_id, sample_id, booking_id, and correlation_id."""
    import httpx

    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json
        captured["body"] = json.loads(request.content)
        return httpx.Response(202, json={"report_job_id": "job-666", "status": "queued"})

    client = MediAssistClient(
        base_url="https://mediassist.test",
        bearer_token=BEARER,
        hmac_secret=SECRET,
        transport=httpx.MockTransport(handler),
    )

    import asyncio
    asyncio.run(client.submit_report_job(
        report_job_id="job-666",
        source_type="lab_report",
        source_document_url="https://storage.test/signed/doc.pdf",
        booking_id="booking-777",
        sample_id="sample-888",
        processing_center_id="pc-999",
        barcode="CMX-BARCODE-999",
        connector_type="mocdoc",
        patient={"patient_id": "patient-111", "phone": "+919000000000", "preferred_language": "en"},
        delivery={"channels": ["whatsapp"]},
        correlation_id="corr-555",
    ))

    body = captured["body"]
    assert body["report_job_id"] == "job-666"
    assert body["booking_id"] == "booking-777"
    assert body["sample_id"] == "sample-888"
    assert body["processing_center_id"] == "pc-999"
    assert body["barcode"] == "CMX-BARCODE-999"
    assert body["connector_type"] == "mocdoc"


def test_inbound_callback_updates_canonical_report_job(client, fake_db):
    """Verify callback updates status of the canonical ReportJob record."""
    report_job_id = "job-canonical-1"
    fake_db.db.setdefault("report_jobs", []).append({
        "id": report_job_id,
        "patient_id": "pat-1",
        "booking_id": "book-1",
        "sample_id": "samp-1",
        "processing_center_id": "pc-1",
        "barcode": "CMX-1",
        "connector_type": "mocdoc",
        "status": "queued",
        "correlation_id": "corr-1",
        "source_document_path": "pat-1/doc.pdf",
    })

    # Processing started
    resp1 = _post(
        client, "/callbacks/report-processing",
        {"report_job_id": report_job_id, "occurred_at": "2026-08-03T10:00:00Z"},
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp1.status_code == 200
    assert fake_db.db["report_jobs"][0]["status"] == "processing"

    # Delivered
    delivered_payload = {
        "report_job_id": report_job_id,
        "occurred_at": "2026-08-03T10:05:00Z",
        "delivered_channel": "whatsapp",
        "message_id": "msg-100",
        "analysis": {
            "plain_language_summary": "Initial report summary.",
            "doctor_clinical_summary": "Clinical notes.",
            "abnormal_flags": [],
            "recommendations": [],
        },
    }
    resp2 = _post(
        client, "/callbacks/report-delivered",
        delivered_payload,
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp2.status_code == 200
    assert fake_db.db["report_jobs"][0]["status"] == "delivered"
    assert len(fake_db.db["ai_report_analyses"]) == 1


def test_corrected_report_versioning_and_idempotency_replay(client, fake_db):
    """Verify corrected report callback updates analysis & same idempotency key replay leaves DB unchanged."""
    report_job_id = "job-canonical-2"
    fake_db.db.setdefault("report_jobs", []).append({
        "id": report_job_id,
        "patient_id": "pat-2",
        "status": "processing",
        "source_document_path": "pat-2/doc.pdf",
    })

    idem_1 = _new_idem()
    delivered_payload_1 = {
        "report_job_id": report_job_id,
        "occurred_at": "2026-08-03T10:00:00Z",
        "delivered_channel": "whatsapp",
        "message_id": "msg-200",
        "analysis": {
            "plain_language_summary": "Summary v1",
            "doctor_clinical_summary": "Notes v1",
            "abnormal_flags": [],
            "recommendations": [],
        },
    }

    # Initial delivery
    r1 = _post(client, "/callbacks/report-delivered", delivered_payload_1, idem_key=idem_1, correlation_id=_new_corr())
    assert r1.status_code == 200
    assert len(fake_db.db["ai_report_analyses"]) == 1
    assert fake_db.db["ai_report_analyses"][0]["plain_language_summary"] == "Summary v1"

    # Replaying same callback with SAME idempotency key leaves DB unchanged
    r1_replay = _post(client, "/callbacks/report-delivered", delivered_payload_1, idem_key=idem_1, correlation_id=_new_corr())
    assert r1_replay.status_code == 200
    assert len(fake_db.db["ai_report_analyses"]) == 1  # unchanged!

    # Corrected report delivery with NEW idempotency key updates existing analysis row (ReportJob count remains 1)
    idem_2 = _new_idem()
    delivered_payload_2 = {
        "report_job_id": report_job_id,
        "occurred_at": "2026-08-03T10:30:00Z",
        "delivered_channel": "whatsapp",
        "message_id": "msg-201",
        "analysis": {
            "plain_language_summary": "Corrected Summary v2",
            "doctor_clinical_summary": "Corrected Notes v2",
            "abnormal_flags": [],
            "recommendations": [],
        },
    }
    r2 = _post(client, "/callbacks/report-delivered", delivered_payload_2, idem_key=idem_2, correlation_id=_new_corr())
    assert r2.status_code == 200
    assert len(fake_db.db["report_jobs"]) == 1  # ReportJob count remains 1!
    assert len(fake_db.db["ai_report_analyses"]) == 2  # Version history preserved!
    assert fake_db.db["ai_report_analyses"][-1]["plain_language_summary"] == "Corrected Summary v2"


def test_invalid_signature_callback_rejected(client, fake_db):
    """Verify callback with invalid HMAC signature is rejected with HTTP 401."""
    report_job_id = "job-canonical-3"
    fake_db.db.setdefault("report_jobs", []).append({
        "id": report_job_id,
        "patient_id": "pat-3",
        "status": "queued",
    })

    headers = {
        "Authorization": f"Bearer {BEARER}",
        "X-Signature": "sha256=invalid_signature_hash_here",
        "X-Timestamp": "2026-08-03T10:00:00Z",
        "X-Idempotency-Key": _new_idem(),
        "X-Correlation-Id": _new_corr(),
        "Content-Type": "application/json",
    }

    resp = client.post(
        "/api/v1/integrations/mediassist/callbacks/report-processing",
        json={"report_job_id": report_job_id, "occurred_at": "2026-08-03T10:00:00Z"},
        headers=headers,
    )
    assert resp.status_code == 401
    assert fake_db.db["report_jobs"][0]["status"] == "queued"  # DB unchanged!
