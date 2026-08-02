"""
MediAssist inbound request verification + idempotency cache.

Every route MediAssist AI calls back into CallMedex (report-job callbacks,
notification-delivery callbacks, etc. — wired up in Task 3) must first prove
the request genuinely came from MediAssist before anything else runs. This
module is that proof, plus the idempotency cache backing
`mediassist_inbound_requests` so a redelivered callback replays the original
response instead of re-applying side effects.

The HMAC scheme here mirrors `MediAssistClient._sign` in
app/integrations/mediassist_client.py for POST bodies — both directions
share one secret, `settings.MEDIASSIST_HMAC_SECRET`, so a divergence here
would silently break inbound verification without ever touching the
outbound path. For GET requests (only `GET /patients/lookup` today), the
signed message additionally includes the raw query string before the
(empty) body, since MediAssistClient never signs a GET with query params
and has no equivalent to diverge from.
"""
import hashlib
import hmac
import logging
import time
from typing import Optional

from fastapi import HTTPException, Request

from app.config import settings
from app.database import supabase

logger = logging.getLogger(__name__)

# How far X-Timestamp may drift from server time before a request is
# rejected as stale/replayed, in either direction.
_MAX_TIMESTAMP_SKEW_SECONDS = 300


async def verify_mediassist_signature(request: Request) -> None:
    """FastAPI dependency: verifies Authorization bearer token, X-Timestamp
    freshness, and X-Signature HMAC over the raw request body. Raises
    HTTPException(401) on any failure. Raises nothing (returns None) on
    success. Route handlers still need to check X-Idempotency-Key
    themselves via get_cached_idempotent_response/store_idempotent_response
    — this dependency only proves the request is authentically from
    MediAssist, it does not deduplicate."""
    expected_token = settings.MEDIASSIST_INBOUND_BEARER_TOKEN
    if not expected_token:
        raise HTTPException(status_code=401, detail="Inbound MediAssist auth is not configured.")

    if not settings.MEDIASSIST_HMAC_SECRET:
        # An empty secret would make hmac.new() sign/verify against a
        # trivially-forgeable, publicly-known key (""), so the signature
        # check would "pass" for anyone. Fail closed instead of falling
        # through to a comparison that can never meaningfully fail.
        raise HTTPException(status_code=401, detail="Inbound MediAssist HMAC secret is not configured.")

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")
    token = auth_header[len("Bearer "):]
    if not hmac.compare_digest(token, expected_token):
        raise HTTPException(status_code=401, detail="Invalid bearer token.")

    timestamp_header = request.headers.get("X-Timestamp")
    if not timestamp_header:
        raise HTTPException(status_code=401, detail="Missing X-Timestamp header.")
    try:
        timestamp = int(timestamp_header)
    except ValueError:
        raise HTTPException(status_code=401, detail="Malformed X-Timestamp header.")
    if abs(time.time() - timestamp) > _MAX_TIMESTAMP_SKEW_SECONDS:
        raise HTTPException(status_code=401, detail="X-Timestamp is outside the allowed freshness window.")

    signature_header = request.headers.get("X-Signature")
    if not signature_header or not signature_header.startswith("sha256="):
        raise HTTPException(status_code=401, detail="Missing or malformed X-Signature header.")
    provided_digest = signature_header[len("sha256="):]

    # Starlette caches the raw body the first time it's read, so the route
    # handler's own Pydantic body parsing afterward reads these same cached
    # bytes rather than re-hitting the network stream.
    body = await request.body()
    # For a GET request, `body` is empty, so the query string is the only
    # thing distinguishing one request from another (e.g. ?phone=...). If it
    # isn't part of the signed message, anyone who captures one valid signed
    # GET (proxy logs, APM traces) can replay it with a different query
    # string within the 300s freshness window and enumerate the patient
    # directory. Signing `timestamp + "." + query_string + body` closes
    # that: for POST routes with no query string this is a no-op change
    # since `request.url.query` is "".
    expected_digest = hmac.new(
        settings.MEDIASSIST_HMAC_SECRET.encode(),
        f"{timestamp_header}.".encode() + request.url.query.encode() + body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(provided_digest, expected_digest):
        raise HTTPException(status_code=401, detail="Signature verification failed.")


def get_cached_idempotent_response(idempotency_key: str, endpoint: str) -> Optional[dict]:
    """Returns {"status_code": int, "body": dict} if this key was already
    processed FOR THIS ENDPOINT, else None. Reads mediassist_inbound_requests.

    Filtering by endpoint (not just idempotency_key) matters because
    `endpoint` is stored on every row but was previously never checked on
    read: a key reused across two different endpoints would otherwise
    return whichever endpoint's cached body happened to be stored first."""
    if not supabase:
        return None
    try:
        result = (
            supabase.table("mediassist_inbound_requests")
            .select("status_code, response_body")
            .eq("idempotency_key", idempotency_key)
            .eq("endpoint", endpoint)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.error(f"mediassist idempotency lookup failed for key={idempotency_key}: {e}")
        return None

    rows = getattr(result, "data", None) or []
    if not rows:
        return None
    row = rows[0]
    return {"status_code": row["status_code"], "body": row["response_body"]}


def store_idempotent_response(idempotency_key: str, endpoint: str, status_code: int, body: dict) -> None:
    """Persists the response for future replays of this key. Insert, not
    upsert — a second call with the same key racing the first is expected
    to occasionally raise a unique-constraint error; that's caught and
    logged rather than crashing, since the first writer's cached response
    is authoritative."""
    if not supabase:
        return
    try:
        supabase.table("mediassist_inbound_requests").insert({
            "idempotency_key": idempotency_key,
            "endpoint": endpoint,
            "status_code": status_code,
            "response_body": body,
        }).execute()
    except Exception as e:
        if "23505" in str(e) or "duplicate key" in str(e).lower():
            logger.info(f"mediassist idempotency key {idempotency_key} already cached by a racing writer.")
        else:
            logger.error(f"mediassist idempotency store failed for key={idempotency_key}: {e}")
