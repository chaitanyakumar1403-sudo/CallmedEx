"""
Tests for the 7 MediAssist AI inbound routes
(backend/app/routers/mediassist_inbound.py).

Drives the REAL app (`from app.main import app`) with FastAPI's TestClient,
not a minimal test harness — this is the only way to catch the
SecurityMiddleware body-sanitization interaction that would otherwise break
every genuinely-signed request in production (see
backend/app/middleware/security.py's SKIP_SANITIZE_PATHS comment and
mediassist_inbound.py's module docstring).

Signing helper duplicates the 3-line HMAC formula from
app/middleware/mediassist_auth.py rather than importing test-only code from
mediassist_client.py (per task brief — this one formula isn't worth a shared
test util).
"""
import hashlib
import hmac
import json
import time
import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from tests.test_sample_lifecycle import FakeSupabase

BEARER = "test-mediassist-inbound-bearer"
SECRET = "test-mediassist-inbound-secret"
PREFIX = "/api/v1/integrations/mediassist"


@pytest.fixture(autouse=True)
def _configure_settings(monkeypatch):
    monkeypatch.setattr(settings, "MEDIASSIST_INBOUND_BEARER_TOKEN", BEARER)
    monkeypatch.setattr(settings, "MEDIASSIST_HMAC_SECRET", SECRET)


@pytest.fixture
def fake_supabase(monkeypatch):
    """One shared FakeSupabase instance wired into every module that captured
    its own `from app.database import supabase` reference at import time:
    the router itself, Task 2's auth/idempotency module, and AuditService."""
    import app.middleware.mediassist_auth as auth_mod
    import app.routers.mediassist_inbound as router_mod
    import app.services.audit as audit_mod

    fake = FakeSupabase()
    monkeypatch.setattr(router_mod, "supabase", fake)
    monkeypatch.setattr(auth_mod, "supabase", fake)
    monkeypatch.setattr(audit_mod, "supabase", fake)
    return fake


@pytest.fixture
def client():
    return TestClient(app)


def _sign(timestamp: str, body: bytes, query: str = "") -> str:
    """`query` is the raw query string (no leading "?"), empty for POST
    routes -- matches verify_mediassist_signature's
    `timestamp + "." + query_string + body` scheme (Fix 7: GET's query
    string must be covered, or a captured signed GET could be replayed with
    a different `?phone=` to enumerate patients)."""
    digest = hmac.new(
        SECRET.encode(), f"{timestamp}.".encode() + query.encode() + body, hashlib.sha256
    ).hexdigest()
    return f"sha256={digest}"


def _headers(*, body: bytes, idem_key=None, correlation_id=None, bearer=BEARER, timestamp=None, signature=None):
    ts = str(timestamp if timestamp is not None else int(time.time()))
    sig = signature if signature is not None else _sign(ts, body)
    headers = {
        "X-Timestamp": ts,
        "X-Signature": sig,
        "Content-Type": "application/json",
    }
    if bearer is not None:
        headers["Authorization"] = f"Bearer {bearer}"
    if idem_key is not None:
        headers["X-Idempotency-Key"] = idem_key
    if correlation_id is not None:
        headers["X-Correlation-Id"] = correlation_id
    return headers


def _post(client, path, payload, **header_kwargs):
    body = json.dumps(payload).encode()
    headers = _headers(body=body, **header_kwargs)
    return client.post(f"{PREFIX}{path}", content=body, headers=headers)


def _post_unsigned(client, path, payload):
    """A POST with no Authorization/signature at all — every route must 401 this."""
    body = json.dumps(payload).encode()
    return client.post(
        f"{PREFIX}{path}",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Idempotency-Key": _new_idem(),
            "X-Correlation-Id": _new_corr(),
        },
    )


def _new_idem() -> str:
    return str(uuid.uuid4())


def _new_corr() -> str:
    return str(uuid.uuid4())


# ─── 1. POST /callbacks/report-processing ──────────────────────────────────

def test_report_processing_success(client, fake_supabase):
    fake_supabase.db["report_jobs"] = [
        {"id": "job-1", "patient_id": "pat-1", "status": "queued", "source_type": "lab_report"}
    ]
    resp = _post(
        client, "/callbacks/report-processing",
        {"report_job_id": "job-1", "occurred_at": "2026-08-02T10:00:00Z"},
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 200
    assert resp.json() == {"received": True}
    assert fake_supabase.db["report_jobs"][0]["status"] == "processing"


def test_report_processing_unknown_job_404(client, fake_supabase):
    resp = _post(
        client, "/callbacks/report-processing",
        {"report_job_id": "missing-job", "occurred_at": "2026-08-02T10:00:00Z"},
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"]


def test_report_processing_unsigned_rejected(client, fake_supabase):
    resp = _post_unsigned(
        client, "/callbacks/report-processing",
        {"report_job_id": "job-1", "occurred_at": "2026-08-02T10:00:00Z"},
    )
    assert resp.status_code == 401


def test_report_processing_idempotent_replay(client, fake_supabase):
    fake_supabase.db["report_jobs"] = [{"id": "job-2", "patient_id": "pat-1", "status": "queued"}]
    idem_key = _new_idem()
    payload = {"report_job_id": "job-2", "occurred_at": "2026-08-02T10:00:00Z"}

    r1 = _post(client, "/callbacks/report-processing", payload, idem_key=idem_key, correlation_id=_new_corr())
    r2 = _post(client, "/callbacks/report-processing", payload, idem_key=idem_key, correlation_id=_new_corr())

    assert r1.status_code == r2.status_code == 200
    assert r1.json() == r2.json() == {"received": True}
    assert len(fake_supabase.db["mediassist_inbound_requests"]) == 1


# ─── 2. POST /callbacks/report-delivered ───────────────────────────────────

def _delivered_payload(report_job_id="job-3"):
    return {
        "report_job_id": report_job_id,
        "occurred_at": "2026-08-02T10:05:00Z",
        "delivered_channel": "whatsapp",
        "message_id": "wamid.123",
        "analysis": {
            "plain_language_summary": "Your sugar levels are a bit high.",
            "doctor_clinical_summary": "HbA1c elevated at 7.2%.",
            "health_score": 72,
            "abnormal_flags": [
                {"marker": "HbA1c", "value": "7.2%", "status": "high", "reference_range": "4.0-5.6%"}
            ],
            "recommendations": ["Follow up with your physician."],
        },
    }


def test_report_delivered_success_creates_analysis_row(client, fake_supabase):
    fake_supabase.db["report_jobs"] = [{
        "id": "job-3", "patient_id": "pat-9", "status": "processing",
        "source_document_path": "reports/pat-9/job-3.pdf",
    }]
    resp = _post(
        client, "/callbacks/report-delivered", _delivered_payload(),
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 200
    assert resp.json() == {"received": True}
    assert fake_supabase.db["report_jobs"][0]["status"] == "delivered"

    analyses = fake_supabase.db["ai_report_analyses"]
    assert len(analyses) == 1
    assert analyses[0]["patient_id"] == "pat-9"
    assert analyses[0]["report_job_id"] == "job-3"
    assert analyses[0]["raw_report_url"] == "reports/pat-9/job-3.pdf"
    assert analyses[0]["plain_language_summary"] == "Your sugar levels are a bit high."
    assert analyses[0]["abnormal_flags"][0]["marker"] == "HbA1c"


def test_report_delivered_unknown_job_404(client, fake_supabase):
    resp = _post(
        client, "/callbacks/report-delivered", _delivered_payload(report_job_id="ghost"),
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 404


def test_report_delivered_unsigned_rejected(client, fake_supabase):
    resp = _post_unsigned(client, "/callbacks/report-delivered", _delivered_payload())
    assert resp.status_code == 401


def test_report_delivered_idempotent_replay_does_not_double_upsert(client, fake_supabase):
    fake_supabase.db["report_jobs"] = [{
        "id": "job-4", "patient_id": "pat-9", "status": "processing",
        "source_document_path": "reports/pat-9/job-4.pdf",
    }]
    idem_key = _new_idem()
    payload = _delivered_payload(report_job_id="job-4")

    r1 = _post(client, "/callbacks/report-delivered", payload, idem_key=idem_key, correlation_id=_new_corr())
    r2 = _post(client, "/callbacks/report-delivered", payload, idem_key=idem_key, correlation_id=_new_corr())

    assert r1.status_code == r2.status_code == 200
    assert r1.json() == r2.json() == {"received": True}
    # The core assertion: a redelivered callback must not create a second
    # ai_report_analyses row for the same report_job_id.
    assert len(fake_supabase.db["ai_report_analyses"]) == 1


def test_report_delivered_idempotency_key_reuse_replays_cache_not_fresh_execution(client, fake_supabase):
    """Proves the cache actually short-circuits re-execution, not just that
    the handler's own upsert-by-report_job_id logic happens to converge to a
    consistent end-state either way.

    `report_delivered_callback` upserts `ai_report_analyses` keyed on
    `report_job_id` — replaying the IDENTICAL payload would look identical
    whether or not the idempotency cache actually fired (the second call
    would just hit the "update" branch on its own). So instead this reuses
    the same `X-Idempotency-Key` for two calls with DIFFERENT payloads
    (different `plain_language_summary`) and asserts the second call's
    response is the cached first response, and the stored analysis still
    reflects the FIRST payload — proving the second call's body was never
    reprocessed at all.
    """
    fake_supabase.db["report_jobs"] = [{
        "id": "job-4b", "patient_id": "pat-9", "status": "processing",
        "source_document_path": "reports/pat-9/job-4b.pdf",
    }]
    idem_key = _new_idem()

    first_payload = _delivered_payload(report_job_id="job-4b")
    first_payload["analysis"]["plain_language_summary"] = "first call summary"

    second_payload = _delivered_payload(report_job_id="job-4b")
    second_payload["analysis"]["plain_language_summary"] = "second call summary — must never be stored"

    r1 = _post(client, "/callbacks/report-delivered", first_payload, idem_key=idem_key, correlation_id=_new_corr())
    r2 = _post(client, "/callbacks/report-delivered", second_payload, idem_key=idem_key, correlation_id=_new_corr())

    assert r1.status_code == r2.status_code == 200
    # The second response must be the byte-for-byte cached first response,
    # not a fresh 200 the handler happened to produce again.
    assert r2.json() == r1.json() == {"received": True}

    analyses = fake_supabase.db["ai_report_analyses"]
    assert len(analyses) == 1
    assert analyses[0]["plain_language_summary"] == "first call summary"


# ─── 3. POST /callbacks/report-failed ───────────────────────────────────────

def test_report_failed_success(client, fake_supabase):
    fake_supabase.db["report_jobs"] = [{"id": "job-5", "patient_id": "pat-1", "status": "processing"}]
    resp = _post(
        client, "/callbacks/report-failed",
        {
            "report_job_id": "job-5", "occurred_at": "2026-08-02T10:00:00Z",
            "failure_reason": "ocr_failed", "details": "Scan too blurry to read.",
        },
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 200
    job = fake_supabase.db["report_jobs"][0]
    assert job["status"] == "failed"
    assert job["failure_reason"] == "ocr_failed"


def test_report_failed_unknown_job_404(client, fake_supabase):
    resp = _post(
        client, "/callbacks/report-failed",
        {"report_job_id": "ghost", "occurred_at": "2026-08-02T10:00:00Z", "failure_reason": "ocr_failed"},
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 404


def test_report_failed_unsigned_rejected(client, fake_supabase):
    resp = _post_unsigned(
        client, "/callbacks/report-failed",
        {"report_job_id": "job-5", "occurred_at": "2026-08-02T10:00:00Z", "failure_reason": "ocr_failed"},
    )
    assert resp.status_code == 401


def test_report_failed_idempotent_replay(client, fake_supabase):
    fake_supabase.db["report_jobs"] = [{"id": "job-5b", "patient_id": "pat-1", "status": "processing"}]
    idem_key = _new_idem()
    payload = {"report_job_id": "job-5b", "occurred_at": "2026-08-02T10:00:00Z", "failure_reason": "delivery_failed"}

    r1 = _post(client, "/callbacks/report-failed", payload, idem_key=idem_key, correlation_id=_new_corr())
    r2 = _post(client, "/callbacks/report-failed", payload, idem_key=idem_key, correlation_id=_new_corr())

    assert r1.json() == r2.json()
    assert len(fake_supabase.db["mediassist_inbound_requests"]) == 1


# ─── 4. POST /callbacks/report-expired ─────────────────────────────────────

def test_report_expired_success(client, fake_supabase):
    fake_supabase.db["report_jobs"] = [{"id": "job-6", "patient_id": "pat-1", "status": "queued"}]
    resp = _post(
        client, "/callbacks/report-expired",
        {"report_job_id": "job-6", "occurred_at": "2026-08-02T10:00:00Z"},
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 200
    assert fake_supabase.db["report_jobs"][0]["status"] == "expired"


def test_report_expired_unknown_job_404(client, fake_supabase):
    resp = _post(
        client, "/callbacks/report-expired",
        {"report_job_id": "ghost", "occurred_at": "2026-08-02T10:00:00Z"},
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 404


def test_report_expired_unsigned_rejected(client, fake_supabase):
    resp = _post_unsigned(
        client, "/callbacks/report-expired",
        {"report_job_id": "job-6", "occurred_at": "2026-08-02T10:00:00Z"},
    )
    assert resp.status_code == 401


# ─── 5. POST /callbacks/notification-status ────────────────────────────────

def test_notification_status_success_audits_no_table_update(client, fake_supabase):
    resp = _post(
        client, "/callbacks/notification-status",
        {"notification_id": "notif-1", "status": "delivered", "occurred_at": "2026-08-02T10:00:00Z"},
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 200
    assert resp.json() == {"received": True}

    audit_rows = fake_supabase.db.get("audit_log", [])
    matching = [r for r in audit_rows if r["action"] == "mediassist.notification_status"]
    assert len(matching) == 1
    # entity_id is UUID-typed on audit_log; notification_id may not be a
    # UUID (see below), so it's carried in `details`, not entity_id.
    assert matching[0]["entity_id"] is None
    assert matching[0]["details"]["notification_id"] == "notif-1"
    assert matching[0]["details"]["status"] == "delivered"


def test_notification_status_non_uuid_notification_id_still_audits(client, fake_supabase):
    """MediAssist's real notification ids may not be UUIDs (e.g.
    "notif_88213"). Previously this was passed as audit_log.entity_id (a
    UUID column); against a real Postgres DB that insert would fail, and
    AuditService.log only logs-and-swallows DB failures, so the callback's
    entire purpose (durably recording it happened) would silently produce
    no record at all. This must not depend on the id looking like a UUID."""
    resp = _post(
        client, "/callbacks/notification-status",
        {"notification_id": "notif_88213", "status": "failed", "failure_reason": "opted_out",
         "occurred_at": "2026-08-02T10:00:00Z"},
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 200

    matching = [
        r for r in fake_supabase.db.get("audit_log", [])
        if r["details"].get("notification_id") == "notif_88213"
    ]
    assert len(matching) == 1
    assert matching[0]["entity_id"] is None
    assert matching[0]["details"]["status"] == "failed"


def test_notification_status_unsigned_rejected(client, fake_supabase):
    resp = _post_unsigned(
        client, "/callbacks/notification-status",
        {"notification_id": "notif-1", "status": "failed", "occurred_at": "2026-08-02T10:00:00Z"},
    )
    assert resp.status_code == 401


def test_notification_status_idempotent_replay(client, fake_supabase):
    idem_key = _new_idem()
    payload = {"notification_id": "notif-2", "status": "failed", "failure_reason": "opted_out", "occurred_at": "2026-08-02T10:00:00Z"}

    r1 = _post(client, "/callbacks/notification-status", payload, idem_key=idem_key, correlation_id=_new_corr())
    r2 = _post(client, "/callbacks/notification-status", payload, idem_key=idem_key, correlation_id=_new_corr())

    assert r1.json() == r2.json()
    # Only the first call's audit entry should exist — the second was a
    # short-circuited cache replay.
    matching = [
        r for r in fake_supabase.db.get("audit_log", [])
        if r["details"].get("notification_id") == "notif-2"
    ]
    assert len(matching) == 1


# ─── 6. GET /patients/lookup ────────────────────────────────────────────────

def _get_signed(client, path, params=None):
    # Build the query string up front and issue the request against the
    # fully-formed URL (rather than passing `params=` to client.get
    # separately) so the exact bytes we sign are the exact bytes the server
    # sees on the wire -- request.url.query must match what was signed.
    query = str(httpx.QueryParams(params or {}))
    ts = str(int(time.time()))
    sig = _sign(ts, b"", query=query)
    url = f"{PREFIX}{path}"
    if query:
        url = f"{url}?{query}"
    return client.get(
        url,
        headers={"Authorization": f"Bearer {BEARER}", "X-Timestamp": ts, "X-Signature": sig},
    )


def test_patient_lookup_success(client, fake_supabase):
    fake_supabase.db["users"] = [{
        "id": "user-1", "role": "patient", "mobile": "+919876500000",
        "address": "Flat 1, Sample Towers", "city": "Visakhapatnam", "pincode": "530001",
    }]
    fake_supabase.db["patients"] = [{"user_id": "user-1", "preferred_language": "te"}]

    resp = _get_signed(client, "/patients/lookup", params={"phone": "+919876500000"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["patient_id"] == "user-1"
    assert data["preferred_language"] == "te"
    assert data["default_address"]["city"] == "Visakhapatnam"


def test_patient_lookup_matches_differently_formatted_stored_phone(client, fake_supabase):
    """users.mobile has no format validation at signup -- a patient stored
    as bare "9812345678" must still resolve when MediAssist sends the E.164
    form "+919812345678"."""
    fake_supabase.db["users"] = [{
        "id": "user-fmt-1", "role": "patient", "mobile": "9812345678",
        "address": "", "city": "", "pincode": "",
    }]

    resp = _get_signed(client, "/patients/lookup", params={"phone": "+919812345678"})
    assert resp.status_code == 200
    assert resp.json()["patient_id"] == "user-fmt-1"


def test_patient_lookup_not_found(client, fake_supabase):
    resp = _get_signed(client, "/patients/lookup", params={"phone": "+910000000000"})
    assert resp.status_code == 404


def test_patient_lookup_unsigned_rejected(client, fake_supabase):
    resp = client.get(f"{PREFIX}/patients/lookup", params={"phone": "+919876500000"})
    assert resp.status_code == 401


def test_patient_lookup_signature_replayed_with_different_query_is_rejected(client, fake_supabase):
    """A GET's signature must cover the query string. Before this fix, the
    signed message was `timestamp + "." + body`, and a GET body is always
    empty -- so a signature computed for one `?phone=` was equally valid
    for ANY other `?phone=` within the freshness window. Capture a
    genuinely valid signature/timestamp for one phone number, then reuse
    those exact headers against a different `?phone=` -- this must 401."""
    fake_supabase.db["users"] = [
        {"id": "user-a", "role": "patient", "mobile": "+919876500001", "address": "", "city": "", "pincode": ""},
        {"id": "user-b", "role": "patient", "mobile": "+919876500002", "address": "", "city": "", "pincode": ""},
    ]
    ts = str(int(time.time()))
    original_query = str(httpx.QueryParams({"phone": "+919876500001"}))
    sig = _sign(ts, b"", query=original_query)
    headers = {"Authorization": f"Bearer {BEARER}", "X-Timestamp": ts, "X-Signature": sig}

    legit = client.get(f"{PREFIX}/patients/lookup?{original_query}", headers=headers)
    assert legit.status_code == 200
    assert legit.json()["patient_id"] == "user-a"

    replayed_query = str(httpx.QueryParams({"phone": "+919876500002"}))
    replayed = client.get(f"{PREFIX}/patients/lookup?{replayed_query}", headers=headers)
    assert replayed.status_code == 401


# ─── 7. POST /whatsapp-bookings ─────────────────────────────────────────────

def _whatsapp_payload(**overrides):
    payload = {
        "patient_id": None,
        "phone": "+919812345678",
        "service_type": "home_blood_collection",
        "requested_time_window": {
            "earliest": "2026-08-05T07:00:00+05:30",
            "latest": "2026-08-05T09:00:00+05:30",
        },
        "address": {
            "line1": "Flat 302, Sai Residency",
            "city": "Visakhapatnam",
            "pincode": "530041",
            "lat": 17.7231,
            "lng": 83.3012,
        },
        "source": "whatsapp",
        "source_conversation_id": "wa_conv_88213",
    }
    payload.update(overrides)
    return payload


def test_whatsapp_booking_creates_headless_patient_and_confirms_home_collection(client, fake_supabase):
    resp = _post(
        client, "/whatsapp-bookings", _whatsapp_payload(),
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "confirmed"
    assert data["booking_id"]

    assert len(fake_supabase.db["users"]) == 1
    assert fake_supabase.db["users"][0]["role"] == "patient"
    assert len(fake_supabase.db["patients"]) == 1

    booking = fake_supabase.db["bookings"][0]
    assert booking["service_type"] == "home_collection"
    assert booking["status"] == "confirmed"
    assert booking["collection_city"] == "Visakhapatnam"
    assert booking["patient_id"] == fake_supabase.db["users"][0]["id"]


def test_whatsapp_booking_pending_review_for_non_home_collection_service(client, fake_supabase):
    resp = _post(
        client, "/whatsapp-bookings", _whatsapp_payload(service_type="pharmacy_order"),
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending_slot_assignment"

    booking = fake_supabase.db["bookings"][0]
    assert booking["status"] == "pending_review"
    assert booking["service_type"] == "pharmacy_delivery"


def test_whatsapp_booking_uses_existing_patient_found_by_phone(client, fake_supabase):
    fake_supabase.db["users"] = [{"id": "existing-pat", "role": "patient", "mobile": "+919812345678"}]

    resp = _post(
        client, "/whatsapp-bookings", _whatsapp_payload(),
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 201
    # No new patient was created — still exactly the one seeded user.
    assert len(fake_supabase.db["users"]) == 1
    booking = fake_supabase.db["bookings"][0]
    assert booking["patient_id"] == "existing-pat"


def test_whatsapp_booking_uses_given_patient_id_when_valid(client, fake_supabase):
    fake_supabase.db["users"] = [{"id": "known-pat", "role": "patient", "mobile": "+910000000009"}]

    resp = _post(
        client, "/whatsapp-bookings", _whatsapp_payload(patient_id="known-pat"),
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 201
    booking = fake_supabase.db["bookings"][0]
    assert booking["patient_id"] == "known-pat"
    assert len(fake_supabase.db["users"]) == 1


def test_whatsapp_booking_404_when_patient_id_and_phone_both_unresolved(client, fake_supabase):
    resp = _post(
        client, "/whatsapp-bookings",
        _whatsapp_payload(patient_id="ghost-patient", phone="+910000000001"),
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert resp.status_code == 404
    # No headless patient should have been created on a rejected request.
    assert fake_supabase.db.get("users", []) == []


def test_whatsapp_booking_unsigned_rejected(client, fake_supabase):
    resp = _post_unsigned(client, "/whatsapp-bookings", _whatsapp_payload())
    assert resp.status_code == 401


def test_whatsapp_booking_second_call_with_differently_formatted_phone_reuses_patient(client, fake_supabase):
    """A booking created for phone "9812340001", followed by a genuinely new
    booking (fresh idempotency key) for the E.164-equivalent
    "+919812340001", must resolve to the SAME patient rather than creating a
    duplicate headless patient identity."""
    first = _post(
        client, "/whatsapp-bookings", _whatsapp_payload(phone="9812340001"),
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert first.status_code == 201
    assert len(fake_supabase.db["users"]) == 1
    first_patient_id = fake_supabase.db["users"][0]["id"]

    second = _post(
        client, "/whatsapp-bookings", _whatsapp_payload(phone="+919812340001"),
        idem_key=_new_idem(), correlation_id=_new_corr(),
    )
    assert second.status_code == 201
    assert len(fake_supabase.db["users"]) == 1, "no duplicate patient should be created"
    assert len(fake_supabase.db["bookings"]) == 2
    assert fake_supabase.db["bookings"][1]["patient_id"] == first_patient_id


def test_whatsapp_booking_idempotent_replay_creates_one_booking(client, fake_supabase):
    idem_key = _new_idem()
    payload = _whatsapp_payload(phone="+919812340000")

    r1 = _post(client, "/whatsapp-bookings", payload, idem_key=idem_key, correlation_id=_new_corr())
    r2 = _post(client, "/whatsapp-bookings", payload, idem_key=idem_key, correlation_id=_new_corr())

    assert r1.status_code == r2.status_code == 201
    assert r1.json() == r2.json()
    assert len(fake_supabase.db["bookings"]) == 1
    # Redelivery must not create a second headless patient either.
    assert len(fake_supabase.db["users"]) == 1
