"""
End-to-end integration tests for the CallMedex <-> MediAssist AI inbound flow
(Task 5 of the mediassist-inbound-integration plan).

This drives the REAL FastAPI app (`app.main.app`) via TestClient, with
`mediassist_client`'s outbound network call monkeypatched (no real Redis, no
real MediAssist server, no real Celery worker) -- exactly like Task 3's and
Task 4's own test files.

Task 3's `test_mediassist_inbound_routes.py` and Task 4's
`test_ai_reports_job_submission.py` already exercise every route in deep
isolation: signature verification, idempotency-cache mechanics, error
shapes, field-level DB assertions. This file does NOT re-litigate any of
that. Its only job is proving the CROSS-task wiring those files can't see on
their own:

  - a report_job_id minted by Task 4's POST /api/reports/analyze is the
    exact same id Task 3's callbacks look up and mutate, and the resulting
    ai_report_analyses row is genuinely visible through Task 4's own
    GET /jobs/{id} and GET /history reads
  - a headless patient created by Task 3's POST /whatsapp-bookings is
    genuinely discoverable through Task 3's own GET /patients/lookup

Signing helpers are imported from test_mediassist_inbound_routes.py rather
than re-implemented (per task brief) -- FakeSupabase is imported from
test_sample_lifecycle.py, same as both of those files already do.
"""
import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

import app.middleware.mediassist_auth as mediassist_auth_mod
import app.routers.ai_reports as ai_reports_mod
import app.routers.mediassist_inbound as mediassist_inbound_mod
import app.services.audit as audit_mod
from app.config import settings
from app.main import app
from app.middleware.auth import get_current_user
from tests.test_mediassist_inbound_routes import BEARER, SECRET, _get_signed, _new_corr, _new_idem, _post
from tests.test_sample_lifecycle import FakeSupabase

PATIENT_ID = "patient-e2e-1"
FAKE_PDF_BYTES = b"%PDF-1.4\n%fake pdf content for e2e tests\n"


@pytest.fixture(autouse=True)
def _configure_mediassist_settings(monkeypatch):
    monkeypatch.setattr(settings, "MEDIASSIST_INBOUND_BEARER_TOKEN", BEARER)
    monkeypatch.setattr(settings, "MEDIASSIST_HMAC_SECRET", SECRET)


@pytest.fixture
def fake_supabase(monkeypatch):
    """One shared FakeSupabase wired into every module that captured its own
    `from app.database import supabase` reference: ai_reports.py (Task 4),
    mediassist_inbound.py (Task 3), mediassist_auth.py (Task 2), and
    AuditService -- exactly the set of modules a real inbound request
    touches end to end. Without this, /api/reports/analyze and the
    /callbacks/* routes would be writing to two different in-memory "databases"
    and every cross-task assertion below would be meaningless."""
    fake = FakeSupabase()
    monkeypatch.setattr(ai_reports_mod, "supabase", fake)
    monkeypatch.setattr(mediassist_inbound_mod, "supabase", fake)
    monkeypatch.setattr(mediassist_auth_mod, "supabase", fake)
    monkeypatch.setattr(audit_mod, "supabase", fake)
    return fake


def _override_user(sub=PATIENT_ID, role="patient"):
    def _dep():
        return {"sub": sub, "role": role}
    return _dep


@pytest.fixture
def client():
    """Authenticated as PATIENT_ID for the Task 4 patient-facing routes.
    The MediAssist callback/whatsapp-booking routes below don't use
    get_current_user at all, so this override is simply inert for them."""
    app.dependency_overrides[get_current_user] = _override_user()
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def mock_storage(monkeypatch):
    monkeypatch.setattr(
        ai_reports_mod.StorageService, "upload_document",
        staticmethod(lambda user_id, file_bytes, ext, bucket=None: f"{user_id}/e2e.{ext}"),
    )
    monkeypatch.setattr(
        ai_reports_mod.StorageService, "signed_url",
        staticmethod(lambda path, expires=3600, bucket=None: f"https://storage.test/signed/{path}"),
    )


@pytest.fixture
def mock_analyzer(monkeypatch):
    fake_result = {
        "plain_language_summary": "Test analysis summary.",
        "doctor_clinical_summary": "Test clinical summary.",
        "abnormal_flags": [],
        "recommendations": ["Follow up with physician."],
    }
    from app.services import groq_report_analyzer as analyzer_mod
    monkeypatch.setattr(
        analyzer_mod.GroqReportAnalyzerService,
        "analyze_report_bytes",
        staticmethod(lambda fb, ct: fake_result),
    )
    return fake_result


@pytest.fixture
def mock_submit_success(monkeypatch):
    """MediAssist accepting the job."""
    mock = AsyncMock(return_value={"report_job_id": str(uuid.uuid4()), "status": "queued"})
    monkeypatch.setattr(ai_reports_mod.mediassist_client, "submit_report_job", mock)
    return mock


def _seed_patient_contact(fake, patient_id=PATIENT_ID, phone="+919000001234", language="te"):
    fake.db.setdefault("users", []).append({"id": patient_id, "mobile": phone})
    fake.db.setdefault("patients", []).append({"user_id": patient_id, "preferred_language": language})


def _submit_report(client) -> str:
    resp = client.post(
        "/api/reports/analyze",
        files={"file": ("report.pdf", FAKE_PDF_BYTES, "application/pdf")},
    )
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["status"] in ("queued", "delivered", "failed")
    report_job_id = body["report_job_id"]
    assert report_job_id
    return report_job_id


def _delivered_payload(report_job_id, summary="Your levels look mostly normal."):
    return {
        "report_job_id": report_job_id,
        "occurred_at": "2026-08-02T10:05:00Z",
        "delivered_channel": "whatsapp",
        "message_id": "wamid.e2e.1",
        "analysis": {
            "plain_language_summary": summary,
            "doctor_clinical_summary": "HbA1c elevated at 7.2%.",
            "health_score": 78,
            "abnormal_flags": [
                {"marker": "HbA1c", "value": "7.2%", "status": "high", "reference_range": "4.0-5.6%"}
            ],
            "recommendations": ["Follow up with your physician."],
        },
    }


def _whatsapp_payload(phone, **overrides):
    payload = {
        "patient_id": None,
        "phone": phone,
        "service_type": "home_blood_collection",
        "requested_time_window": {
            "earliest": "2026-08-05T07:00:00+05:30",
            "latest": "2026-08-05T09:00:00+05:30",
        },
        "address": {
            "line1": "Flat 12, Example Towers",
            "city": "Visakhapatnam",
            "pincode": "530001",
            "lat": 17.7231,
            "lng": 83.3012,
        },
        "source": "whatsapp",
        "source_conversation_id": "wa_conv_e2e_1",
    }
    payload.update(overrides)
    return payload


# ─── Scenario 1: submit -> processing -> delivered -> job read-back -> history ──

def test_report_submitted_processed_and_delivered_end_to_end(
    client, fake_supabase, mock_storage, mock_submit_success, mock_analyzer,
):
    _seed_patient_contact(fake_supabase)

    report_job_id = _submit_report(client)

    # CallMedex's own job row exists, queued, with the storage path recorded.
    job_row = fake_supabase.db["report_jobs"][0]
    assert job_row["id"] == report_job_id
    assert job_row["status"] in ("queued", "delivered")
    mock_submit_success.assert_awaited_once()

    # The id sent over the wire to MediAssist is the SAME id report_jobs.id
    # holds and the SAME id the callbacks below reference -- proving the two
    # services are not minting divergent ids for what should be one job.
    _, submit_kwargs = mock_submit_success.call_args
    assert submit_kwargs["report_job_id"] == report_job_id == job_row["id"]

    # MediAssist calls back: processing started.
    r1 = _post(
        client, "/callbacks/report-processing",
        {"report_job_id": report_job_id, "occurred_at": "2026-08-02T10:00:00Z"},
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert r1.status_code == 200
    assert fake_supabase.db["report_jobs"][0]["status"] == "processing"

    # MediAssist calls back: delivered, with the analysis payload.
    r2 = _post(
        client, "/callbacks/report-delivered", _delivered_payload(report_job_id),
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert r2.status_code == 200
    assert fake_supabase.db["report_jobs"][0]["status"] == "delivered"

    analyses = fake_supabase.db["ai_report_analyses"]
    # The callback updates/overwrites or inserts the delivered analysis payload.
    assert len(analyses) >= 1
    delivered_analysis = [a for a in analyses if a["report_job_id"] == report_job_id][0]
    assert delivered_analysis["patient_id"] == PATIENT_ID
    # raw_report_url was backfilled from the job's own source_document_path,
    # set when /api/reports/analyze submitted the job -- proving the two
    # tasks actually share state through the same row, not just similar shapes.
    assert delivered_analysis["raw_report_url"] == job_row["source_document_path"]

    # GET /jobs/{id} (Task 4) now reflects Task 3's callback-driven status.
    job_resp = client.get(f"/api/reports/jobs/{report_job_id}")
    assert job_resp.status_code == 200
    assert job_resp.json()["status"] == "delivered"

    # GET /api/reports/history (Task 4) surfaces the analysis Task 3's
    # callback wrote.
    history_resp = client.get("/api/reports/history")
    assert history_resp.status_code == 200
    summaries = [a["plain_language_summary"] for a in history_resp.json()["analyses"]]
    assert "Your levels look mostly normal." in summaries


# ─── Scenario 2: submit -> failed callback -> job failed, no analysis row ──────

def test_report_submitted_then_failed_marks_job_failed_without_analysis_row(
    client, fake_supabase, mock_storage, mock_submit_success, monkeypatch,
):
    from app.services import groq_report_analyzer as analyzer_mod
    monkeypatch.setattr(
        analyzer_mod.GroqReportAnalyzerService,
        "analyze_report_bytes",
        staticmethod(lambda fb, ct: {"error": True, "message": "ocr_failed"}),
    )
    _seed_patient_contact(fake_supabase)
    report_job_id = _submit_report(client)

    resp = _post(
        client, "/callbacks/report-failed",
        {
            "report_job_id": report_job_id,
            "occurred_at": "2026-08-02T10:10:00Z",
            "failure_reason": "ocr_failed",
            "details": "Scan too blurry to read.",
        },
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 200

    job_row = fake_supabase.db["report_jobs"][0]
    assert job_row["status"] == "failed"
    assert job_row["failure_reason"] == "ocr_failed"
    assert fake_supabase.db.get("ai_report_analyses", []) == []

    job_resp = client.get(f"/api/reports/jobs/{report_job_id}")
    assert job_resp.status_code == 200
    body = job_resp.json()
    assert body["status"] == "failed"
    assert body["failure_reason"] == "ocr_failed"

    history_resp = client.get("/api/reports/history")
    assert history_resp.json()["analyses"] == []


# ─── Scenario 3: whatsapp-booking headless patient + key-scoped idempotency ────

def test_whatsapp_booking_creates_patient_and_idempotency_is_keyed_not_global(client, fake_supabase):
    phone = "+919812399999"
    payload = _whatsapp_payload(phone)
    idem_key = _new_idem()

    r1 = _post(client, "/whatsapp-bookings", payload, idem_key=idem_key, correlation_id=_new_corr())
    r2 = _post(client, "/whatsapp-bookings", payload, idem_key=idem_key, correlation_id=_new_corr())

    assert r1.status_code == r2.status_code == 201
    assert r1.json() == r2.json()
    assert len(fake_supabase.db["bookings"]) == 1
    assert len(fake_supabase.db["users"]) == 1
    assert fake_supabase.db["users"][0]["role"] == "patient"

    # A genuinely new request (fresh idempotency key, same phone/body) must
    # NOT be deduped against the first -- proving the cache is scoped to
    # X-Idempotency-Key, not to the request body or phone number.
    r3 = _post(client, "/whatsapp-bookings", payload, idem_key=_new_idem(), correlation_id=_new_corr())
    assert r3.status_code == 201
    assert len(fake_supabase.db["bookings"]) == 2
    # Still only one patient user row -- the same phone resolves to the
    # patient the first call created, not a second headless one.
    assert len(fake_supabase.db["users"]) == 1


# ─── Scenario 4: patient lookup, incl. cross-checking the whatsapp-booking flow ─

def test_patient_lookup_reflects_patient_created_via_whatsapp_booking_and_404s_for_unknown(
    client, fake_supabase,
):
    phone = "+919812388888"
    booking_resp = _post(
        client, "/whatsapp-bookings", _whatsapp_payload(phone),
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert booking_resp.status_code == 201
    created_patient_id = fake_supabase.db["users"][0]["id"]

    # The headless patient /whatsapp-bookings just created is genuinely
    # discoverable through the separate /patients/lookup route.
    found = _get_signed(client, "/patients/lookup", params={"phone": phone})
    assert found.status_code == 200
    data = found.json()
    assert data["patient_id"] == created_patient_id
    assert data["preferred_language"] == "en"  # headless-patient default

    missing = _get_signed(client, "/patients/lookup", params={"phone": "+910000099999"})
    assert missing.status_code == 404
