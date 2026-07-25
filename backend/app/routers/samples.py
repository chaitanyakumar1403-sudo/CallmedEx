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

from app.middleware.auth import get_current_user
from app.services.audit import AuditService
from app.services.samples import SampleService
from app.services.wallet import WalletService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/samples", tags=["Samples"])

COLLECTOR_ROLES = {"phlebotomist", "nurse", "admin"}
CENTRE_ROLES = {"organization", "staff", "admin"}


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
    """Attach the finished report to a received sample and notify the patient."""
    if current_user.get("role") not in CENTRE_ROLES:
        raise HTTPException(403, "Only diagnostic centres can publish reports")
    if not body.report_url.strip():
        raise HTTPException(400, "report_url is required")

    result = await SampleService.upload_report(
        sample_id=sample_id,
        uploader_user_id=current_user["sub"],
        report_url=body.report_url.strip(),
        notes=body.notes,
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

    return {"success": True, "sample": trail}
