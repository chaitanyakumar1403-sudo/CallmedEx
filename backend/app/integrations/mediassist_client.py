"""
MediAssist AI Integration Client — CallMedex's ONLY channel to MediAssist AI.

CallMedex must never implement OCR, AI report summarization, browser
automation, or WhatsApp messaging directly — those are MediAssist AI's
exclusive responsibility. Every such need is expressed as a signed REST
call through this client, matching the contract documented in
docs/integrations/mediassist-ai/mediassist-ai.openapi.yaml.

Provides, for every outbound call:
  - Bearer authentication
  - HMAC-SHA256 request signing (X-Signature / X-Timestamp)
  - Idempotency keys (stable per logical operation, reused across retries)
  - Correlation IDs (propagated to MediAssist and into our own audit log)
  - Retry with exponential backoff (5xx / timeout / connection errors only)
  - A per-endpoint circuit breaker (fails fast once MediAssist is down)
  - Structured logging and a best-effort audit trail entry per call
"""
import asyncio
import hashlib
import hmac
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

from app.config import settings
from app.services.audit import AuditService, AuditActions

logger = logging.getLogger(__name__)


# ─── Exceptions ────────────────────────────────────────────────────────────


class MediAssistError(Exception):
    """Base class for all MediAssist integration failures."""

    def __init__(self, message: str, *, correlation_id: Optional[str] = None):
        super().__init__(message)
        self.correlation_id = correlation_id


class MediAssistUnauthorizedError(MediAssistError):
    """Bearer token or HMAC signature was rejected (401)."""


class MediAssistBadRequestError(MediAssistError):
    """Request was malformed or failed validation (400/422). Not retried."""

    def __init__(self, message: str, *, status_code: int, body: Any = None, correlation_id: Optional[str] = None):
        super().__init__(message, correlation_id=correlation_id)
        self.status_code = status_code
        self.body = body


class MediAssistConflictError(MediAssistError):
    """Idempotency key was reused with a different payload (409). Not retried."""


class MediAssistUnavailableError(MediAssistError):
    """Retries exhausted against 5xx/timeout/connection failures."""


class MediAssistCircuitOpenError(MediAssistUnavailableError):
    """Circuit breaker is open for this endpoint; call was not attempted."""


# ─── Circuit breaker (per client instance, keyed by endpoint) ─────────────


class _CircuitBreaker:
    """Simple three-state breaker: closed -> open -> half_open -> closed."""

    def __init__(self, failure_threshold: int, reset_timeout_seconds: float):
        self._failure_threshold = failure_threshold
        self._reset_timeout_seconds = reset_timeout_seconds
        self._state = "closed"
        self._failure_count = 0
        self._opened_at: Optional[float] = None
        self._lock = asyncio.Lock()

    async def before_call(self, endpoint: str) -> None:
        async with self._lock:
            if self._state == "open":
                elapsed = time.monotonic() - (self._opened_at or 0)
                if elapsed >= self._reset_timeout_seconds:
                    self._state = "half_open"
                else:
                    raise MediAssistCircuitOpenError(
                        f"Circuit open for {endpoint}; retry in "
                        f"{self._reset_timeout_seconds - elapsed:.0f}s"
                    )

    async def record_success(self) -> None:
        async with self._lock:
            self._failure_count = 0
            self._state = "closed"
            self._opened_at = None

    async def record_failure(self) -> None:
        async with self._lock:
            self._failure_count += 1
            if self._state == "half_open" or self._failure_count >= self._failure_threshold:
                self._state = "open"
                self._opened_at = time.monotonic()


# Errors that are transient — safe to retry. Everything else (4xx) is a
# contract violation and must surface immediately instead of being retried.
_RETRYABLE_EXCEPTIONS = (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError)


class MediAssistClient:
    """Shared client for all CallMedex -> MediAssist AI calls."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        bearer_token: Optional[str] = None,
        hmac_secret: Optional[str] = None,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ):
        self._base_url = (base_url if base_url is not None else settings.MEDIASSIST_BASE_URL).rstrip("/")
        self._bearer_token = bearer_token if bearer_token is not None else settings.MEDIASSIST_BEARER_TOKEN
        self._hmac_secret = hmac_secret if hmac_secret is not None else settings.MEDIASSIST_HMAC_SECRET
        # Injectable for tests (httpx.MockTransport); None means real network in production.
        self._transport = transport
        self._breakers: Dict[str, _CircuitBreaker] = {}

    # ─── Public API — mirrors mediassist-ai.openapi.yaml ──────────────────

    async def submit_report_job(
        self,
        *,
        source_type: str,
        source_document_url: str,
        patient: Dict[str, Any],
        delivery: Dict[str, Any],
        booking_id: Optional[str] = None,
        sample_id: Optional[str] = None,
        processing_center_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        correlation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        body = {
            "source_type": source_type,
            "source_document_url": source_document_url,
            "booking_id": booking_id,
            "sample_id": sample_id,
            "processing_center_id": processing_center_id,
            "patient": patient,
            "delivery": delivery,
            "callback_base_url": f"{settings.CALLMEDEX_PUBLIC_BASE_URL}/api/v1/integrations/mediassist/callbacks",
        }
        return await self._request(
            "POST",
            "/api/v1/report-jobs",
            json_body=body,
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
            audit_action=AuditActions.MEDIASSIST_REPORT_JOB_SUBMITTED,
            audit_entity_type="report_job",
        )

    async def get_report_job_status(
        self, report_job_id: str, *, correlation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        return await self._request(
            "GET",
            f"/api/v1/report-jobs/{report_job_id}",
            correlation_id=correlation_id,
            audit_action=None,  # read-only poll, not a state-changing action
        )

    async def send_notification(
        self,
        *,
        channel: str,
        recipient: Dict[str, Any],
        template: str,
        template_data: Dict[str, Any],
        idempotency_key: Optional[str] = None,
        correlation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        body = {
            "channel": channel,
            "recipient": recipient,
            "template": template,
            "template_data": template_data,
            "callback_base_url": f"{settings.CALLMEDEX_PUBLIC_BASE_URL}/api/v1/integrations/mediassist/callbacks",
        }
        return await self._request(
            "POST",
            "/api/v1/notifications",
            json_body=body,
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
            audit_action=AuditActions.MEDIASSIST_NOTIFICATION_REQUESTED,
            audit_entity_type="notification",
        )

    # ─── Core request machinery ────────────────────────────────────────────

    def _breaker_for(self, endpoint_key: str) -> _CircuitBreaker:
        if endpoint_key not in self._breakers:
            self._breakers[endpoint_key] = _CircuitBreaker(
                failure_threshold=settings.MEDIASSIST_CIRCUIT_FAILURE_THRESHOLD,
                reset_timeout_seconds=settings.MEDIASSIST_CIRCUIT_RESET_SECONDS,
            )
        return self._breakers[endpoint_key]

    def _sign(self, timestamp: str, raw_body: bytes) -> str:
        message = timestamp.encode() + b"." + raw_body
        digest = hmac.new(self._hmac_secret.encode(), message, hashlib.sha256).hexdigest()
        return f"sha256={digest}"

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: Optional[Dict[str, Any]] = None,
        idempotency_key: Optional[str] = None,
        correlation_id: Optional[str] = None,
        audit_action: Optional[str] = None,
        audit_entity_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        idempotency_key = idempotency_key or str(uuid.uuid4())
        correlation_id = correlation_id or str(uuid.uuid4())
        endpoint_key = f"{method} {path}"
        breaker = self._breaker_for(endpoint_key)

        import json as _json

        raw_body = _json.dumps(json_body or {}, separators=(",", ":"), sort_keys=True).encode()
        url = f"{self._base_url}{path}"

        max_attempts = max(1, settings.MEDIASSIST_MAX_RETRIES)
        last_exc: Optional[Exception] = None

        for attempt in range(1, max_attempts + 1):
            started = time.monotonic()
            try:
                await breaker.before_call(endpoint_key)
            except MediAssistCircuitOpenError:
                self._audit(audit_action, audit_entity_type, correlation_id, idempotency_key, "circuit_open")
                raise

            timestamp = str(int(time.time()))
            headers = {
                "Authorization": f"Bearer {self._bearer_token}",
                "X-Timestamp": timestamp,
                "X-Signature": self._sign(timestamp, raw_body),
                "X-Idempotency-Key": idempotency_key,
                "X-Correlation-Id": correlation_id,
                "Content-Type": "application/json",
            }

            try:
                timeout = httpx.Timeout(
                    settings.MEDIASSIST_TOTAL_TIMEOUT_SECONDS,
                    connect=settings.MEDIASSIST_CONNECT_TIMEOUT_SECONDS,
                )
                async with httpx.AsyncClient(timeout=timeout, transport=self._transport) as client:
                    response = await client.request(method, url, content=raw_body, headers=headers)

                latency_ms = round((time.monotonic() - started) * 1000, 1)

                if response.status_code in (200, 201, 202):
                    await breaker.record_success()
                    self._log(method, path, attempt, response.status_code, latency_ms, correlation_id, idempotency_key, "success")
                    self._audit(audit_action, audit_entity_type, correlation_id, idempotency_key, "success")
                    return response.json() if response.content else {}

                if response.status_code == 401:
                    self._log(method, path, attempt, response.status_code, latency_ms, correlation_id, idempotency_key, "unauthorized")
                    self._audit(audit_action, audit_entity_type, correlation_id, idempotency_key, "unauthorized")
                    raise MediAssistUnauthorizedError(
                        f"MediAssist rejected credentials for {endpoint_key}", correlation_id=correlation_id
                    )

                if response.status_code == 409:
                    self._log(method, path, attempt, response.status_code, latency_ms, correlation_id, idempotency_key, "conflict")
                    self._audit(audit_action, audit_entity_type, correlation_id, idempotency_key, "conflict")
                    raise MediAssistConflictError(
                        f"Idempotency key {idempotency_key} reused with a different payload",
                        correlation_id=correlation_id,
                    )

                if 400 <= response.status_code < 500:
                    self._log(method, path, attempt, response.status_code, latency_ms, correlation_id, idempotency_key, "bad_request")
                    self._audit(audit_action, audit_entity_type, correlation_id, idempotency_key, "bad_request")
                    raise MediAssistBadRequestError(
                        f"MediAssist rejected {endpoint_key} with {response.status_code}",
                        status_code=response.status_code,
                        body=response.text,
                        correlation_id=correlation_id,
                    )

                # 5xx — transient, retry.
                last_exc = MediAssistUnavailableError(
                    f"MediAssist returned {response.status_code} for {endpoint_key}", correlation_id=correlation_id
                )
                await breaker.record_failure()
                self._log(method, path, attempt, response.status_code, latency_ms, correlation_id, idempotency_key, "server_error_retrying")

            except _RETRYABLE_EXCEPTIONS as exc:
                latency_ms = round((time.monotonic() - started) * 1000, 1)
                last_exc = exc
                await breaker.record_failure()
                self._log(method, path, attempt, None, latency_ms, correlation_id, idempotency_key, f"transient_error:{exc.__class__.__name__}")

            if attempt < max_attempts:
                backoff_seconds = min(2 ** (attempt - 1), 16)
                await asyncio.sleep(backoff_seconds)

        self._audit(audit_action, audit_entity_type, correlation_id, idempotency_key, "exhausted_retries")
        raise MediAssistUnavailableError(
            f"MediAssist unavailable for {endpoint_key} after {max_attempts} attempts: {last_exc}",
            correlation_id=correlation_id,
        )

    @staticmethod
    def _log(method, path, attempt, status_code, latency_ms, correlation_id, idempotency_key, outcome) -> None:
        logger.info(
            "mediassist_client | %s %s | attempt=%d status=%s latency_ms=%s "
            "correlation_id=%s idempotency_key=%s outcome=%s",
            method, path, attempt, status_code, latency_ms, correlation_id, idempotency_key, outcome,
        )

    @staticmethod
    def _audit(action, entity_type, correlation_id, idempotency_key, outcome) -> None:
        if not action:
            return
        try:
            AuditService.log(
                action=action,
                entity_type=entity_type or "mediassist_call",
                entity_id=correlation_id,
                actor_id=None,
                details={
                    "idempotency_key": idempotency_key,
                    "outcome": outcome,
                    "requested_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        except Exception as exc:  # audit failures must never break the integration call
            logger.error("mediassist_client audit log failed: %s", exc)


# Module-level singleton, matching the rest of the codebase's service pattern.
mediassist_client = MediAssistClient()
