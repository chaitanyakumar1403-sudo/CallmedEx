"""
Processing Center administration — CallMedex admin only.

Centres are created by CallMedex, never by self-signup. Deciding who becomes a
processing centre is a business decision, not a registration form.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import get_current_user
from app.middleware.pc_auth import get_current_pc_staff

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/processing-centers", tags=["Processing Centers"])


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _require_admin(user: dict) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only.")
    return user


class CenterIn(BaseModel):
    code: str
    name: str
    city: str
    address: str = ""
    pincode: str = ""
    state: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    partner_lab_name: str = ""
    daily_capacity: int = 0
    status: str = "onboarding"


class StaffIn(BaseModel):
    user_id: str
    pc_role: str = "technician"


class AreaIn(BaseModel):
    city: Optional[str] = None
    pincode: Optional[str] = None
    radius_km: Optional[float] = None
    priority: int = 100


@router.post("")
async def create_center(payload: CenterIn, user: dict = Depends(get_current_user)):
    _require_admin(user)
    body = payload.model_dump()
    body["city"] = body["city"].strip().lower()
    body["created_by"] = user.get("sub")
    created = _rows(supabase.table("processing_centers").insert(body).execute())
    return {"center": created[0] if created else None}


@router.get("")
async def list_centers(user: dict = Depends(get_current_user)):
    _require_admin(user)
    return {"centers": _rows(supabase.table("processing_centers").select("*").execute())}


@router.patch("/{center_id}")
async def update_center(center_id: str, payload: dict,
                        user: dict = Depends(get_current_user)):
    _require_admin(user)
    if "city" in payload and payload["city"]:
        payload["city"] = str(payload["city"]).strip().lower()
    updated = _rows(
        supabase.table("processing_centers").update(payload).eq("id", center_id).execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Processing centre not found.")
    return {"center": updated[0]}


@router.post("/{center_id}/staff")
async def add_staff(center_id: str, payload: StaffIn,
                    user: dict = Depends(get_current_user)):
    _require_admin(user)
    if payload.pc_role not in ("admin", "technician"):
        raise HTTPException(status_code=400, detail="pc_role must be admin or technician.")

    # Record whatever role the user held BEFORE this grant overwrites it, so
    # remove_staff has somewhere to put it back. Without this, revoking PC
    # access permanently locks the user out of both /api/pc/* and whatever
    # role (doctor, phlebotomist, ...) they held beforehand.
    existing_user = _rows(
        supabase.table("users").select("role").eq("id", payload.user_id).limit(1).execute()
    )
    prior_role = existing_user[0].get("role") if existing_user else ""

    supabase.table("processing_center_staff").insert({
        "processing_center_id": center_id,
        "user_id": payload.user_id,
        "pc_role": payload.pc_role,
        "is_active": True,
        "prior_role": prior_role,
    }).execute()
    supabase.table("users").update({"role": "processing_center"}) \
        .eq("id", payload.user_id).execute()
    return {"ok": True}


@router.delete("/{center_id}/staff/{user_id}")
async def remove_staff(center_id: str, user_id: str,
                       user: dict = Depends(get_current_user)):
    _require_admin(user)
    staff_rows = _rows(
        supabase.table("processing_center_staff").select("prior_role")
        .eq("processing_center_id", center_id).eq("user_id", user_id)
        .limit(1).execute()
    )
    supabase.table("processing_center_staff").update({"is_active": False}) \
        .eq("processing_center_id", center_id).eq("user_id", user_id).execute()

    # Restore the role this grant overwrote — but only if the user isn't
    # still active staff at another centre, which would otherwise demote them
    # out of a role ('processing_center') they still legitimately hold.
    still_pc_staff = _rows(
        supabase.table("processing_center_staff").select("id")
        .eq("user_id", user_id).eq("is_active", True).limit(1).execute()
    )
    prior_role = staff_rows[0].get("prior_role") if staff_rows else ""
    if not still_pc_staff and prior_role:
        supabase.table("users").update({"role": prior_role}) \
            .eq("id", user_id).execute()
    return {"ok": True}


@router.post("/{center_id}/areas")
async def add_area(center_id: str, payload: AreaIn,
                   user: dict = Depends(get_current_user)):
    _require_admin(user)
    body = payload.model_dump()
    if body.get("city"):
        body["city"] = body["city"].strip().lower()
    body["processing_center_id"] = center_id
    body["is_active"] = True
    supabase.table("processing_center_areas").insert(body).execute()
    return {"ok": True}


# ─── Centre self-read ─────────────────────────────────────────────────────

me_router = APIRouter(prefix="/api/pc", tags=["Processing Centers"])


@me_router.get("/me")
async def my_center(staff: dict = Depends(get_current_pc_staff)):
    rows = _rows(
        supabase.table("processing_centers").select("*")
        .eq("id", staff["processing_center_id"]).limit(1).execute()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Processing centre not found.")
    return {"center": rows[0], "pc_role": staff["pc_role"]}
