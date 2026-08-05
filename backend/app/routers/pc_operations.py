"""
Processing Centre operations — Spec 2 write paths.

The read-only centre endpoints (GET /api/pc/me, GET /api/pc/home-services) live
in processing_center_admin.py and home_services.py. This module adds the WRITE
paths that Spec 2's dashboard consumes:

    Queue tiles   →  GET  /api/pc/queue
    Sample list   →  GET  /api/pc/samples
    Receive       →  POST /api/pc/samples/{id}/receive
    5-point verify→  POST /api/pc/samples/{id}/verify
    Reject        →  POST /api/pc/samples/{id}/reject
    Batch CRUD    →  POST /api/pc/batches  (+ add-sample, seal, send)
    Roster summary→  GET  /api/pc/roster-summary

Every endpoint is scoped through get_current_pc_staff — the centre id comes
from the JWT, never from the request URL or body.
"""
import logging
import uuid
from datetime import datetime, date, timedelta, timezone
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.pc_auth import get_current_pc_staff, require_pc_admin
from app.models.schemas import ConnectorType
from app.services.processing_center import create_canonical_report_job_for_sample
from app.services.report_submission import submit_report_job_to_mediassist
from app.services.samples import validate_sample_transition
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pc", tags=["Processing Center Operations"])

REJECTION_CODES = {
    "wrong_tube", "barcode_missing", "label_missing", "broken_tube",
    "leaking_tube", "hemolyzed", "insufficient_sample", "other",
}


def _first(result) -> dict:
    rows = _rows(result)
    return rows[0] if rows else {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log_event(
    sample_id: str, event: str, actor_id: str,
    processing_center_id: str, notes: str = "",
) -> None:
    """Append to the immutable custody log. Raises on failure to guarantee custody integrity."""
    if not supabase:
        return
    supabase.table("sample_events").insert({
        "id": str(uuid.uuid4()),
        "sample_id": sample_id,
        "event": event,
        "actor_id": actor_id,
        "actor_role": "processing_center",
        "processing_center_id": processing_center_id,
        "location_label": "processing centre intake desk",
        "notes": notes,
        "created_at": _now_iso(),
    }).execute()


# ─── Queue tiles ──────────────────────────────────────────────────────────

@router.get("/queue")
async def queue_summary(staff: dict = Depends(get_current_pc_staff)):
    """Capacity & queue tiles for the dashboard.

    Returns today's and tomorrow's expected booking volumes with tube counts
    by type, so the centre knows what is coming before the courier arrives.
    """
    centre_id = staff["processing_center_id"]
    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    # All samples for this centre
    all_samples = _rows(
        supabase.table("samples")
        .select("id, status, expected_tube_type_code, booking_id, created_at")
        .eq("processing_center_id", centre_id)
        .execute()
    )

    # Centre info for capacity
    centre_row = _first(
        supabase.table("processing_centers")
        .select("daily_capacity, code, name")
        .eq("id", centre_id)
        .limit(1)
        .execute()
    )

    # Tube type reference for display names
    tube_types = _rows(
        supabase.table("tube_types")
        .select("code, name, cap_colour")
        .eq("is_active", True)
        .execute()
    )
    tube_map = {t["code"]: t for t in tube_types}

    # Pending collection (tomorrow's expected)
    pending = [s for s in all_samples if s.get("status") == "pending_collection"]
    # Samples awaiting verification (received but not verified)
    received = [s for s in all_samples if s.get("status") == "received"]
    # Already verified today
    verified = [s for s in all_samples if s.get("status") == "verified"]
    # Rejected
    rejected = [s for s in all_samples if s.get("status") == "rejected"]

    # Tube breakdown for pending samples
    tube_counts: Dict[str, int] = {}
    for s in pending:
        code = s.get("expected_tube_type_code") or "unknown"
        tube_counts[code] = tube_counts.get(code, 0) + 1

    tube_breakdown = []
    for code, count in sorted(tube_counts.items(), key=lambda x: -x[1]):
        info = tube_map.get(code, {})
        tube_breakdown.append({
            "tube_type_code": code,
            "name": info.get("name", code),
            "cap_colour": info.get("cap_colour", ""),
            "count": count,
        })

    return {
        "centre_code": centre_row.get("code", ""),
        "centre_name": centre_row.get("name", ""),
        "daily_capacity": centre_row.get("daily_capacity", 0),
        "pending_collection": len(pending),
        "awaiting_verification": len(received),
        "verified_today": len(verified),
        "rejected_today": len(rejected),
        "total_samples": len(all_samples),
        "tube_breakdown": tube_breakdown,
    }


# ─── Sample list ──────────────────────────────────────────────────────────

@router.get("/samples")
async def list_samples(
    status: Optional[str] = Query(default=None),
    staff: dict = Depends(get_current_pc_staff),
):
    """All samples for this centre, filterable by status."""
    centre_id = staff["processing_center_id"]
    query = (
        supabase.table("samples")
        .select("*")
        .eq("processing_center_id", centre_id)
        .order("created_at", desc=True)
    )
    if status:
        statuses = [s.strip() for s in status.split(",")]
        query = query.in_("status", statuses)

    samples = _rows(query.limit(500).execute())

    # Enrich with booking subject names
    subject_ids = list({s.get("booking_subject_id") for s in samples
                        if s.get("booking_subject_id")})
    subject_map: Dict[str, dict] = {}
    if subject_ids:
        subjects = _rows(
            supabase.table("booking_subjects")
            .select("id, family_member_id")
            .in_("id", subject_ids)
            .execute()
        )
        fm_ids = list({s["family_member_id"] for s in subjects
                       if s.get("family_member_id")})
        fm_map: Dict[str, str] = {}
        if fm_ids:
            members = _rows(
                supabase.table("family_members")
                .select("id, full_name, relationship")
                .in_("id", fm_ids)
                .execute()
            )
            fm_map = {m["id"]: m for m in members}
        for s in subjects:
            fm = fm_map.get(s.get("family_member_id", ""), {})
            subject_map[s["id"]] = {
                "subject_name": fm.get("full_name", ""),
                "relationship": fm.get("relationship", ""),
            }

    # Enrich with tube type info
    tube_types = _rows(
        supabase.table("tube_types")
        .select("code, name, cap_colour")
        .eq("is_active", True)
        .execute()
    )
    tube_map = {t["code"]: t for t in tube_types}

    for s in samples:
        sub = subject_map.get(s.get("booking_subject_id", ""), {})
        s["subject_name"] = sub.get("subject_name", "")
        s["subject_relationship"] = sub.get("relationship", "")
        expected = s.get("expected_tube_type_code", "")
        tube_info = tube_map.get(expected, {})
        s["expected_tube_name"] = tube_info.get("name", expected)
        s["expected_cap_colour"] = tube_info.get("cap_colour", "")

    return {"samples": samples, "count": len(samples)}


# ─── By-barcode lookup ─────────────────────────────────────────────────────

@router.get("/samples/by-barcode/{barcode}")
async def get_sample_by_barcode(
    barcode: str,
    staff: dict = Depends(get_current_pc_staff),
):
    """Resolve a scanned barcode to a sample at this centre.

    Returns the sample ONLY if it belongs to the caller's processing centre.
    404 otherwise — no cross-centre leakage.
    Includes patient name via users join.
    """
    centre_id = staff["processing_center_id"]

    rows = _rows(
        supabase.table("samples")
        .select("*")
        .eq("barcode", barcode.strip().upper())
        .eq("processing_center_id", centre_id)
        .limit(1)
        .execute()
    )
    if not rows:
        raise HTTPException(404, "Sample not found at this centre.")

    sample = rows[0]

    # Enrich with patient name
    patient_name = ""
    patient_id = sample.get("patient_id")
    if patient_id:
        user = _first(
            supabase.table("users")
            .select("full_name")
            .eq("id", patient_id)
            .limit(1)
            .execute()
        )
        patient_name = user.get("full_name", "")

    # Enrich with tube type info
    tube_types = _rows(
        supabase.table("tube_types")
        .select("code, name, cap_colour")
        .eq("is_active", True)
        .execute()
    )
    tube_map = {t["code"]: t for t in tube_types}
    expected = sample.get("expected_tube_type_code", "")
    tube_info = tube_map.get(expected, {})

    # Enrich with subject name
    subject_name = ""
    subject_id = sample.get("booking_subject_id")
    if subject_id:
        subjects = _rows(
            supabase.table("booking_subjects")
            .select("id, family_member_id")
            .eq("id", subject_id)
            .limit(1)
            .execute()
        )
        if subjects:
            fm_id = subjects[0].get("family_member_id")
            if fm_id:
                member = _first(
                    supabase.table("family_members")
                    .select("full_name, relationship")
                    .eq("id", fm_id)
                    .limit(1)
                    .execute()
                )
                subject_name = member.get("full_name", "")

    return {
        "id": sample["id"],
        "barcode": sample.get("barcode", ""),
        "status": sample.get("status", ""),
        "test_names": sample.get("test_names", []),
        "tube_type_code": sample.get("tube_type_code", ""),
        "expected_tube_type_code": expected,
        "expected_tube_name": tube_info.get("name", expected),
        "expected_cap_colour": tube_info.get("cap_colour", ""),
        "patient_name": patient_name,
        "subject_name": subject_name,
        "booking_id": sample.get("booking_id", ""),
        "processing_center_id": sample.get("processing_center_id", ""),
        "report_url": sample.get("report_url"),
    }


# ─── Processing Center Receipt Acknowledgment ─────────────────────────────

class VerifyIncomingBarcodeRequest(BaseModel):
    barcode: str


@router.post("/verify-incoming-barcode")
async def verify_incoming_barcode(
    body: VerifyIncomingBarcodeRequest,
    staff: dict = Depends(get_current_pc_staff),
):
    """
    Processing Center receipt verification step when an incoming tube barcode is scanned.
    Lookups sample, verifies it belongs to staff's processing center, retrieves context
    (Booking, Patient, Tube, Tests, Collection Status), and returns context WITHOUT mutating status.
    """
    centre_id = staff["processing_center_id"]
    raw_barcode = (body.barcode or "").strip().upper()
    if not raw_barcode:
        raise HTTPException(400, "Barcode is required.")

    rows = _rows(
        supabase.table("samples")
        .select("*")
        .eq("barcode", raw_barcode)
        .limit(1)
        .execute()
    )
    if not rows:
        return {
            "valid": False,
            "case": "BARCODE_NOT_FOUND",
            "message": f"Barcode {raw_barcode} not found at this processing center.",
            "barcode": raw_barcode,
        }

    sample = rows[0]

    # Verify processing center assignment
    if sample.get("processing_center_id") != centre_id:
        return {
            "valid": False,
            "case": "DIFFERENT_CENTER",
            "message": f"Barcode {raw_barcode} belongs to a different processing center.",
            "barcode": raw_barcode,
            "sample_id": sample["id"],
        }

    # Check status
    if sample.get("status") in ("received", "verified", "processing", "report_ready", "completed"):
        return {
            "valid": False,
            "case": "ALREADY_RECEIVED",
            "message": f"Sample with barcode {raw_barcode} is already received/processing.",
            "barcode": raw_barcode,
            "sample_id": sample["id"],
            "status": sample.get("status"),
            "received_at": sample.get("received_at"),
        }

    if sample.get("status") not in ("collected", "in_transit", "handover_requested"):
        return {
            "valid": False,
            "case": "INVALID_STATUS",
            "message": f"Sample status is '{sample.get('status')}'. Must be collected/in_transit before receipt.",
            "barcode": raw_barcode,
            "sample_id": sample["id"],
            "status": sample.get("status"),
        }

    # Retrieve patient & booking context
    patient_name = "Patient"
    if sample.get("patient_id"):
        u = _first(supabase.table("users").select("full_name").eq("id", sample["patient_id"]).limit(1).execute())
        patient_name = u.get("full_name", "Patient")

    expected = sample.get("expected_tube_type_code", "")
    tube_info = {}
    if expected:
        t = _first(supabase.table("tube_types").select("name, cap_colour").eq("code", expected).limit(1).execute())
        tube_info = t

    return {
        "valid": True,
        "case": "VALID_INCOMING",
        "message": "Barcode Scanned Successfully at Intake Desk",
        "barcode": raw_barcode,
        "sample_id": sample["id"],
        "booking_id": sample.get("booking_id"),
        "patient_id": sample.get("patient_id"),
        "patient_name": patient_name,
        "expected_tube_code": expected,
        "expected_tube_name": tube_info.get("name", expected),
        "expected_cap_colour": tube_info.get("cap_colour", ""),
        "status": sample.get("status"),
        "collected_at": sample.get("collected_at"),
        "allowed_actions": ["confirm_receipt", "scan_again"],
    }


class ConfirmSampleReceiptRequest(BaseModel):
    sample_id: str
    barcode: str
    rescan_barcode: Optional[str] = None
    notes: Optional[str] = None


@router.post("/confirm-sample-receipt")
@router.post("/confirm-pc-receipt")
async def confirm_sample_receipt(
    body: ConfirmSampleReceiptRequest,
    staff: dict = Depends(get_current_pc_staff),
):
    """
    Explicit confirmation of receipt by processing center staff.
    Updates sample status to 'received', sets received_at/received_by,
    and appends an immutable event to sample_events custody log.
    """
    centre_id = staff["processing_center_id"]
    raw_barcode = (body.barcode or "").strip().upper()

    if body.rescan_barcode:
        rescan_clean = body.rescan_barcode.strip().upper()
        if rescan_clean != raw_barcode:
            raise HTTPException(400, "Rescanned barcode does not match verified barcode.")

    rows = _rows(
        supabase.table("samples")
        .select("id, status, processing_center_id, barcode")
        .eq("id", body.sample_id)
        .limit(1)
        .execute()
    )
    if not rows:
        raise HTTPException(404, "Sample not found.")
    sample = rows[0]

    if sample.get("processing_center_id") != centre_id:
        raise HTTPException(403, "This sample does not belong to your centre.")

    if sample.get("status") in ("received", "verified", "processing", "completed"):
        # Idempotent response
        return {
            "success": True,
            "message": "Sample receipt confirmed.",
            "sample_id": sample["id"],
            "barcode": raw_barcode,
            "status": sample.get("status"),
        }

    try:
        validate_sample_transition(sample.get("status"), "received")
    except ValueError as e:
        raise HTTPException(409, detail=str(e))

    now_ts = _now_iso()
    supabase.table("samples").update({
        "status": "received",
        "received_at": now_ts,
        "received_by": staff["user_id"],
    }).eq("id", body.sample_id).execute()

    _log_event(
        body.sample_id,
        "received",
        staff["user_id"],
        centre_id,
        body.notes or f"Sample receipt confirmed with barcode {raw_barcode}",
    )

    return {
        "success": True,
        "message": "Sample receipt confirmed at processing centre.",
        "sample_id": body.sample_id,
        "barcode": raw_barcode,
        "status": "received",
        "received_at": now_ts,
    }


# ─── Receive ──────────────────────────────────────────────────────────────

class ReceiveRequest(BaseModel):
    barcode: Optional[str] = None


@router.post("/samples/{sample_id}/receive")
async def receive_sample(
    sample_id: str,
    body: Optional[ReceiveRequest] = None,
    staff: dict = Depends(get_current_pc_staff),
):
    """Mark a sample as received at the centre."""
    centre_id = staff["processing_center_id"]
    rows = _rows(
        supabase.table("samples")
        .select("id, status, processing_center_id, barcode")
        .eq("id", sample_id)
        .limit(1)
        .execute()
    )
    if not rows:
        raise HTTPException(404, "Sample not found.")
    sample = rows[0]

    if sample.get("processing_center_id") != centre_id:
        raise HTTPException(403, "This sample does not belong to your centre.")
    try:
        validate_sample_transition(sample.get("status"), "received")
    except ValueError as e:
        raise HTTPException(409, detail=str(e))

    supabase.table("samples").update({
        "status": "received",
        "received_at": _now_iso(),
        "received_by": staff["user_id"],
    }).eq("id", sample_id).execute()

    _log_event(sample_id, "received", staff["user_id"], centre_id,
               "Sample received at processing centre")
    return {"success": True, "message": "Sample received."}



# ─── 5-point verification ─────────────────────────────────────────────────

class VerifyRequest(BaseModel):
    tube_received: bool = True
    barcode_match: bool = True
    tube_type_correct: bool = True
    label_present: bool = True
    quality_acceptable: bool = True


@router.post("/samples/{sample_id}/verify")
async def verify_sample(
    sample_id: str,
    body: VerifyRequest,
    staff: dict = Depends(get_current_pc_staff),
):
    """5-point quality check. All five must pass for verification."""
    centre_id = staff["processing_center_id"]

    rows = _rows(
        supabase.table("samples")
        .select("id, status, processing_center_id")
        .eq("id", sample_id)
        .limit(1)
        .execute()
    )
    if not rows:
        raise HTTPException(404, "Sample not found.")
    sample = rows[0]

    if sample.get("processing_center_id") != centre_id:
        raise HTTPException(403, "This sample does not belong to your centre.")
    try:
        validate_sample_transition(sample.get("status"), "verified")
    except ValueError as e:
        raise HTTPException(409, detail=str(e))

    checks = body.model_dump()
    all_pass = all(checks.values())

    if not all_pass:
        failed = [k for k, v in checks.items() if not v]
        raise HTTPException(
            400,
            f"All five checks must pass for verification. Failed: {', '.join(failed)}"
        )

    now = _now_iso()
    verification = {
        **checks,
        "verified_by": staff["user_id"],
        "verified_at": now,
    }

    supabase.table("samples").update({
        "status": "verified",
        "verification": verification,
        "verified_at": now,
        "verified_by": staff["user_id"],
    }).eq("id", sample_id).execute()

    _log_event(sample_id, "verified", staff["user_id"], centre_id,
               "5-point verification passed")

    # P2.4: Per-centre lab connector routing — read the centre's configured
    # connector type instead of hardcoding MOCDOC for all centres.
    centre_connector = ConnectorType.MOCDOC.value  # default
    try:
        centre_row = _first(
            supabase.table("processing_centers")
            .select("lab_connector_type")
            .eq("id", centre_id)
            .limit(1)
            .execute()
        )
        if centre_row and centre_row.get("lab_connector_type"):
            centre_connector = centre_row["lab_connector_type"]
    except Exception:
        pass  # Fall back to default MOCDOC if column doesn't exist yet

    report_job_id, is_new = create_canonical_report_job_for_sample(
        sample_id, connector_type=centre_connector, return_is_new=True
    )
    if report_job_id and is_new and supabase:
        job_rows = _rows(
            supabase.table("report_jobs").select("*").eq("id", report_job_id).limit(1).execute()
        )
        if job_rows:
            job = job_rows[0]
            try:
                await submit_report_job_to_mediassist(
                    report_job_id=report_job_id,
                    patient_id=job.get("patient_id") or "",
                    booking_id=job.get("booking_id"),
                    sample_id=sample_id,
                    processing_center_id=centre_id,
                    barcode=job.get("barcode"),
                    connector_type=job.get("connector_type") or ConnectorType.MOCDOC.value,
                    idempotency_key=job.get("idempotency_key"),
                    correlation_id=job.get("correlation_id"),
                    db=supabase,
                )
            except Exception as exc:
                logger.error(f"Outbound MediAssist submission error for verified sample {sample_id}: {exc}")

    return {"success": True, "message": "Sample verified.", "verification": verification}


# ─── Rejection ────────────────────────────────────────────────────────────

class RejectRequest(BaseModel):
    rejection_code: str
    notes: str = ""


@router.post("/samples/{sample_id}/reject")
async def reject_sample(
    sample_id: str,
    body: RejectRequest,
    staff: dict = Depends(get_current_pc_staff),
):
    """Reject a sample with a standard rejection code."""
    centre_id = staff["processing_center_id"]

    if body.rejection_code not in REJECTION_CODES:
        raise HTTPException(
            400, f"Invalid rejection_code. Must be one of: {', '.join(sorted(REJECTION_CODES))}"
        )

    rows = _rows(
        supabase.table("samples")
        .select("id, status, processing_center_id")
        .eq("id", sample_id)
        .limit(1)
        .execute()
    )
    if not rows:
        raise HTTPException(404, "Sample not found.")
    sample = rows[0]

    if sample.get("processing_center_id") != centre_id:
        raise HTTPException(403, "This sample does not belong to your centre.")
    try:
        validate_sample_transition(sample.get("status"), "rejected")
    except ValueError as e:
        raise HTTPException(409, detail=str(e))

    supabase.table("samples").update({
        "status": "rejected",
        "rejection_code": body.rejection_code,
    }).eq("id", sample_id).execute()

    _log_event(sample_id, "rejected", staff["user_id"], centre_id,
               f"Rejected: {body.rejection_code}. {body.notes}")
    return {"success": True, "message": f"Sample rejected: {body.rejection_code}."}


# ─── Batches ──────────────────────────────────────────────────────────────

class BatchSendRequest(BaseModel):
    courier_reference: str = ""
    notes: str = ""


@router.get("/batches")
async def list_batches(
    status: Optional[str] = Query(default=None),
    staff: dict = Depends(get_current_pc_staff),
):
    """List batches for this centre."""
    centre_id = staff["processing_center_id"]
    query = (
        supabase.table("sample_batches")
        .select("*")
        .eq("processing_center_id", centre_id)
        .order("created_at", desc=True)
    )
    if status:
        query = query.eq("status", status)
    batches = _rows(query.limit(100).execute())

    # Count samples per batch
    for b in batches:
        samples = _rows(
            supabase.table("samples")
            .select("id, barcode, status, expected_tube_type_code")
            .eq("batch_id", b["id"])
            .execute()
        )
        b["samples"] = samples
        b["actual_sample_count"] = len(samples)

    return {"batches": batches}


@router.post("/batches")
async def create_batch(staff: dict = Depends(get_current_pc_staff)):
    """Create a new batch. Auto-generates the batch code."""
    centre_id = staff["processing_center_id"]

    # Get centre code for the batch code
    centre = _first(
        supabase.table("processing_centers")
        .select("code")
        .eq("id", centre_id)
        .limit(1)
        .execute()
    )
    code = centre.get("code", "PC")
    today_str = date.today().isoformat()

    # Count existing batches for today to get sequence
    existing = _rows(
        supabase.table("sample_batches")
        .select("id")
        .eq("processing_center_id", centre_id)
        .ilike("batch_code", f"{code}/{today_str}%")
        .execute()
    )
    seq = len(existing) + 1
    batch_code = f"{code}/{today_str}/{seq:03d}"

    batch_id = str(uuid.uuid4())
    supabase.table("sample_batches").insert({
        "id": batch_id,
        "batch_code": batch_code,
        "processing_center_id": centre_id,
        "status": "open",
        "sample_count": 0,
        "created_by": staff["user_id"],
        "created_at": _now_iso(),
    }).execute()

    return {
        "success": True,
        "batch_id": batch_id,
        "batch_code": batch_code,
        "message": f"Batch {batch_code} created.",
    }


class AddSampleRequest(BaseModel):
    sample_id: str


@router.post("/batches/{batch_id}/add-sample")
async def add_sample_to_batch(
    batch_id: str,
    body: AddSampleRequest,
    staff: dict = Depends(get_current_pc_staff),
):
    """Add a verified sample to an open batch."""
    centre_id = staff["processing_center_id"]

    batch = _first(
        supabase.table("sample_batches")
        .select("id, status, processing_center_id, sample_count")
        .eq("id", batch_id)
        .limit(1)
        .execute()
    )
    if not batch:
        raise HTTPException(404, "Batch not found.")
    if batch.get("processing_center_id") != centre_id:
        raise HTTPException(403, "This batch does not belong to your centre.")
    if batch.get("status") != "open":
        raise HTTPException(409, f"Cannot add to a batch that is '{batch.get('status')}'.")

    sample = _first(
        supabase.table("samples")
        .select("id, status, processing_center_id, batch_id")
        .eq("id", body.sample_id)
        .limit(1)
        .execute()
    )
    if not sample:
        raise HTTPException(404, "Sample not found.")
    if sample.get("processing_center_id") != centre_id:
        raise HTTPException(403, "This sample does not belong to your centre.")
    if sample.get("status") != "verified":
        raise HTTPException(409, "Only verified samples may be added to a batch.")
    if sample.get("batch_id"):
        raise HTTPException(409, "This sample is already in a batch.")

    supabase.table("samples").update({
        "batch_id": batch_id,
        "status": "batched",
    }).eq("id", body.sample_id).execute()

    new_count = (batch.get("sample_count") or 0) + 1
    supabase.table("sample_batches").update({
        "sample_count": new_count,
    }).eq("id", batch_id).execute()

    _log_event(body.sample_id, "batched", staff["user_id"], centre_id,
               f"Added to batch {batch_id}")
    return {"success": True, "message": "Sample added to batch.", "sample_count": new_count}


@router.post("/batches/{batch_id}/seal")
async def seal_batch(
    batch_id: str,
    staff: dict = Depends(get_current_pc_staff),
):
    """Seal a batch. A sealed batch is immutable."""
    centre_id = staff["processing_center_id"]

    batch = _first(
        supabase.table("sample_batches")
        .select("id, status, processing_center_id, sample_count")
        .eq("id", batch_id)
        .limit(1)
        .execute()
    )
    if not batch:
        raise HTTPException(404, "Batch not found.")
    if batch.get("processing_center_id") != centre_id:
        raise HTTPException(403, "This batch does not belong to your centre.")
    if batch.get("status") != "open":
        raise HTTPException(409, f"Cannot seal a batch that is '{batch.get('status')}'.")
    if not batch.get("sample_count"):
        raise HTTPException(400, "Cannot seal an empty batch.")

    supabase.table("sample_batches").update({
        "status": "sealed",
        "sealed_at": _now_iso(),
    }).eq("id", batch_id).execute()

    return {"success": True, "message": "Batch sealed."}


@router.post("/batches/{batch_id}/send")
async def send_batch(
    batch_id: str,
    body: Optional[BatchSendRequest] = None,
    staff: dict = Depends(get_current_pc_staff),
):
    """Mark a sealed batch as sent to the reference lab."""
    centre_id = staff["processing_center_id"]
    body = body or BatchSendRequest()

    batch = _first(
        supabase.table("sample_batches")
        .select("id, status, processing_center_id")
        .eq("id", batch_id)
        .limit(1)
        .execute()
    )
    if not batch:
        raise HTTPException(404, "Batch not found.")
    if batch.get("processing_center_id") != centre_id:
        raise HTTPException(403, "This batch does not belong to your centre.")
    if batch.get("status") != "sealed":
        raise HTTPException(409, "Only sealed batches can be sent to the lab.")

    now = _now_iso()
    supabase.table("sample_batches").update({
        "status": "sent_to_lab",
        "sent_at": now,
        "sent_by": staff["user_id"],
        "courier_reference": body.courier_reference,
        "notes": body.notes,
    }).eq("id", batch_id).execute()

    # Transition all samples in this batch to sent_to_lab
    batch_samples = _rows(
        supabase.table("samples")
        .select("id")
        .eq("batch_id", batch_id)
        .execute()
    )
    sample_ids = [s["id"] for s in batch_samples]
    if sample_ids:
        supabase.table("samples").update({
            "status": "sent_to_lab",
            "sent_to_lab_at": now,
        }).in_("id", sample_ids).execute()

        for sid in sample_ids:
            _log_event(sid, "sent_to_lab", staff["user_id"], centre_id,
                       f"Sent to reference lab. Courier: {body.courier_reference}")

    return {
        "success": True,
        "message": f"Batch sent to lab. {len(sample_ids)} sample(s) transitioned.",
        "sample_count": len(sample_ids),
    }


# ─── Roster summary ──────────────────────────────────────────────────────

@router.get("/roster-summary")
async def roster_summary(
    date: Optional[str] = Query(default=None),
    staff: dict = Depends(get_current_pc_staff),
):
    """Roster summary for the dashboard — phlebos + job counts."""
    centre_id = staff["processing_center_id"]
    target_date = date or (datetime.now().date() + timedelta(days=1)).isoformat()

    # Roster entries for this date
    roster = _rows(
        supabase.table("phlebotomist_roster")
        .select("*")
        .eq("processing_center_id", centre_id)
        .eq("roster_date", target_date)
        .execute()
    )

    # All phlebos of this centre
    phlebos = _rows(
        supabase.table("phlebotomists")
        .select("user_id, base_lat, base_lng, base_pincode")
        .eq("processing_center_id", centre_id)
        .execute()
    )

    # Get user names
    phlebo_ids = [p["user_id"] for p in phlebos]
    user_map: Dict[str, str] = {}
    if phlebo_ids:
        users = _rows(
            supabase.table("users")
            .select("id, full_name, mobile")
            .in_("id", phlebo_ids)
            .execute()
        )
        user_map = {u["id"]: u for u in users}

    # Dispatch requests for this date
    dispatches = _rows(
        supabase.table("dispatch_requests")
        .select("id, assigned_provider_id, status, booking_id")
        .eq("scheduled_for", target_date)
        .execute()
    )

    roster_map = {r["phlebotomist_user_id"]: r for r in roster}
    assigned_counts: Dict[str, int] = {}
    unassigned_jobs = []
    for d in dispatches:
        provider = d.get("assigned_provider_id")
        if provider:
            assigned_counts[provider] = assigned_counts.get(provider, 0) + 1
        if d.get("status") == "needs_manual_assignment":
            unassigned_jobs.append(d)

    phlebo_list = []
    for p in phlebos:
        uid = p["user_id"]
        user = user_map.get(uid, {})
        r = roster_map.get(uid)
        phlebo_list.append({
            "user_id": uid,
            "full_name": user.get("full_name", ""),
            "mobile": user.get("mobile", ""),
            "roster_status": r.get("status", "not_rostered") if r else "not_rostered",
            "max_jobs": r.get("max_jobs", 0) if r else 0,
            "assigned_jobs": assigned_counts.get(uid, 0),
        })

    return {
        "date": target_date,
        "phlebotomists": phlebo_list,
        "unassigned_jobs": unassigned_jobs,
        "total_dispatches": len(dispatches),
        "unassigned_count": len(unassigned_jobs),
    }
