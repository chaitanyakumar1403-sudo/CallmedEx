"""
Regression tests for the production silent-failure audit.

Each test pins one behaviour that used to fail quietly — reporting success,
or an empty list, while nothing was written and nobody was told.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.middleware.auth import get_current_user

client = TestClient(app)

PHLEBO = {"sub": "phlebo-1", "role": "phlebotomist", "full_name": "Asha Rao"}
OTHER_PHLEBO = {"sub": "phlebo-2", "role": "phlebotomist", "full_name": "Vikram S"}
NURSE = {"sub": "nurse-1", "role": "nurse", "full_name": "Sister Mary"}
DOCTOR = {"sub": "doctor-1", "role": "doctor", "full_name": "Dr Iyer"}
PATIENT = {"sub": "patient-1", "role": "patient", "full_name": "Ravi Kumar"}


def _as(user):
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


def _dispatch_owned_by(provider_id, notes=""):
    """Supabase double whose dispatch_requests select returns one owned row."""
    sb = MagicMock()
    chain = sb.table.return_value
    for m in ("select", "eq", "in_", "order", "limit", "gte", "lte", "update", "insert"):
        getattr(chain, m).return_value = chain
    chain.execute.return_value = MagicMock(
        data=[{"id": "dispatch-1", "assigned_provider_id": provider_id, "notes": notes}]
    )
    return sb


# ─── Unauthenticated PHI leak on the debug endpoint ────────────────────────

def test_debug_dispatch_state_requires_admin():
    _as(PHLEBO)
    res = client.get("/api/dispatch/debug/booking/booking-1")
    assert res.status_code == 403, res.text


def test_debug_dispatch_state_rejects_anonymous():
    app.dependency_overrides.clear()
    res = client.get("/api/dispatch/debug/booking/booking-1")
    assert res.status_code in (401, 403), res.text


# ─── Field-log endpoints must not write to a stranger's visit ──────────────

def test_lab_handover_rejects_unassigned_provider():
    _as(OTHER_PHLEBO)
    with patch("app.routers.dispatch.supabase", _dispatch_owned_by("phlebo-1")):
        res = client.post(
            "/api/dispatch/dispatch-1/lab-handover",
            json={"hub_name": "Vizag Hub", "sample_barcodes": "CMX-1",
                  "temperature_status": "ok"},
        )
    assert res.status_code == 403, res.text


def test_clinical_notes_rejects_unassigned_nurse():
    _as(NURSE)
    with patch("app.routers.dispatch.supabase", _dispatch_owned_by("nurse-other")):
        res = client.post(
            "/api/dispatch/dispatch-1/clinical-notes",
            json={"procedure_notes": "Dressing changed."},
        )
    assert res.status_code == 403, res.text


def test_lab_handover_reports_failure_instead_of_fake_success():
    """A dropped write used to still answer 'Samples handed over!'."""
    _as(PHLEBO)
    sb = _dispatch_owned_by("phlebo-1")
    sb.table.return_value.update.return_value.eq.return_value.execute.side_effect = (
        RuntimeError("connection reset")
    )
    with patch("app.routers.dispatch.supabase", sb):
        res = client.post(
            "/api/dispatch/dispatch-1/lab-handover",
            json={"hub_name": "Vizag Hub", "sample_barcodes": "CMX-1",
                  "temperature_status": "ok"},
        )
    assert res.status_code == 503, res.text


# ─── "No work today" must not be how an outage looks ──────────────────────

def test_my_tasks_surfaces_outage_rather_than_empty_list():
    _as(PHLEBO)
    sb = MagicMock()
    sb.table.side_effect = RuntimeError("db down")
    with patch("app.routers.dispatch.supabase", sb):
        res = client.get("/api/dispatch/my-tasks")
    assert res.status_code == 503, res.text


def test_pending_offers_surfaces_outage_rather_than_empty_list():
    _as(PHLEBO)
    sb = MagicMock()
    sb.table.side_effect = RuntimeError("db down")
    with patch("app.routers.dispatch.supabase", sb):
        res = client.get("/api/dispatch/offers/pending")
    assert res.status_code == 503, res.text


# ─── Doctor dashboard's missing endpoint ──────────────────────────────────

def test_provider_today_endpoint_exists_and_returns_own_bookings():
    _as(DOCTOR)
    sb = MagicMock()
    chain = sb.table.return_value
    for m in ("select", "eq", "gte", "lte", "order"):
        getattr(chain, m).return_value = chain
    chain.execute.return_value = MagicMock(
        data=[{"id": "booking-1", "provider_id": "doctor-1",
               "slot_start": "2026-09-03T10:30:00+05:30"}]
    )
    with patch("app.routers.bookings.supabase", sb):
        res = client.get("/api/bookings/provider/today")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True
    assert len(body["data"]["bookings"]) == 1


def test_provider_today_rejects_patients():
    _as(PATIENT)
    res = client.get("/api/bookings/provider/today")
    assert res.status_code == 403, res.text


# ─── Teleconsultation meeting token ───────────────────────────────────────

CONSULT = {
    "id": "consult-1",
    "patient_id": "patient-1",
    "doctor_id": "doctor-1",
    "video_room_name": "cmx-abcd1234",
    "video_room_url": "https://callmedex.daily.co/cmx-abcd1234",
}


def test_meeting_token_is_awaited_not_a_coroutine():
    """The handler called an async helper without awaiting it, so the response
    carried a coroutine and JSON encoding blew up."""
    _as(DOCTOR)
    with patch("app.routers.telemedicine.TelemedicineService.get_consultation",
               new=AsyncMock(return_value=CONSULT)), \
         patch("app.routers.telemedicine.TelemedicineService.generate_daily_meeting_token",
               new=AsyncMock(return_value="tok-123")):
        res = client.get("/api/telemed/consult-1/meeting-token")
    assert res.status_code == 200, res.text
    assert res.json()["meeting_token"] == "tok-123"


def test_meeting_token_denied_to_non_participant():
    stranger = {"sub": "doctor-9", "role": "doctor", "full_name": "Dr Nobody"}
    _as(stranger)
    with patch("app.routers.telemedicine.TelemedicineService.get_consultation",
               new=AsyncMock(return_value=CONSULT)), \
         patch("app.routers.telemedicine.TelemedicineService.generate_daily_meeting_token",
               new=AsyncMock(return_value="tok-123")):
        res = client.get("/api/telemed/consult-1/meeting-token")
    assert res.status_code == 403, res.text


def test_meeting_token_patient_is_not_moderator():
    _as(PATIENT)
    with patch("app.routers.telemedicine.TelemedicineService.get_consultation",
               new=AsyncMock(return_value=CONSULT)), \
         patch("app.routers.telemedicine.TelemedicineService.generate_daily_meeting_token",
               new=AsyncMock(return_value="tok-123")):
        res = client.get("/api/telemed/consult-1/meeting-token")
    assert res.status_code == 200, res.text
    assert res.json()["is_doctor"] is False


# ─── Notification channels must not claim delivery they cannot make ───────

@pytest.mark.asyncio
async def test_unconfigured_sms_and_push_report_failure():
    from app.services.notification_engine import NotificationEngine

    sms = await NotificationEngine._send_sms("user-1", "Your report is ready")
    push = await NotificationEngine._send_push("user-1", "Title", "Body")
    assert sms["success"] is False
    assert push["success"] is False


@pytest.mark.asyncio
async def test_notification_record_marked_failed_for_dead_channel():
    from app.services.notification_engine import NotificationEngine

    with patch("app.services.notification_engine.supabase", None):
        result = await NotificationEngine.send(
            user_id="user-1", channel="sms", title="T", body="B"
        )
    assert result["status"] == "failed"


# ─── ReportJob retry sweep ────────────────────────────────────────────────

def test_report_retry_sweep_resubmits_due_jobs():
    from app.workers.tasks import report_retry

    due_job = {
        "id": "job-1",
        "patient_id": "patient-1",
        "booking_id": "booking-1",
        "sample_id": "sample-1",
        "processing_center_id": "pc-1",
        "barcode": "CMX-1",
        "connector_type": "mocdoc",
        "idempotency_key": "idem-1",
        "correlation_id": "corr-1",
    }
    sb = MagicMock()
    chain = sb.table.return_value
    for m in ("select", "in_", "eq", "lte", "limit"):
        getattr(chain, m).return_value = chain
    chain.execute.return_value = MagicMock(data=[due_job])

    submitted = {}

    async def _fake_submit(**kwargs):
        submitted.update(kwargs)
        return {"status": "submitted"}

    with patch.object(report_retry, "supabase", sb), \
         patch("app.services.report_submission.submit_report_job_to_mediassist",
               new=_fake_submit):
        result = report_retry.retry_due_report_jobs()

    assert result == {"scanned": 1, "retried": 1, "failed": 0}
    assert submitted["report_job_id"] == "job-1"
    assert submitted["correlation_id"] == "corr-1"


def test_report_retry_sweep_is_registered_on_the_beat_schedule():
    """The retry state machine existed but nothing consumed it."""
    from app.workers.celery_app import celery_app

    tasks = {
        entry["task"] for entry in celery_app.conf.beat_schedule.values()
    }
    assert "app.workers.tasks.report_retry.retry_due_report_jobs" in tasks
    assert "app.workers.tasks.report_retry" in celery_app.conf.include
