"""
Processing Center administration — CallMedex admin only.

Centres are created by CallMedex, never by self-signup. Deciding who becomes a
processing centre is a business decision, not a registration form.
"""
import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

# Real lab systems a processing centre can run — excludes report_jobs-only
# connector values (future_connector, patient_upload) that aren't a centre's
# own lab software.
LAB_CONNECTOR_TYPES = ("mocdoc", "crelio", "cloudlims", "manual")

from app.database import supabase
from app.middleware.auth import get_current_user
from app.middleware.pc_auth import get_current_pc_staff
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/processing-centers", tags=["Processing Centers"])


def _require_admin(user: dict) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only.")
    return user


def _ensure_primary_area(center: dict) -> None:
    """Provision the centre's home city as its primary service area, once.

    Centres created before areas were auto-inserted have zero area rows: they
    show ACTIVE in the admin panel yet resolve no coverage, which is exactly
    the "patient told no partner in an active centre's city" bug. Any existing
    row — even an inactive one — means an admin has taken over area management
    by hand, so this never adds to or revives their configuration.
    """
    try:
        existing = _rows(
            supabase.table("processing_center_areas").select("id")
            .eq("processing_center_id", center["id"]).limit(1).execute()
        )
        if existing:
            return
        supabase.table("processing_center_areas").insert({
            "processing_center_id": center["id"],
            "city": str(center.get("city") or "").strip().lower(),
            "pincode": center.get("pincode") or "",
            "priority": 100,
            "is_active": True,
        }).execute()
        logger.info(f"Auto-provisioned primary service area for centre {center.get('code')}")
    except Exception as e:
        logger.warning(f"Primary-area provisioning failed for centre {center.get('code')}: {e}")


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
    status: str = "active"
    lab_connector_type: Literal["mocdoc", "crelio", "cloudlims", "manual"] = "mocdoc"


class StaffIn(BaseModel):
    user_id: str
    pc_role: str = "technician"


class PhleboBindIn(BaseModel):
    user_id: str


class AreaIn(BaseModel):
    city: Optional[str] = None
    pincode: Optional[str] = None
    radius_km: Optional[float] = None
    priority: int = 100


@router.post("")
async def create_center(payload: CenterIn, user: dict = Depends(get_current_user)):
    _require_admin(user)
    body = payload.model_dump()
    code = body["code"].strip().upper()
    name = body["name"].strip()
    city = body["city"].strip().lower()

    # Check if center with same code or same name & city already exists
    existing = _rows(
        supabase.table("processing_centers")
        .select("id, code, name, city")
        .execute()
    )
    for ext in existing:
        ext_code = str(ext.get("code", "")).strip().upper()
        ext_name = str(ext.get("name", "")).strip().lower()
        ext_city = str(ext.get("city", "")).strip().lower()
        if ext_code == code:
            raise HTTPException(status_code=400, detail=f"Processing Centre with code '{code}' already exists.")
        if ext_name == name.lower() and ext_city == city:
            raise HTTPException(status_code=400, detail=f"Processing Centre '{name}' in {city.title()} already exists.")

    body["code"] = code
    body["name"] = name
    body["city"] = city
    body["status"] = "active"
    body["created_by"] = user.get("sub")
    created = _rows(supabase.table("processing_centers").insert(body).execute())

    if created:
        # Auto-create primary city as first service area
        _ensure_primary_area(created[0])

    return {"center": created[0] if created else None}


@router.get("")
async def list_centers(user: dict = Depends(get_current_user)):
    _require_admin(user)
    centers = _rows(supabase.table("processing_centers").select("*").execute())
    # Attach staff and areas for each centre
    for c in centers:
        # Heal legacy centres that predate area auto-provisioning (no-op when
        # any area row exists), so an ACTIVE centre never silently covers
        # nothing. Without this the panel showed "Service Areas (0)" while
        # patients in the centre's own city were told no partner covers them.
        _ensure_primary_area(c)
        c["staff"] = _rows(
            supabase.table("processing_center_staff").select("*")
            .eq("processing_center_id", c["id"]).eq("is_active", True).execute()
        )
        c["areas"] = _rows(
            supabase.table("processing_center_areas").select("*")
            .eq("processing_center_id", c["id"]).eq("is_active", True).execute()
        )
        # Phlebos bound to this centre — the exact set dispatch will offer
        # this centre's home-collection bookings to (dispatch_engine's
        # centre-bound candidate filter). A phlebo with no binding at all is
        # silently excluded from every offer for every centre.
        c["phlebotomists"] = _rows(
            supabase.table("phlebotomists")
            .select("user_id, on_duty, verification_status, users!phlebotomists_user_id_fkey!inner(id, full_name, email)")
            .eq("processing_center_id", c["id"]).execute()
        )
    return {"centers": centers}


@router.delete("/deduplicate")
async def deduplicate_centers(user: dict = Depends(get_current_user)):
    _require_admin(user)
    centers = _rows(supabase.table("processing_centers").select("*").execute())
    seen = {}
    removed_count = 0
    for c in centers:
        key = (c.get("code", "").strip().upper(), c.get("name", "").strip().lower(), c.get("city", "").strip().lower())
        if key in seen:
            # Delete duplicate center
            c_id = c["id"]
            supabase.table("processing_center_staff").delete().eq("processing_center_id", c_id).execute()
            supabase.table("processing_center_areas").delete().eq("processing_center_id", c_id).execute()
            supabase.table("processing_centers").delete().eq("id", c_id).execute()
            removed_count += 1
        else:
            seen[key] = c["id"]
    return {"ok": True, "removed": removed_count}


@router.patch("/{center_id}")
async def update_center(center_id: str, payload: dict,
                        user: dict = Depends(get_current_user)):
    _require_admin(user)
    if "city" in payload and payload["city"]:
        payload["city"] = str(payload["city"]).strip().lower()
    if "lab_connector_type" in payload and payload["lab_connector_type"] not in LAB_CONNECTOR_TYPES:
        raise HTTPException(status_code=400, detail=f"lab_connector_type must be one of {LAB_CONNECTOR_TYPES}")
    updated = _rows(
        supabase.table("processing_centers").update(payload).eq("id", center_id).execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Processing centre not found.")
    return {"center": updated[0]}


@router.delete("/{center_id}")
async def delete_center(center_id: str, user: dict = Depends(get_current_user)):
    _require_admin(user)
    # Clean up associated staff and areas
    supabase.table("processing_center_staff").delete().eq("processing_center_id", center_id).execute()
    supabase.table("processing_center_areas").delete().eq("processing_center_id", center_id).execute()
    deleted = _rows(supabase.table("processing_centers").delete().eq("id", center_id).execute())
    return {"ok": True, "deleted": len(deleted)}


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


@router.post("/{center_id}/phlebotomists")
async def bind_phlebotomist(center_id: str, payload: PhleboBindIn,
                             user: dict = Depends(get_current_user)):
    """Bind a phlebotomist to this centre so home-collection dispatch for the
    centre's bookings actually includes them as a candidate. Without this
    binding a phlebo is silently excluded from every offer for the centre —
    see dispatch_engine.find_nearby_providers' centre-bound filter."""
    _require_admin(user)
    existing = _rows(
        supabase.table("phlebotomists").select("id")
        .eq("user_id", payload.user_id).limit(1).execute()
    )
    if not existing:
        raise HTTPException(status_code=404, detail="No phlebotomist profile for this user.")
    supabase.table("phlebotomists").update({"processing_center_id": center_id}) \
        .eq("user_id", payload.user_id).execute()
    return {"ok": True}


@router.delete("/{center_id}/phlebotomists/{user_id}")
async def unbind_phlebotomist(center_id: str, user_id: str,
                               user: dict = Depends(get_current_user)):
    _require_admin(user)
    supabase.table("phlebotomists").update({"processing_center_id": None}) \
        .eq("user_id", user_id).eq("processing_center_id", center_id).execute()
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
