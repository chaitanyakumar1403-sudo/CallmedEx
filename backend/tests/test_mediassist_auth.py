"""
Tests for MediAssist inbound request verification + idempotency cache.

`verify_mediassist_signature` is the gate every inbound MediAssist route
(Task 3) sits behind; these tests build a minimal FastAPI app with one route
wrapping it as a dependency and drive it with a real TestClient, so the
HTTP-level behavior (headers, status codes) is exercised rather than just
the function in isolation. The idempotency cache functions are tested
directly against the same FakeSupabase double `test_sample_lifecycle.py`
uses, rather than inventing a new fake.
"""
import hashlib
import hmac
import time

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.config import settings
from app.middleware.mediassist_auth import (
    get_cached_idempotent_response,
    store_idempotent_response,
    verify_mediassist_signature,
)

BEARER = "test-inbound-bearer-token"
SECRET = "test-inbound-hmac-secret"


@pytest.fixture(autouse=True)
def _configure_settings(monkeypatch):
    monkeypatch.setattr(settings, "MEDIASSIST_INBOUND_BEARER_TOKEN", BEARER)
    monkeypatch.setattr(settings, "MEDIASSIST_HMAC_SECRET", SECRET)


@pytest.fixture
def client():
    app = FastAPI()

    @app.post("/test-endpoint")
    async def _endpoint(_verified: None = Depends(verify_mediassist_signature)):
        return {"ok": True}

    return TestClient(app)


def _sign(timestamp: str, body: bytes) -> str:
    digest = hmac.new(SECRET.encode(), f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _headers(*, body: bytes, timestamp: int = None, bearer: str = BEARER, signature: str = None):
    ts = str(timestamp if timestamp is not None else int(time.time()))
    sig = signature if signature is not None else _sign(ts, body)
    headers = {"X-Timestamp": ts, "X-Signature": sig}
    if bearer is not None:
        headers["Authorization"] = f"Bearer {bearer}"
    return headers


# ─── verify_mediassist_signature ────────────────────────────────────────────


def test_valid_signature_passes(client):
    body = b'{"hello":"world"}'
    resp = client.post("/test-endpoint", content=body, headers=_headers(body=body))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_wrong_bearer_token_rejected(client):
    body = b'{"hello":"world"}'
    resp = client.post(
        "/test-endpoint", content=body, headers=_headers(body=body, bearer="not-the-right-token")
    )
    assert resp.status_code == 401


def test_missing_authorization_header_rejected(client):
    body = b'{"hello":"world"}'
    headers = _headers(body=body, bearer=None)
    resp = client.post("/test-endpoint", content=body, headers=headers)
    assert resp.status_code == 401


def test_tampered_body_rejected(client):
    body = b'{"hello":"world"}'
    # Sign the original body, but send a different one — simulates a MITM
    # or a bug that mutates the body after signing.
    headers = _headers(body=body)
    tampered_body = b'{"hello":"tampered"}'
    resp = client.post("/test-endpoint", content=tampered_body, headers=headers)
    assert resp.status_code == 401


def test_missing_signature_header_rejected(client):
    body = b'{"hello":"world"}'
    headers = _headers(body=body)
    del headers["X-Signature"]
    resp = client.post("/test-endpoint", content=body, headers=headers)
    assert resp.status_code == 401


def test_timestamp_too_old_rejected(client):
    body = b'{"hello":"world"}'
    stale_timestamp = int(time.time()) - 400
    resp = client.post(
        "/test-endpoint", content=body, headers=_headers(body=body, timestamp=stale_timestamp)
    )
    assert resp.status_code == 401


def test_timestamp_too_far_in_future_rejected(client):
    body = b'{"hello":"world"}'
    future_timestamp = int(time.time()) + 400
    resp = client.post(
        "/test-endpoint", content=body, headers=_headers(body=body, timestamp=future_timestamp)
    )
    assert resp.status_code == 401


def test_malformed_timestamp_rejected(client):
    body = b'{"hello":"world"}'
    headers = _headers(body=body)
    headers["X-Timestamp"] = "not-a-number"
    resp = client.post("/test-endpoint", content=body, headers=headers)
    assert resp.status_code == 401


def test_unconfigured_inbound_token_rejects_everything(client, monkeypatch):
    monkeypatch.setattr(settings, "MEDIASSIST_INBOUND_BEARER_TOKEN", "")
    body = b'{"hello":"world"}'
    resp = client.post("/test-endpoint", content=body, headers=_headers(body=body))
    assert resp.status_code == 401


def test_unconfigured_hmac_secret_rejects_even_with_valid_bearer_and_matching_signature(client, monkeypatch):
    """An empty MEDIASSIST_HMAC_SECRET would make hmac.new(b"", ...) sign
    against a publicly-known empty key -- the signature check would "pass"
    for anyone who computes HMAC against "". This must be rejected outright,
    even when the bearer token is correct and the signature was genuinely
    computed against the (empty) configured secret."""
    monkeypatch.setattr(settings, "MEDIASSIST_HMAC_SECRET", "")
    body = b'{"hello":"world"}'
    ts = str(int(time.time()))
    forged_sig = "sha256=" + hmac.new(b"", f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
    resp = client.post(
        "/test-endpoint",
        content=body,
        headers={
            "Authorization": f"Bearer {BEARER}",
            "X-Timestamp": ts,
            "X-Signature": forged_sig,
        },
    )
    assert resp.status_code == 401


# ─── Idempotency cache ──────────────────────────────────────────────────────
#
# Reuses the FakeSupabase/FakeQuery in-memory Supabase stand-in from
# test_sample_lifecycle.py rather than inventing a new fake.

from tests.test_sample_lifecycle import FakeSupabase  # noqa: E402


@pytest.fixture
def fake_supabase(monkeypatch):
    import app.middleware.mediassist_auth as mediassist_auth_mod

    fake = FakeSupabase()
    monkeypatch.setattr(mediassist_auth_mod, "supabase", fake)
    return fake


def test_get_cached_idempotent_response_returns_none_when_absent(fake_supabase):
    assert get_cached_idempotent_response("missing-key", "/endpoint") is None


def test_store_then_get_round_trips(fake_supabase):
    store_idempotent_response(
        "idem-key-1", "/api/v1/integrations/mediassist/callbacks", 202, {"received": True}
    )
    cached = get_cached_idempotent_response("idem-key-1", "/api/v1/integrations/mediassist/callbacks")
    assert cached == {"status_code": 202, "body": {"received": True}}


def test_store_idempotent_response_racing_duplicate_does_not_raise(fake_supabase):
    store_idempotent_response("idem-key-2", "/endpoint", 200, {"a": 1})
    # A second writer racing the first for the same key must not crash the
    # request — the first writer's cached response stays authoritative.
    store_idempotent_response("idem-key-2", "/endpoint", 200, {"a": 1})
    cached = get_cached_idempotent_response("idem-key-2", "/endpoint")
    assert cached == {"status_code": 200, "body": {"a": 1}}


def test_get_cached_idempotent_response_is_scoped_to_endpoint(fake_supabase):
    """`get_cached_idempotent_response`'s query must filter on `endpoint`,
    not just `idempotency_key` — the column is stored on every row but was
    previously never checked on read, so a key reused across two different
    endpoints could return the wrong cached body. (idempotency_key is the
    table's real PRIMARY KEY, so two rows can't naturally share one value in
    production — this seeds the fake store directly to exercise the query's
    own filtering logic regardless of that constraint.)"""
    fake_supabase.db.setdefault("mediassist_inbound_requests", []).append({
        "idempotency_key": "shared-key", "endpoint": "/endpoint-a",
        "status_code": 200, "response_body": {"which": "a"},
    })

    assert get_cached_idempotent_response("shared-key", "/endpoint-a") == {
        "status_code": 200, "body": {"which": "a"},
    }
    assert get_cached_idempotent_response("shared-key", "/endpoint-b") is None


def test_get_cached_idempotent_response_returns_none_when_supabase_unavailable(monkeypatch):
    import app.middleware.mediassist_auth as mediassist_auth_mod

    monkeypatch.setattr(mediassist_auth_mod, "supabase", None)
    assert get_cached_idempotent_response("any-key", "/endpoint") is None


def test_store_idempotent_response_noop_when_supabase_unavailable(monkeypatch):
    import app.middleware.mediassist_auth as mediassist_auth_mod

    monkeypatch.setattr(mediassist_auth_mod, "supabase", None)
    # Must not raise even though there's nowhere to persist to.
    store_idempotent_response("any-key", "/endpoint", 200, {"a": 1})
