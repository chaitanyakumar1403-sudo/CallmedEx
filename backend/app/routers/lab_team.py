"""
Lab Team & Attendance Router — CallMedex

Two related field-operations concerns:

  /api/lab-team/*    the two-sided affiliation between a diagnostic centre and
                     a collector. Either side may ask; the other must agree.
  /api/attendance/*  the daily selfie-with-kit gate, which holds PAYMENT rather
                     than blocking dispatch.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.services.attendance import AttendanceService
from app.services.audit import AuditService
from app.services.lab_team import LabTeamService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Lab Team & Attendance"])

COLLECTOR_ROLES = {"phlebotomist", "nurse"}
CENTRE_ROLES = {"organization", "staff", "admin"}


# ─── Models ───────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    # Either a known user id, or an email/mobile to look up.
    phlebotomist_user_id: Optional[str] = None
    identifier: Optional[str] = None
    message: str = ""


class JoinRequest(BaseModel):
    org_user_id: str
    message: str = ""


class RespondRequest(BaseModel):
    accept: bool
    note: str = ""


class AttendanceRequest(BaseModel):
    selfie_url: str
    lat: Optional[float] = None
    lng: Optional[float] = None


# ─── Centre side ──────────────────────────────────────────────────────────

@router.get("/lab-team")
async def org_team(current_user: dict = Depends(get_current_user)):
    """The centre's collector roster, plus requests awaiting either side."""
    if current_user.get("role") not in CENTRE_ROLES:
        raise HTTPException(403, "Only diagnostic centres have a collector team")
    return {"success": True, **LabTeamService.list_for_org(current_user["sub"])}


@router.post("/lab-team/invite")
async def invite_collector(
    body: InviteRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Invite a collector to join this centre. They must accept before it counts."""
    if current_user.get("role") not in CENTRE_ROLES:
        raise HTTPException(403, "Only diagnostic centres can invite collectors")

    target_id = body.phlebotomist_user_id
    if not target_id:
        if not body.identifier:
            raise HTTPException(400, "Provide a collector, or an email or mobile to look up")
        found = LabTeamService.find_phlebotomist(body.identifier)
        if not found:
            raise HTTPException(404, "No collector found with that email or mobile")
        target_id = found["id"]

    result = LabTeamService.request_link(
        org_user_id=current_user["sub"],
        phlebotomist_user_id=target_id,
        initiated_by="organization",
        requested_by=current_user["sub"],
        message=body.message,
    )
    if not result.get("success"):
        raise HTTPException(400, result.get("message", "Could not send the invitation"))

    AuditService.log_from_request(
        action="lab_team.invited", entity_type="lab_phlebotomist_link",
        entity_id=result.get("link_id"), actor_id=current_user["sub"],
        details={"phlebotomist_user_id": target_id}, request=request,
    )
    return result


@router.get("/lab-team/lookup")
async def lookup_collector(
    identifier: str,
    current_user: dict = Depends(get_current_user),
):
    """Resolve a collector by email or mobile before inviting them."""
    if current_user.get("role") not in CENTRE_ROLES:
        raise HTTPException(403, "Not authorised")
    found = LabTeamService.find_phlebotomist(identifier)
    if not found:
        raise HTTPException(404, "No collector found with that email or mobile")
    return {"success": True, "collector": found}


# ─── Collector side ───────────────────────────────────────────────────────

@router.get("/lab-team/mine")
async def my_affiliation(current_user: dict = Depends(get_current_user)):
    """The collector's current lab, plus anything awaiting either side."""
    if current_user.get("role") not in COLLECTOR_ROLES:
        raise HTTPException(403, "Only collectors have a lab affiliation")
    return {"success": True, **LabTeamService.list_for_phlebotomist(current_user["sub"])}


@router.post("/lab-team/join")
async def request_to_join(
    body: JoinRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Ask a centre to take you on. The centre must accept before it counts."""
    if current_user.get("role") not in COLLECTOR_ROLES:
        raise HTTPException(403, "Only collectors can request to join a centre")

    result = LabTeamService.request_link(
        org_user_id=body.org_user_id,
        phlebotomist_user_id=current_user["sub"],
        initiated_by="phlebotomist",
        requested_by=current_user["sub"],
        message=body.message,
    )
    if not result.get("success"):
        raise HTTPException(400, result.get("message", "Could not send the request"))

    AuditService.log_from_request(
        action="lab_team.join_requested", entity_type="lab_phlebotomist_link",
        entity_id=result.get("link_id"), actor_id=current_user["sub"],
        details={"org_user_id": body.org_user_id}, request=request,
    )
    return result


# ─── Shared ───────────────────────────────────────────────────────────────

@router.post("/lab-team/{link_id}/respond")
async def respond_to_request(
    link_id: str,
    body: RespondRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Accept or decline. Only the party who did NOT open the request may answer,
    which is what keeps the affiliation two-sided.
    """
    result = LabTeamService.respond(link_id, current_user["sub"], body.accept, body.note)
    if not result.get("success"):
        raise HTTPException(409, result.get("message", "Could not record your response"))

    AuditService.log_from_request(
        action="lab_team.responded", entity_type="lab_phlebotomist_link",
        entity_id=link_id, actor_id=current_user["sub"],
        details={"accepted": body.accept}, request=request,
    )
    return result


@router.delete("/lab-team/{link_id}")
async def end_affiliation(
    link_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """End an affiliation. Either side may leave unilaterally."""
    result = LabTeamService.revoke(link_id, current_user["sub"])
    if not result.get("success"):
        raise HTTPException(400, result.get("message", "Could not end the affiliation"))

    AuditService.log_from_request(
        action="lab_team.revoked", entity_type="lab_phlebotomist_link",
        entity_id=link_id, actor_id=current_user["sub"], request=request,
    )
    return result


# ─── Attendance ───────────────────────────────────────────────────────────

@router.get("/attendance/today")
async def attendance_today(current_user: dict = Depends(get_current_user)):
    """Today's attendance card, including any payout hold."""
    return {"success": True, **AttendanceService.today(current_user["sub"])}


@router.post("/attendance")
async def submit_attendance(
    body: AttendanceRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Submit the daily selfie with collection kit.

    On-time submission lifts an attendance hold automatically, so a collector who
    fixes it early is not left waiting on a human.
    """
    if current_user.get("role") not in COLLECTOR_ROLES:
        raise HTTPException(403, "Only field collectors record daily attendance")

    result = AttendanceService.submit(
        provider_user_id=current_user["sub"],
        selfie_url=body.selfie_url,
        provider_role=current_user.get("role", "phlebotomist"),
        lat=body.lat,
        lng=body.lng,
    )
    if not result.get("success"):
        raise HTTPException(400, result.get("message", "Could not record attendance"))

    AuditService.log_from_request(
        action="attendance.submitted", entity_type="attendance_log",
        entity_id=current_user["sub"], actor_id=current_user["sub"],
        details={"is_late": result.get("is_late")}, request=request,
    )
    return result


@router.get("/attendance/history")
async def attendance_history(
    limit: int = 30,
    current_user: dict = Depends(get_current_user),
):
    return {
        "success": True,
        "logs": AttendanceService.history(current_user["sub"], limit),
    }
