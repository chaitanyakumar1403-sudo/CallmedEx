"""
Care Circle Router (§8.5)
Enables scoped family health guardianship (book_pay, view_reports, receive_alerts, join_consultations).
Complies with DPDP consent requirements.
"""
import logging
import secrets
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import get_current_user
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/care-circle", tags=["Care Circle (§8.5)"])

VALID_SCOPES = {"book_pay", "view_reports", "receive_alerts", "join_consultations"}


class CareCircleInviteRequest(BaseModel):
    phone: str = Field(..., description="10-digit mobile number of family member")
    full_name: str = Field(..., description="Full name of family member")
    relationship: str = Field(..., description="e.g. Parent, Child, Spouse, Sibling")
    scopes: List[str] = Field(
        default=["book_pay", "view_reports", "receive_alerts"],
        description="Granted guardianship permissions"
    )


class AcceptInviteRequest(BaseModel):
    invite_token: str


@router.post("/invite")
async def invite_care_circle_member(
    payload: CareCircleInviteRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Invite a family member into patient's Care Circle with specific scopes.
    """
    if not supabase:
        raise HTTPException(500, "Database unavailable.")

    patient_id = current_user["sub"]
    cleaned_phone = payload.phone.strip().replace(" ", "").replace("+91", "")[-10:]

    # Validate scopes
    for s in payload.scopes:
        if s not in VALID_SCOPES:
            raise HTTPException(400, f"Invalid scope '{s}'. Must be one of: {list(VALID_SCOPES)}")

    # Generate secure invite token
    token = secrets.token_urlsafe(16)
    now = datetime.now(timezone.utc).isoformat()

    # If the invited person already has an account, look up their user ID
    member_user_id = None
    try:
        u_rows = _rows(supabase.table("users").select("id").ilike("mobile", f"%{cleaned_phone}%").limit(1).execute())
        if u_rows:
            member_user_id = u_rows[0]["id"]
    except Exception:
        pass

    try:
        ins = supabase.table("care_circle_members").insert({
            "patient_id": patient_id,
            "member_user_id": member_user_id,
            "phone": cleaned_phone,
            "full_name": payload.full_name.strip(),
            "relationship": payload.relationship.strip(),
            "scopes": payload.scopes,
            "status": "invited",
            "invite_token": token,
            "invited_at": now,
        }).execute()
        member_id = ins.data[0]["id"] if ins.data else None
    except Exception as exc:
        logger.error(f"Failed to insert care circle member: {exc}")
        raise HTTPException(500, "Failed to send Care Circle invitation.")

    # Audit log consent in consent_records
    try:
        supabase.table("consent_records").insert({
            "patient_id": patient_id,
            "consent_type": "care_circle_delegation",
            "purpose": f"Family guardianship delegation for {payload.relationship}: {payload.full_name}",
            "granted_to": cleaned_phone,
            "granted_at": now,
            "is_active": True,
        }).execute()
    except Exception:
        pass

    return {
        "success": True,
        "member_id": member_id,
        "invite_token": token,
        "share_url": f"/care-circle/join?token={token}",
        "message": f"Invitation created for {payload.full_name}. They can join with the invite link.",
    }


@router.post("/accept")
async def accept_care_circle_invite(
    payload: AcceptInviteRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Accept an invitation to join someone's Care Circle.
    """
    if not supabase:
        raise HTTPException(500, "Database unavailable.")

    user_id = current_user["sub"]
    token = payload.invite_token.strip()

    rows = _rows(
        supabase.table("care_circle_members")
        .select("*")
        .eq("invite_token", token)
        .eq("status", "invited")
        .limit(1)
        .execute()
    )
    if not rows:
        raise HTTPException(404, "Invalid or already accepted invitation.")

    member_row = rows[0]
    now = datetime.now(timezone.utc).isoformat()

    try:
        supabase.table("care_circle_members").update({
            "status": "accepted",
            "member_user_id": user_id,
            "accepted_at": now,
            "updated_at": now,
        }).eq("id", member_row["id"]).execute()
    except Exception as exc:
        logger.error(f"Failed to accept care circle invite: {exc}")
        raise HTTPException(500, "Failed to activate Care Circle membership.")

    return {
        "success": True,
        "patient_id": member_row["patient_id"],
        "relationship": member_row["relationship"],
        "scopes": member_row["scopes"],
        "message": "Care Circle membership accepted successfully.",
    }


@router.get("/members")
async def list_care_circle_members(current_user: dict = Depends(get_current_user)):
    """
    List all Care Circle members invited or accepted by the current patient.
    """
    if not supabase:
        return {"success": True, "members": []}

    patient_id = current_user["sub"]
    try:
        rows = _rows(
            supabase.table("care_circle_members")
            .select("*")
            .eq("patient_id", patient_id)
            .neq("status", "revoked")
            .order("created_at", desc=False)
            .execute()
        )
        return {"success": True, "members": rows, "count": len(rows)}
    except Exception as exc:
        logger.error(f"list_care_circle_members failed: {exc}")
        return {"success": True, "members": []}


@router.delete("/members/{member_id}")
async def revoke_care_circle_member(
    member_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Revoke a Care Circle member's access.
    """
    if not supabase:
        raise HTTPException(500, "Database unavailable.")

    patient_id = current_user["sub"]
    now = datetime.now(timezone.utc).isoformat()

    try:
        res = supabase.table("care_circle_members").update({
            "status": "revoked",
            "revoked_at": now,
            "updated_at": now,
        }).eq("id", member_id).eq("patient_id", patient_id).execute()

        if not res.data:
            raise HTTPException(404, "Member not found or unauthorized to revoke.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to revoke member: {exc}")
        raise HTTPException(500, "Failed to revoke access.")

    return {"success": True, "message": "Care Circle access revoked."}


@router.get("/guarded-patients")
async def list_guarded_patients(current_user: dict = Depends(get_current_user)):
    """
    List patients for whom the current user acts as a Care Circle guardian.
    """
    if not supabase:
        return {"success": True, "guarded_patients": []}

    user_id = current_user["sub"]
    try:
        memberships = _rows(
            supabase.table("care_circle_members")
            .select("*, users!care_circle_members_patient_id_fkey(full_name, mobile)")
            .eq("member_user_id", user_id)
            .eq("status", "accepted")
            .execute()
        )
        return {"success": True, "guarded_patients": memberships}
    except Exception:
        # Fallback without explicit fkey join
        try:
            memberships = _rows(
                supabase.table("care_circle_members")
                .select("*")
                .eq("member_user_id", user_id)
                .eq("status", "accepted")
                .execute()
            )
            return {"success": True, "guarded_patients": memberships}
        except Exception:
            return {"success": True, "guarded_patients": []}
