"""
Tests for the shared MediAssist AI Integration Client.

Uses httpx.MockTransport (built into httpx — no extra test dependency) so
these run with zero real network calls and verify: request signing,
idempotency/correlation header propagation, retry-only-on-5xx/transient
errors, no-retry-on-4xx, and the circuit breaker tripping/short-circuiting.
"""
import hashlib
import hmac

import httpx
import pytest

from app.integrations.mediassist_client import (
    MediAssistBadRequestError,
    MediAssistCircuitOpenError,
    MediAssistClient,
    MediAssistConflictError,
    MediAssistUnauthorizedError,
    MediAssistUnavailableError,
)
import app.integrations.mediassist_client as mediassist_client_module


BASE_URL = "https://mediassist.test"
BEARER = "test-bearer-token"
SECRET = "test-hmac-secret"


def _make_client(handler, *, max_retries=3):
    """Build a MediAssistClient wired to a MockTransport handler."""
    from app.config import settings

    settings.MEDIASSIST_MAX_RETRIES = max_retries
    settings.MEDIASSIST_CIRCUIT_FAILURE_THRESHOLD = 3
    settings.MEDIASSIST_CIRCUIT_RESET_SECONDS = 30
    return MediAssistClient(
        base_url=BASE_URL,
        bearer_token=BEARER,
        hmac_secret=SECRET,
        transport=httpx.MockTransport(handler),
    )


@pytest.fixture(autouse=True)
def _no_real_sleep(monkeypatch):
    """Retries/backoff must not slow the suite down with real asyncio.sleep."""
    async def _fast_sleep(_seconds):
        return None

    monkeypatch.setattr(mediassist_client_module.asyncio, "sleep", _fast_sleep)


def _report_job_kwargs():
    return dict(
        report_job_id="rj_test_1",
        source_type="lab_report",
        source_document_url="https://storage.callmedex.test/signed/reports/abc.pdf",
        patient={"patient_id": "pat_1", "phone": "+919000000000", "preferred_language": "en"},
        delivery={"channels": ["whatsapp"]},
    )


# ─── Signing & headers ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_request_is_signed_and_carries_idempotency_and_correlation_headers():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["headers"] = request.headers
        captured["body"] = request.content
        return httpx.Response(202, json={"report_job_id": "rj_1", "status": "queued"})

    client = _make_client(handler)
    result = await client.submit_report_job(
        **_report_job_kwargs(), idempotency_key="idem-123", correlation_id="corr-456"
    )

    assert result == {"report_job_id": "rj_1", "status": "queued"}
    headers = captured["headers"]
    assert headers["Authorization"] == f"Bearer {BEARER}"
    assert headers["X-Idempotency-Key"] == "idem-123"
    assert headers["X-Correlation-Id"] == "corr-456"

    timestamp = headers["X-Timestamp"]
    expected_sig = "sha256=" + hmac.new(
        SECRET.encode(), (timestamp + ".").encode() + captured["body"], hashlib.sha256
    ).hexdigest()
    assert headers["X-Signature"] == expected_sig


@pytest.mark.asyncio
async def test_idempotency_key_is_stable_across_retries():
    seen_keys = []
    seen_correlation_ids = []
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        seen_keys.append(request.headers["X-Idempotency-Key"])
        seen_correlation_ids.append(request.headers["X-Correlation-Id"])
        if call_count["n"] < 3:
            return httpx.Response(500, json={"error": {"code": "internal", "message": "boom"}})
        return httpx.Response(202, json={"report_job_id": "rj_2", "status": "queued"})

    client = _make_client(handler, max_retries=5)
    await client.submit_report_job(**_report_job_kwargs())

    assert call_count["n"] == 3
    assert len(set(seen_keys)) == 1, "idempotency key must not change between retry attempts"
    assert len(set(seen_correlation_ids)) == 1, "correlation id must not change between retry attempts"


# ─── Retry behavior ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_retries_on_5xx_then_succeeds():
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        if call_count["n"] < 3:
            return httpx.Response(503, json={"error": {"code": "unavailable", "message": "down"}})
        return httpx.Response(202, json={"notification_id": "n_1", "status": "queued"})

    client = _make_client(handler, max_retries=5)
    result = await client.send_notification(
        channel="whatsapp",
        recipient={"phone": "+919000000000", "patient_id": "pat_1"},
        template="dispatch_arriving",
        template_data={"eta_minutes": 5},
    )

    assert result["notification_id"] == "n_1"
    assert call_count["n"] == 3


@pytest.mark.asyncio
async def test_retries_on_transient_network_error():
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        if call_count["n"] < 2:
            raise httpx.ConnectError("connection refused", request=request)
        return httpx.Response(202, json={"report_job_id": "rj_3", "status": "queued"})

    client = _make_client(handler, max_retries=5)
    result = await client.submit_report_job(**_report_job_kwargs())

    assert result["report_job_id"] == "rj_3"
    assert call_count["n"] == 2


@pytest.mark.asyncio
async def test_exhausting_retries_raises_unavailable():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": {"code": "internal", "message": "boom"}})

    client = _make_client(handler, max_retries=2)

    with pytest.raises(MediAssistUnavailableError):
        await client.submit_report_job(**_report_job_kwargs())


# ─── No retry on 4xx ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_400_raises_immediately_without_retry():
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        return httpx.Response(400, json={"error": {"code": "invalid_template", "message": "bad"}})

    client = _make_client(handler, max_retries=5)

    with pytest.raises(MediAssistBadRequestError):
        await client.send_notification(
            channel="whatsapp",
            recipient={"phone": "+919000000000"},
            template="not_a_real_template",
            template_data={},
        )

    assert call_count["n"] == 1


@pytest.mark.asyncio
async def test_401_raises_unauthorized_without_retry():
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        return httpx.Response(401, json={"error": {"code": "unauthorized", "message": "bad token"}})

    client = _make_client(handler, max_retries=5)

    with pytest.raises(MediAssistUnauthorizedError):
        await client.submit_report_job(**_report_job_kwargs())

    assert call_count["n"] == 1


@pytest.mark.asyncio
async def test_409_raises_conflict_without_retry():
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        return httpx.Response(409, json={"error": {"code": "idempotency_conflict", "message": "reused"}})

    client = _make_client(handler, max_retries=5)

    with pytest.raises(MediAssistConflictError):
        await client.submit_report_job(**_report_job_kwargs())

    assert call_count["n"] == 1


# ─── Circuit breaker ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_circuit_opens_after_threshold_and_short_circuits():
    from app.config import settings

    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        return httpx.Response(500, json={"error": {"code": "internal", "message": "boom"}})

    # max_retries=1 so each public call = exactly one breaker failure recorded.
    # _make_client resets threshold/reset-seconds to their defaults, so the
    # per-test overrides must be applied AFTER construction — the breaker
    # itself is created lazily, on the first request, so this is still timely.
    client = _make_client(handler, max_retries=1)
    settings.MEDIASSIST_CIRCUIT_FAILURE_THRESHOLD = 2
    settings.MEDIASSIST_CIRCUIT_RESET_SECONDS = 3600  # won't reset during this test
    client._breakers.clear()  # ensure a clean breaker for this endpoint

    with pytest.raises(MediAssistUnavailableError):
        await client.submit_report_job(**_report_job_kwargs())
    with pytest.raises(MediAssistUnavailableError):
        await client.submit_report_job(**_report_job_kwargs())

    calls_before_open = call_count["n"]

    with pytest.raises(MediAssistCircuitOpenError):
        await client.submit_report_job(**_report_job_kwargs())

    assert call_count["n"] == calls_before_open, "circuit-open call must not reach the transport"


# ─── Unconfigured base URL fails closed (not an unhandled 500) ─────────────


@pytest.mark.asyncio
async def test_blank_base_url_raises_unavailable_not_unsupported_protocol():
    """An empty MEDIASSIST_BASE_URL must never let httpx.UnsupportedProtocol
    escape -- that exception is not a MediAssistError, so every
    `except MediAssistError` call site (ai_reports.py, workers/tasks/
    notifications.py, workers/tasks/payments.py) would miss it and this
    would surface as an unhandled 500 instead of the designed failure path."""
    client = MediAssistClient(base_url="", bearer_token=BEARER, hmac_secret=SECRET)

    with pytest.raises(MediAssistUnavailableError):
        await client.submit_report_job(**_report_job_kwargs())

    with pytest.raises(MediAssistUnavailableError):
        await client.send_notification(
            channel="whatsapp",
            recipient={"phone": "+919000000000"},
            template="dispatch_arriving",
            template_data={},
        )

    with pytest.raises(MediAssistUnavailableError):
        await client.get_report_job_status("rj_1")


@pytest.mark.asyncio
async def test_get_report_job_status_uses_get_and_no_body_signing_issue():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path == "/api/v1/report-jobs/rj_99"
        return httpx.Response(
            200, json={"report_job_id": "rj_99", "status": "processing", "updated_at": "2026-08-02T00:00:00Z"}
        )

    client = _make_client(handler)
    result = await client.get_report_job_status("rj_99")
    assert result["status"] == "processing"
