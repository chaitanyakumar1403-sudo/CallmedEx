"""
Samples Router — CallMedex

The physical specimen journey, from the phlebotomist's collection kit to the
diagnostic centre's bench and back to the patient as a report:

    phlebotomist              diagnostic centre            patient
    ------------              -----------------            -------
    POST /collect        ->
    POST /handover       ->   GET  /handovers/incoming
                              POST /handovers/{id}/respond -> notified
                              POST /{id}/report            -> notified
                                                              GET /{id}/track

Authorisation is ownership-based throughout: a phlebotomist may only submit
tubes they collected, and a centre may only rule on handovers addressed to it.
"""
import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import get_current_user
from app.services.audit import AuditService
from app.services.samples import SampleService
from app.services.wallet import WalletService
from app.utils.db_helpers import _rows, _first

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/samples", tags=["Samples"])

COLLECTOR_ROLES = {"phlebotomist", "nurse", "admin"}
CENTRE_ROLES = {"organization", "staff", "admin"}


# Never widen these. /track is shared by the patient, the collecting
# phlebotomist, the destination centre and admins (see track_sample's
# docstring) — but only the PATIENT gets filtered through this allowlist.
# `samples` and `sample_events` both gained processing-centre/laboratory
# columns (processing_center_id, batch_id, lab_reference, location_label) that
# must never reach a patient's browser.
PATIENT_SAMPLE_FIELDS = (
    "id", "barcode", "booking_id", "dispatch_request_id", "patient_id",
    "phlebotomist_user_id", "sample_type", "container_type", "test_names",
    "status", "collected_at", "collection_photo_url",
    "received_at", "rejection_reason", "report_url", "report_uploaded_at",
    "notes", "created_at", "updated_at",
)

PATIENT_SAMPLE_EVENT_FIELDS = (
    "id", "sample_id", "event", "actor_role", "photo_url", "notes",
    "created_at",
)


# ─── Request models ───────────────────────────────────────────────────────

class CollectRequest(BaseModel):
    # Optional: the authoritative patient comes from the referenced dispatch.
    patient_id: Optional[str] = None
    booking_id: Optional[str] = None
    dispatch_request_id: Optional[str] = None
    barcode: Optional[str] = None          # from a scanner; minted when absent
    sample_type: str = "blood"
    container_type: str = ""
    test_names: List[str] = Field(default_factory=list)
    lat: Optional[float] = None
    lng: Optional[float] = None
    photo_url: str = ""
    destination_org_user_id: Optional[str] = None
    notes: str = ""


class HandoverRequest(BaseModel):
    sample_ids: List[str]
    destination_org_user_id: Optional[str] = None
    notes: str = ""


class HandoverResponse(BaseModel):
    accepted_sample_ids: List[str] = Field(default_factory=list)
    # sample_id -> rejection reason
    rejected: Dict[str, str] = Field(default_factory=dict)
    notes: str = ""


class ReportRequest(BaseModel):
    report_url: str
    notes: str = ""



# ─── Phlebotomist ─────────────────────────────────────────────────────────

@router.post("/collect")
async def collect_sample(
    body: CollectRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Register a tube at the patient's side. Returns the barcode to print/attach."""
    if current_user.get("role") not in COLLECTOR_ROLES:
        raise HTTPException(403, "Only field collectors can register samples")

    result = await SampleService.collect(
        phlebotomist_user_id=current_user["sub"],
        patient_id=body.patient_id,
        # Admins may file a tube without a dispatch (back-office corrections,
        # walk-ins). Field collectors must always reference their own run.
        allow_unlinked=current_user.get("role") == "admin",
        booking_id=body.booking_id,
        dispatch_request_id=body.dispatch_request_id,
        barcode=body.barcode,
        sample_type=body.sample_type,
        container_type=body.container_type,
        test_names=body.test_names,
        lat=body.lat,
        lng=body.lng,
        photo_url=body.photo_url,
        destination_org_user_id=body.destination_org_user_id,
        notes=body.notes,
    )
    if not result.get("success"):
        raise HTTPException(400, result.get("message", "Failed to register sample"))

    AuditService.log_from_request(
        action="sample.collected", entity_type="sample",
        entity_id=result.get("sample_id"), actor_id=current_user["sub"],
        details={"barcode": result.get("barcode"), "booking_id": body.booking_id},
        request=request,
    )

    # Surfaced so the app can prompt the phlebotomist to pick a lab before handover.
    if not result.get("has_destination"):
        result["warning"] = (
            "No linked diagnostic centre yet — choose a destination when submitting."
        )
    return result


@router.get("/mine")
async def my_samples(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Tubes attributable to the calling phlebotomist, newest first."""
    if current_user.get("role") not in COLLECTOR_ROLES:
        raise HTTPException(403, "Only field collectors have a sample list")

    statuses = [s.strip() for s in status.split(",")] if status else None
    samples = SampleService.list_for_phlebotomist(current_user["sub"], statuses)

    # "In hand" is what the handover screen acts on.
    in_hand = [s for s in samples if s.get("status") in ("collected", "in_transit")]
    return {
        "success": True,
        "samples": samples,
        "in_hand_count": len(in_hand),
        "total": len(samples),
    }


@router.post("/handover")
async def submit_handover(
    body: HandoverRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Submit a batch of collected tubes to a diagnostic centre for verification."""
    if current_user.get("role") not in COLLECTOR_ROLES:
        raise HTTPException(403, "Only field collectors can submit samples")

    result = await SampleService.request_handover(
        phlebotomist_user_id=current_user["sub"],
        sample_ids=body.sample_ids,
        destination_org_user_id=body.destination_org_user_id,
        notes=body.notes,
    )
    if not result.get("success"):
        raise HTTPException(400, result.get("message", "Handover failed"))

    AuditService.log_from_request(
        action="sample.handover_requested", entity_type="sample_handover",
        entity_id=result.get("handover_id"), actor_id=current_user["sub"],
        details={
            "sample_count": result.get("submitted_count"),
            "destination": result.get("destination_org_user_id"),
        },
        request=request,
    )
    return result


@router.get("/my-lab")
async def get_my_lab(current_user: dict = Depends(get_current_user)):
    """The diagnostic centre this collector hands samples to by default."""
    if current_user.get("role") not in COLLECTOR_ROLES:
        raise HTTPException(403, "Only field collectors have a linked lab")
    return {"success": True, **SampleService.get_home_lab(current_user["sub"])}


@router.get("/wallet")
async def my_wallet(current_user: dict = Depends(get_current_user)):
    """
    Wallet balance and recent ledger entries.

    Part-time phlebotomists accrue their per-collection rate here as each tube is
    verified by the lab; settlement to the bank is monthly.
    """
    return {"success": True, **WalletService.get_summary(current_user["sub"])}


# ─── Diagnostic centre ────────────────────────────────────────────────────

@router.get("/handovers/incoming")
async def incoming_handovers(
    status: str = "pending",
    current_user: dict = Depends(get_current_user),
):
    """Handover batches awaiting this centre's verification, tubes included."""
    if current_user.get("role") not in CENTRE_ROLES:
        raise HTTPException(403, "Only diagnostic centres can view incoming handovers")

    handovers = SampleService.list_incoming_handovers(current_user["sub"], status)
    return {
        "success": True,
        "handovers": handovers,
        "pending_count": len(handovers),
    }


@router.post("/handovers/{handover_id}/respond")
async def respond_handover(
    handover_id: str,
    body: HandoverResponse,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Accept and/or reject each tube in a handover.

    Accepting credits the collecting phlebotomist and notifies the patient by
    name of centre. Rejecting pays nothing and records the reason.
    Tubes not explicitly listed are accepted with the batch.
    """
    if current_user.get("role") not in CENTRE_ROLES:
        raise HTTPException(403, "Only diagnostic centres can verify handovers")

    result = await SampleService.respond_to_handover(
        handover_id=handover_id,
        responder_user_id=current_user["sub"],
        accepted_sample_ids=body.accepted_sample_ids,
        rejected=body.rejected,
        notes=body.notes,
    )
    if not result.get("success"):
        # Wrong centre or already answered — a conflict, not a server fault.
        raise HTTPException(409, result.get("message", "Could not process handover"))

    AuditService.log_from_request(
        action="sample.handover_verified", entity_type="sample_handover",
        entity_id=handover_id, actor_id=current_user["sub"],
        details={
            "accepted": result.get("accepted_count"),
            "rejected": result.get("rejected_count"),
            "payout": result.get("payout"),
        },
        request=request,
    )
    return result


@router.post("/{sample_id}/report")
async def publish_report(
    sample_id: str,
    body: ReportRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Attach the finished report to a received sample and notify the patient.

    Role gate: diagnostic centre roles (organization, staff, admin) OR
    processing centre staff whose centre owns the sample.
    """
    if current_user.get("role") not in CENTRE_ROLES and current_user.get("role") != "processing_center":
        raise HTTPException(403, "Only diagnostic centres or processing centres can publish reports")
    if not body.report_url.strip():
        raise HTTPException(400, "report_url is required")

    # Resolve processing_center_id for PC staff callers
    processing_center_id = None
    if current_user.get("role") == "processing_center":
        user_id = current_user.get("sub") or current_user.get("user_id")
        pc_rows = _rows(
            supabase.table("processing_center_staff")
            .select("processing_center_id")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if not pc_rows:
            raise HTTPException(403, "Not an active Processing Center staff account.")
        processing_center_id = pc_rows[0]["processing_center_id"]

    result = await SampleService.upload_report(
        sample_id=sample_id,
        uploader_user_id=current_user["sub"],
        report_url=body.report_url.strip(),
        notes=body.notes,
        processing_center_id=processing_center_id,
    )
    if not result.get("success"):
        raise HTTPException(400, result.get("message", "Failed to publish report"))

    AuditService.log_from_request(
        action="sample.report_published", entity_type="sample",
        entity_id=sample_id, actor_id=current_user["sub"],
        request=request,
    )
    return result


# ─── Shared tracking ──────────────────────────────────────────────────────

@router.get("/{sample_id}/track")
async def track_sample(
    sample_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Full custody trail for one tube.

    Visible to the patient it belongs to, the phlebotomist who collected it, the
    destination centre, and admins — nobody else.
    """
    trail = SampleService.get_custody_trail(sample_id)
    if not trail:
        raise HTTPException(404, "Sample not found")

    uid, role = current_user["sub"], current_user.get("role")
    permitted = {
        trail.get("patient_id"),
        trail.get("phlebotomist_user_id"),
        trail.get("destination_org_user_id"),
    }
    if role != "admin" and uid not in permitted:
        raise HTTPException(403, "You do not have access to this sample")

    if role == "patient":
        events = trail.get("events", [])
        trail = {k: trail[k] for k in PATIENT_SAMPLE_FIELDS if k in trail}
        trail["events"] = [
            {k: e[k] for k in PATIENT_SAMPLE_EVENT_FIELDS if k in e}
            for e in events
        ]

    return {"success": True, "sample": trail}


# ─── Operational Custody Timeline Visualization API ────────────────────────

@router.get("/{sample_id}/timeline")
async def get_sample_timeline(
    sample_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Operational custody timeline for a specimen.
    Visualizes every milestone (Booking Created, Barcode Bound, Sample Collected,
    Handover Requested, Received at Processing Center, Verified, Processing Started,
    Report Ready, Report Delivered) in chronological order with timestamps and actor details.
    """
    sample = _first(supabase.table("samples").select("*").eq("id", sample_id).limit(1).execute())
    if not sample:
        raise HTTPException(404, "Sample not found.")

    uid, role = current_user["sub"], current_user.get("role")
    permitted = {
        sample.get("patient_id"),
        sample.get("phlebotomist_user_id"),
    }
    if role not in ("admin", "staff", "organization", "processing_center", "phlebotomist") and uid not in permitted:
        raise HTTPException(403, "You do not have access to this sample timeline.")

    # 1. Fetch raw custody events
    events = _rows(
        supabase.table("sample_events")
        .select("*")
        .eq("sample_id", sample_id)
        .order("created_at", desc=False)
        .execute()
    )

    # 2. Fetch booking details
    booking = {}
    b_id = sample.get("booking_id")
    if b_id:
        booking = _first(supabase.table("bookings").select("id, created_at, scheduled_date, status").eq("id", b_id).limit(1).execute())

    # 3. Fetch report job details
    report_job = _first(supabase.table("report_jobs").select("id, status, created_at, updated_at").eq("sample_id", sample_id).limit(1).execute())

    # 4. Fetch AI report analysis details
    ai_analysis = {}
    if report_job and report_job.get("id"):
        ai_analysis = _first(supabase.table("ai_report_analyses").select("id, report_version, report_status, created_at").eq("report_job_id", report_job["id"]).limit(1).execute())

    timeline = []

    # Milestone 1: Booking Created
    if booking.get("created_at"):
        b_id_short = str(booking.get("id") or "")[:8]
        timeline.append({
            "stage": "booking_created",
            "title": "Booking Created",
            "timestamp": booking.get("created_at"),
            "actor_role": "patient",
            "details": f"Booking {b_id_short} registered",
        })

    # Milestone 2: Barcode Bound
    scanned_barcode = sample.get("barcode")
    if scanned_barcode:
        timeline.append({
            "stage": "barcode_bound",
            "title": "Barcode Bound",
            "timestamp": sample.get("created_at") or booking.get("created_at"),
            "actor_role": "system",
            "details": f"Sticker Barcode {scanned_barcode} assigned",
        })

    # Milestone 3: Sample Events Log
    stage_titles = {
        "barcode_bound": "Barcode Bound",
        "sample_collected": "Sample Collected",
        "collected": "Sample Collected",
        "in_transit": "In Transit to Processing Center",
        "handover_requested": "Handover Requested",
        "received": "Received at Processing Center",
        "verified": "5-Point Verification Passed",
        "rejected": "Sample Rejected at Intake Desk",
        "processing": "Lab Report Analysis Started",
        "report_ready": "Lab Report Analysis Complete",
        "report_delivered": "Report Delivered to Patient",
    }

    for ev in events:
        event_name = ev.get("event", "event")
        timeline.append({
            "stage": event_name,
            "title": stage_titles.get(event_name, event_name.replace("_", " ").title()),
            "timestamp": ev.get("created_at"),
            "actor_role": ev.get("actor_role", "unknown"),
            "actor_id": ev.get("actor_id"),
            "details": ev.get("notes", ""),
            "lat": ev.get("lat"),
            "lng": ev.get("lng"),
        })

    # Milestone 4: Report Delivered / Analyzed
    if ai_analysis.get("created_at"):
        ver = ai_analysis.get("report_version", 1)
        r_stat = ai_analysis.get("report_status", "final")
        timeline.append({
            "stage": "report_delivered",
            "title": "AI Report Summary Delivered",
            "timestamp": ai_analysis.get("created_at"),
            "actor_role": "mediassist_ai",
            "details": f"Report v{ver} delivered ({r_stat})",
        })

    # Sort timeline chronologically by timestamp
    timeline.sort(key=lambda x: x.get("timestamp") or "")

    return {
        "success": True,
        "sample_id": sample_id,
        "barcode": sample.get("barcode"),
        "current_status": sample.get("status"),
        "timeline": timeline,
        "total_milestones": len(timeline),
    }

