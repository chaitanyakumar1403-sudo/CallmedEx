"""
MediAssist AI Integration — Inbound routes.

The 7 routes MediAssist AI calls back into CallMedex, matching the contract in
docs/integrations/mediassist-ai/callmedex-integration.openapi.yaml exactly
(response/error shapes, status codes, header names). These are NOT internal
CallMedex API endpoints — a different service depends on this exact wire
format, so responses here are flat dicts matching the OpenAPI schemas, not
the internal `APIResponse` envelope used elsewhere in this codebase.

Every route sits behind `verify_mediassist_signature` (Task 2) and every
POST route is idempotency-cached on `X-Idempotency-Key` (also Task 2) so a
redelivered callback replays the original response instead of re-applying
side effects. `GET /patients/lookup` is read-only and skips the idempotency
cache (safe to repeat by nature) but still requires the signature.

IMPORTANT: `app/middleware/security.py`'s SecurityMiddleware re-serializes
every JSON POST/PUT/PATCH body (json.loads -> sanitize -> json.dumps) before
any route or dependency ever sees it. That re-serialization almost never
reproduces MediAssist's original raw bytes, which would break
`verify_mediassist_signature`'s HMAC check on every real request. This
router's prefix has been added to `SecurityMiddleware.SKIP_SANITIZE_PATHS` —
see that file's comment — so this integration was not silently broken from
day one.
"""
import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.mediassist_auth import (
    get_cached_idempotent_response,
    store_idempotent_response,
    verify_mediassist_signature,
)
from app.models.schemas import ServiceType
from app.services.audit import AuditActions, AuditService
from app.utils.db_helpers import _rows
from app.utils.phone import normalize_phone
from app.utils.security import hash_password

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/integrations/mediassist",
    tags=["MediAssist AI Integration — Inbound"],
    dependencies=[Depends(verify_mediassist_signature)],
)


# ─── Request/response schemas (mirrors callmedex-integration.openapi.yaml) ──
# Not shared with any other module — this is the one place CallMedex's side
# of this specific external contract lives.

class ReportCallback(BaseModel):
    report_job_id: str
    occurred_at: datetime


class AbnormalFlag(BaseModel):
    marker: Optional[str] = None
    value: Optional[str] = None
    status: Optional[Literal["normal", "high", "low", "critical"]] = None
    reference_range: Optional[str] = None


class ReportAnalysisPayload(BaseModel):
    plain_language_summary: str
    doctor_clinical_summary: str
    health_score: Optional[int] = None
    abnormal_flags: List[AbnormalFlag] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)


class ReportDeliveredCallback(ReportCallback):
    delivered_channel: Literal["whatsapp"]
    message_id: Optional[str] = None
    analysis: ReportAnalysisPayload


class ReportFailedCallback(ReportCallback):
    failure_reason: Literal[
        "ocr_failed", "interpretation_failed", "delivery_failed", "invalid_source_document",
        # Mode 2 (MocDoc connector automated download) failure reasons.
        "report_not_ready_timeout", "bill_payment_pending", "download_automation_failed",
    ]
    details: Optional[str] = None


class NotificationStatusCallback(BaseModel):
    notification_id: str
    status: Literal["delivered", "failed"]
    failure_reason: Optional[str] = None
    occurred_at: datetime


class BookingAddress(BaseModel):
    line1: str
    city: str
    pincode: str
    lat: float
    lng: float


class TimeWindow(BaseModel):
    earliest: datetime
    latest: datetime


class WhatsappBookingRequest(BaseModel):
    patient_id: Optional[str] = None
    phone: str
    service_type: Literal["home_blood_collection", "home_nursing_visit", "pharmacy_order", "video_consultation"]
    requested_time_window: TimeWindow
    address: BookingAddress
    source: Literal["whatsapp"]
    source_conversation_id: str


# Maps the WhatsappBookingRequest.service_type wire enum onto this codebase's
# own ServiceType enum (see backend/app/models/schemas.py, same values
# bookings.py::create_booking writes to bookings.service_type).
_SERVICE_TYPE_MAP = {
    "home_blood_collection": ServiceType.HOME_COLLECTION,
    "home_nursing_visit": ServiceType.NURSE_VISIT,
    "pharmacy_order": ServiceType.PHARMACY_DELIVERY,
    "video_consultation": ServiceType.VIDEO_CONSULT,
}


# ─── Shared helpers ─────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _error_body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def _idempotent_or(idem_key: str, endpoint: str) -> Optional[JSONResponse]:
    """Short-circuit helper: returns the cached response if this idempotency
    key was already processed for this endpoint, else None. Every POST route
    below calls this first, before doing any work."""
    cached = get_cached_idempotent_response(idem_key, endpoint)
    if cached:
        return JSONResponse(status_code=cached["status_code"], content=cached["body"])
    return None


def _store_and_respond(idem_key: str, endpoint: str, status_code: int, body: dict) -> JSONResponse:
    """Persists `body` under `idem_key` for future replays, then returns it."""
    store_idempotent_response(idem_key, endpoint, status_code, body)
    return JSONResponse(status_code=status_code, content=body)


def _phone_lookup_variants(phone: str) -> List[str]:
    """A handful of plausible `users.mobile` storage formats for `phone`,
    used only as a fallback query after an exact match misses.

    Real `users.mobile` values are stored inconsistently (bare 10-digit,
    E.164 with "+91", "91"-prefixed, or spaced) because signup never
    enforced a format. MediAssist always sends E.164. Rather than a
    full-table scan (not viable at scale), we generate the small, well-known
    set of alternate formats an Indian mobile number might be stored under
    and issue one indexed `.eq("mobile", ...)` query per variant.
    """
    normalized = normalize_phone(phone)
    if not normalized:
        return []
    return list({
        normalized,
        f"+91{normalized}",
        f"91{normalized}",
        f"+91 {normalized[:5]} {normalized[5:]}",
    })


def _find_user_by_phone(select_cols: str, phone: str) -> Optional[dict]:
    """Resolve a `users` (role=patient) row by phone: an exact-match fast
    path first (cheap, indexed, hits the common case), falling back to a
    handful of plausible alternate formats when that misses -- so a phone
    number arriving in a different-but-equivalent format than what's stored
    still resolves to the same patient instead of 404ing and causing
    mediassist_inbound.py::_create_headless_patient to mint a duplicate.
    Scoped to MediAssist-facing lookups only; general signup/auth is
    untouched.
    """
    rows = _rows(
        supabase.table("users").select(select_cols)
        .eq("role", "patient").eq("mobile", phone).limit(1).execute()
    )
    if rows:
        return rows[0]

    for variant in _phone_lookup_variants(phone):
        if variant == phone:
            continue
        rows = _rows(
            supabase.table("users").select(select_cols)
            .eq("role", "patient").eq("mobile", variant).limit(1).execute()
        )
        if rows:
            return rows[0]
    return None


def _get_report_job(report_job_id: str) -> Optional[dict]:
    if not supabase:
        return None
    rows = _rows(
        supabase.table("report_jobs").select("*").eq("id", report_job_id).limit(1).execute()
    )
    return rows[0] if rows else None


def _not_found_report_job(idem_key: str, endpoint: str) -> JSONResponse:
    logger.warning(f"MediAssist callback to {endpoint} referenced an unknown report_job_id.")
    return _store_and_respond(
        idem_key, endpoint, 404,
        _error_body("report_job_not_found", "Unknown report_job_id."),
    )


# ─── 1. Report processing started ──────────────────────────────────────────

@router.post("/callbacks/report-processing")
async def report_processing_callback(
    body: ReportCallback,
    request: Request,
    x_idempotency_key: str = Header(..., alias="X-Idempotency-Key"),
    x_correlation_id: str = Header(..., alias="X-Correlation-Id"),
):
    endpoint = request.url.path
    if (cached := _idempotent_or(x_idempotency_key, endpoint)) is not None:
        return cached

    job = _get_report_job(body.report_job_id)
    if not job:
        return _not_found_report_job(x_idempotency_key, endpoint)

    supabase.table("report_jobs").update({
        "status": "processing",
        "updated_at": _now_iso(),
    }).eq("id", body.report_job_id).execute()

    AuditService.log(
        action=AuditActions.MEDIASSIST_REPORT_JOB_PROCESSING,
        entity_type="report_job",
        entity_id=body.report_job_id,
        details={"occurred_at": body.occurred_at.isoformat(), "correlation_id": x_correlation_id},
    )

    return _store_and_respond(x_idempotency_key, endpoint, 200, {"received": True})


# ─── 1b. Report job accepted by MediAssist worker ─────────────────────────

@router.post("/callbacks/report-accepted")
async def report_accepted_callback(
    body: ReportCallback,
    request: Request,
    x_idempotency_key: str = Header(..., alias="X-Idempotency-Key"),
    x_correlation_id: str = Header(..., alias="X-Correlation-Id"),
):
    endpoint = request.url.path
    if (cached := _idempotent_or(x_idempotency_key, endpoint)) is not None:
        return cached

    job = _get_report_job(body.report_job_id)
    if not job:
        return _not_found_report_job(x_idempotency_key, endpoint)

    supabase.table("report_jobs").update({
        "status": "accepted",
        "updated_at": _now_iso(),
    }).eq("id", body.report_job_id).execute()

    return _store_and_respond(x_idempotency_key, endpoint, 200, {"received": True})


# ─── 2. Report delivered ────────────────────────────────────────────────────

@router.post("/callbacks/report-delivered")
@router.post("/callbacks/report-corrected")
async def report_delivered_callback(
    body: ReportDeliveredCallback,
    request: Request,
    x_idempotency_key: str = Header(..., alias="X-Idempotency-Key"),
    x_correlation_id: str = Header(..., alias="X-Correlation-Id"),
):
    endpoint = request.url.path
    if (cached := _idempotent_or(x_idempotency_key, endpoint)) is not None:
        return cached

    job = _get_report_job(body.report_job_id)
    if not job:
        return _not_found_report_job(x_idempotency_key, endpoint)

    now = _now_iso()
    is_corrected = endpoint.endswith("/report-corrected")
    new_job_status = "corrected" if is_corrected else "delivered"

    supabase.table("report_jobs").update({
        "status": new_job_status,
        "updated_at": now,
    }).eq("id", body.report_job_id).execute()

    analysis = body.analysis
    existing_analyses = _rows(
        supabase.table("ai_report_analyses")
        .select("*").eq("report_job_id", body.report_job_id).execute()
    )

    max_version = 0
    raw_url = job.get("source_document_path") or ""
    if existing_analyses:
        versions = [r.get("report_version", 1) for r in existing_analyses if r.get("report_version") is not None]
        max_version = max(versions) if versions else 1
        raw_url = existing_analyses[0].get("raw_report_url") or raw_url

    new_version = max_version + 1 if existing_analyses else 1
    report_status = "corrected" if (is_corrected or max_version >= 1) else "final"

    analysis_row = {
        "id": str(uuid.uuid4()),
        "patient_id": job["patient_id"],
        "report_job_id": body.report_job_id,
        "raw_report_url": raw_url,
        "plain_language_summary": analysis.plain_language_summary,
        "doctor_clinical_summary": analysis.doctor_clinical_summary,
        "abnormal_flags": [f.model_dump(exclude_none=True) for f in analysis.abnormal_flags],
        "report_version": new_version,
        "report_status": report_status,
        "created_at": now,
    }
    supabase.table("ai_report_analyses").insert(analysis_row).execute()

    AuditService.log(
        action=AuditActions.MEDIASSIST_REPORT_JOB_DELIVERED,
        entity_type="report_job",
        entity_id=body.report_job_id,
        details={
            "occurred_at": body.occurred_at.isoformat(),
            "correlation_id": x_correlation_id,
            "delivered_channel": body.delivered_channel,
            "message_id": body.message_id,
            "report_version": new_version,
            "report_status": report_status,
        },
    )

    return _store_and_respond(x_idempotency_key, endpoint, 200, {"received": True})


# ─── 3. Report failed ───────────────────────────────────────────────────────

@router.post("/callbacks/report-failed")
async def report_failed_callback(
    body: ReportFailedCallback,
    request: Request,
    x_idempotency_key: str = Header(..., alias="X-Idempotency-Key"),
    x_correlation_id: str = Header(..., alias="X-Correlation-Id"),
):
    endpoint = request.url.path
    if (cached := _idempotent_or(x_idempotency_key, endpoint)) is not None:
        return cached

    job = _get_report_job(body.report_job_id)
    if not job:
        return _not_found_report_job(x_idempotency_key, endpoint)

    supabase.table("report_jobs").update({
        "status": "failed",
        "failure_reason": body.failure_reason,
        "updated_at": _now_iso(),
    }).eq("id", body.report_job_id).execute()

    AuditService.log(
        action=AuditActions.MEDIASSIST_REPORT_JOB_FAILED,
        entity_type="report_job",
        entity_id=body.report_job_id,
        details={
            "occurred_at": body.occurred_at.isoformat(),
            "correlation_id": x_correlation_id,
            "failure_reason": body.failure_reason,
            "details": body.details,
        },
    )

    return _store_and_respond(x_idempotency_key, endpoint, 200, {"received": True})


# ─── 4. Report expired (patient unreachable past TTL) ──────────────────────

@router.post("/callbacks/report-expired")
async def report_expired_callback(
    body: ReportCallback,
    request: Request,
    x_idempotency_key: str = Header(..., alias="X-Idempotency-Key"),
    x_correlation_id: str = Header(..., alias="X-Correlation-Id"),
):
    endpoint = request.url.path
    if (cached := _idempotent_or(x_idempotency_key, endpoint)) is not None:
        return cached

    job = _get_report_job(body.report_job_id)
    if not job:
        return _not_found_report_job(x_idempotency_key, endpoint)

    supabase.table("report_jobs").update({
        "status": "expired",
        "updated_at": _now_iso(),
    }).eq("id", body.report_job_id).execute()

    AuditService.log(
        action=AuditActions.MEDIASSIST_REPORT_JOB_EXPIRED,
        entity_type="report_job",
        entity_id=body.report_job_id,
        details={"occurred_at": body.occurred_at.isoformat(), "correlation_id": x_correlation_id},
    )

    return _store_and_respond(x_idempotency_key, endpoint, 200, {"received": True})


# ─── 5. Notification delivery status ───────────────────────────────────────

@router.post("/callbacks/notification-status")
async def notification_status_callback(
    body: NotificationStatusCallback,
    request: Request,
    x_idempotency_key: str = Header(..., alias="X-Idempotency-Key"),
    x_correlation_id: str = Header(..., alias="X-Correlation-Id"),
):
    endpoint = request.url.path
    if (cached := _idempotent_or(x_idempotency_key, endpoint)) is not None:
        return cached

    # CallMedex doesn't persist a `notifications` row per outbound MediAssist
    # notification today — no table to update, this is audit-only.
    #
    # entity_id is NOT set to notification_id: audit_log.entity_id is a UUID
    # column, but NotificationStatusCallback.notification_id is an untyped
    # string per the contract -- MediAssist's real ids may not be UUIDs
    # (e.g. "notif_88213"). Passing a non-UUID there would make the DB
    # insert fail, and AuditService.log only logs-and-swallows insert
    # failures, so this route's entire purpose (durably recording the
    # callback) would silently produce nothing. notification_id is carried
    # in `details` (JSONB, untyped) instead.
    AuditService.log(
        action=AuditActions.MEDIASSIST_NOTIFICATION_STATUS,
        entity_type="notification",
        entity_id=None,
        details={
            "notification_id": body.notification_id,
            "status": body.status,
            "failure_reason": body.failure_reason,
            "occurred_at": body.occurred_at.isoformat(),
            "correlation_id": x_correlation_id,
        },
    )

    return _store_and_respond(x_idempotency_key, endpoint, 200, {"received": True})


# ─── 6. Patient lookup by phone (read-only) ────────────────────────────────

@router.get("/patients/lookup")
async def lookup_patient_by_phone(phone: str = Query(..., description="E.164 format")):
    if not supabase:
        return JSONResponse(
            status_code=404,
            content=_error_body("patient_not_found", "No patient with this phone number."),
        )

    user = _find_user_by_phone("id, address, city, pincode", phone)
    if not user:
        return JSONResponse(
            status_code=404,
            content=_error_body("patient_not_found", "No patient with this phone number."),
        )

    patient_id = user["id"]

    profile_rows = _rows(
        supabase.table("patients").select("preferred_language")
        .eq("user_id", patient_id).limit(1).execute()
    )
    preferred_language = (profile_rows[0].get("preferred_language") if profile_rows else None) or "en"

    default_address = None
    if user.get("address") or user.get("city") or user.get("pincode"):
        default_address = {
            "line1": user.get("address") or "",
            "city": user.get("city") or "",
            "pincode": user.get("pincode") or "",
            # `users` has no lat/lng columns (only family_members/bookings do) —
            # left null rather than fabricated; PatientLookupResult.default_address
            # does not require them.
            "lat": None,
            "lng": None,
        }

    return {
        "patient_id": patient_id,
        "preferred_language": preferred_language,
        "default_address": default_address,
    }


# ─── 7. WhatsApp-originated booking ────────────────────────────────────────

def _find_patient_id_by_phone(phone: str) -> Optional[str]:
    user = _find_user_by_phone("id", phone)
    return user["id"] if user else None


def _patient_exists(patient_id: str) -> bool:
    rows = _rows(
        supabase.table("users").select("id")
        .eq("id", patient_id).eq("role", "patient").limit(1).execute()
    )
    return bool(rows)


def _create_headless_patient(phone: str, address: BookingAddress) -> str:
    """Create a minimal patients/users row for a WhatsApp-originated booking
    with no prior CallMedex account.

    Distinct from auth.py's `/signup` flow (see backend/app/routers/auth.py):
    there is no password, no email the patient chose, no MOU — the patient
    never touched the website. A random, never-communicated password hash is
    stored so the row satisfies `users.password_hash NOT NULL` while the
    account itself is unusable for login until the patient goes through the
    normal forgot-password flow.
    """
    user_id = str(uuid.uuid4())
    now = _now_iso()
    sanitized_phone = "".join(ch for ch in phone if ch.isalnum()) or user_id
    users_row = {
        "id": user_id,
        "full_name": "WhatsApp Patient",
        # `email` is UNIQUE NOT NULL on `users`; synthesize one scoped to the
        # phone number rather than leaving it blank.
        "email": f"whatsapp+{sanitized_phone}@patients.callmedex.internal",
        "mobile": phone,
        "password_hash": hash_password(secrets.token_urlsafe(32)),
        "role": "patient",
        "address": address.line1,
        "city": address.city,
        "pincode": address.pincode,
        "registration_status": "active",
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    supabase.table("users").insert(users_row).execute()

    supabase.table("patients").insert({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "preferred_language": "en",
        "consent_status": "pending",
    }).execute()

    logger.info(f"Created headless patient {user_id} from a WhatsApp-originated booking (phone {phone}).")
    return user_id


@router.post("/whatsapp-bookings", status_code=201)
async def create_whatsapp_booking(
    body: WhatsappBookingRequest,
    request: Request,
    x_idempotency_key: str = Header(..., alias="X-Idempotency-Key"),
    x_correlation_id: str = Header(..., alias="X-Correlation-Id"),
):
    endpoint = request.url.path
    if (cached := _idempotent_or(x_idempotency_key, endpoint)) is not None:
        return cached

    if not supabase:
        return _store_and_respond(
            x_idempotency_key, endpoint, 404,
            _error_body(
                "patient_not_found",
                "patient_id not found and phone does not resolve to an existing patient.",
            ),
        )

    # Resolve patient_id: an explicitly-given patient_id is a stronger claim
    # than a bare phone number, so if it doesn't resolve we fall back to the
    # phone lookup rather than trusting it blindly — but we still 404 (per
    # the OpenAPI contract) instead of silently creating a possibly-duplicate
    # patient when MediAssist asserted an id that turned out to be wrong.
    # Only when no patient_id was given at all do we self-heal by creating a
    # new headless patient, matching "Omit if unknown — CallMedex
    # resolves/creates from phone" in WhatsappBookingRequest.patient_id.
    patient_id_was_given = bool(body.patient_id)
    resolved_patient_id: Optional[str] = None

    if body.patient_id and _patient_exists(body.patient_id):
        resolved_patient_id = body.patient_id
    else:
        resolved_patient_id = _find_patient_id_by_phone(body.phone)

    if not resolved_patient_id:
        if patient_id_was_given:
            return _store_and_respond(
                x_idempotency_key, endpoint, 404,
                _error_body(
                    "patient_not_found",
                    "patient_id not found and phone does not resolve to an existing patient.",
                ),
            )
        resolved_patient_id = _create_headless_patient(body.phone, body.address)

    service_type = _SERVICE_TYPE_MAP[body.service_type]
    is_home_collection = body.service_type == "home_blood_collection"
    db_status = "confirmed" if is_home_collection else "pending_review"

    booking_id = str(uuid.uuid4())
    now = _now_iso()
    booking_data = {
        "id": booking_id,
        "patient_id": resolved_patient_id,
        # `provider_id`/`provider_type` are NOT NULL on `bookings`. Resolving a
        # *real* provider means the processing-center assignment / phlebotomist
        # dispatch pipeline (assign_booking / UniversalDispatchEngine.create_dispatch
        # in bookings.py::create_booking) — explicitly out of scope for this
        # route per the task brief: this route creates the booking row only.
        # Using the booking's own id as provider_id keeps the row valid and
        # makes an unassigned booking trivially identifiable (provider_id == id)
        # without fabricating a fake provider identity.
        "provider_id": booking_id,
        "provider_type": "unassigned",
        "service_type": service_type.value,
        "status": db_status,
        "notes": f"WhatsApp booking via MediAssist (conversation {body.source_conversation_id}).",
        "slot_start": body.requested_time_window.earliest.isoformat(),
        "slot_end": body.requested_time_window.latest.isoformat(),
        "collection_city": body.address.city,
        "collection_pincode": body.address.pincode,
        "collection_lat": body.address.lat,
        "collection_lng": body.address.lng,
        "created_at": now,
        "updated_at": now,
    }
    if is_home_collection:
        booking_data["booking_kind"] = "home_collection"

    supabase.table("bookings").insert(booking_data).execute()

    AuditService.log(
        action=AuditActions.MEDIASSIST_WHATSAPP_BOOKING_CREATED,
        entity_type="booking",
        entity_id=booking_id,
        actor_id=resolved_patient_id,
        details={
            "service_type": body.service_type,
            "source_conversation_id": body.source_conversation_id,
            "correlation_id": x_correlation_id,
        },
    )

    response_status = "confirmed" if db_status == "confirmed" else "pending_slot_assignment"
    return _store_and_respond(
        x_idempotency_key, endpoint, 201,
        {"booking_id": booking_id, "status": response_status},
    )
