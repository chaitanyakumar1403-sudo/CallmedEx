"""
Processing Center administration — CallMedex admin only.

Centres are created by CallMedex, never by self-signup. Deciding who becomes a
processing centre is a business decision, not a registration form.
"""
import logging
import uuid
from datetime import datetime, timezone
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
from app.utils.security import hash_password

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
    user_id: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    password: Optional[str] = None
    pc_role: str = "technician"


class PhleboBindIn(BaseModel):
    user_id: str


class AreaIn(BaseModel):
    city: Optional[str] = None
    pincode: Optional[str] = None
    radius_km: Optional[float] = None
    priority: int = 100


class AreaUpdateIn(BaseModel):
    city: Optional[str] = None
    pincode: Optional[str] = None
    radius_km: Optional[float] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


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
        staff_rows = _rows(
            supabase.table("processing_center_staff").select("*")
            .eq("processing_center_id", c["id"]).eq("is_active", True).execute()
        )
        if staff_rows:
            u_ids = [s["user_id"] for s in staff_rows if s.get("user_id")]
            if u_ids:
                try:
                    u_rows = _rows(supabase.table("users").select("id, full_name, email, mobile").in_("id", u_ids).execute())
                    u_map = {u["id"]: u for u in u_rows}
                    for s in staff_rows:
                        matched_u = u_map.get(s["user_id"], {})
                        s["users"] = matched_u
                        s["full_name"] = matched_u.get("full_name", "")
                        s["email"] = matched_u.get("email", "")
                        s["role"] = s.get("pc_role", "")
                except Exception as enrich_err:
                    logger.warning(f"Error enriching staff users: {enrich_err}")
        c["staff"] = staff_rows
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

    target_user_id = payload.user_id
    email = (payload.email or "").strip().lower()
    auto_created = False
    temp_password = None

    if not target_user_id and not email:
        raise HTTPException(status_code=400, detail="Either user_id or email is required.")

    if not target_user_id and email:
        existing = _rows(supabase.table("users").select("id, role, full_name, email").eq("email", email).limit(1).execute())
        if existing:
            target_user_id = existing[0]["id"]
            prior_role = existing[0].get("role") or ""
        else:
            # Auto-create user account for processing center staff/admin (No MOU required)
            target_user_id = str(uuid.uuid4())
            temp_password = payload.password or "CallMedex@2026"
            full_name = (payload.full_name or "").strip() or email.split("@")[0].replace(".", " ").title()
            now_iso = datetime.now(timezone.utc).isoformat()
            new_user = {
                "id": target_user_id,
                "email": email,
                "full_name": full_name,
                "mobile": payload.mobile or "",
                "role": "processing_center",
                "password_hash": hash_password(temp_password),
                "registration_status": "active",
                "is_active": True,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            supabase.table("users").insert(new_user).execute()
            auto_created = True
            prior_role = ""
    else:
        existing = _rows(supabase.table("users").select("id, role, full_name, email").eq("id", target_user_id).limit(1).execute())
        if not existing:
            raise HTTPException(status_code=404, detail="User not found.")
        prior_role = existing[0].get("role") or ""
        email = existing[0].get("email") or ""

    # Check if already in processing_center_staff for this centre
    existing_staff = _rows(
        supabase.table("processing_center_staff")
        .select("id, is_active, prior_role")
        .eq("processing_center_id", center_id)
        .eq("user_id", target_user_id)
        .limit(1)
        .execute()
    )
    if existing_staff:
        effective_prior = existing_staff[0].get("prior_role") or prior_role
        supabase.table("processing_center_staff").update({
            "pc_role": payload.pc_role,
            "is_active": True,
            "prior_role": effective_prior,
        }).eq("id", existing_staff[0]["id"]).execute()
    else:
        supabase.table("processing_center_staff").insert({
            "processing_center_id": center_id,
            "user_id": target_user_id,
            "pc_role": payload.pc_role,
            "is_active": True,
            "prior_role": prior_role,
        }).execute()

    supabase.table("users").update({"role": "processing_center"}).eq("id", target_user_id).execute()

    return {
        "ok": True,
        "user_id": target_user_id,
        "email": email,
        "pc_role": payload.pc_role,
        "auto_created": auto_created,
        "temporary_password": temp_password if auto_created else None,
        "message": f"Successfully assigned {payload.pc_role} role to {email}",
    }


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
    created = _rows(supabase.table("processing_center_areas").insert(body).execute())
    return {"ok": True, "area": created[0] if created else None}


@router.patch("/{center_id}/areas/{area_id}")
async def update_area(center_id: str, area_id: str, payload: AreaUpdateIn,
                      user: dict = Depends(get_current_user)):
    _require_admin(user)
    body = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "city" in body and body["city"]:
        body["city"] = body["city"].strip().lower()
    if not body:
        return {"ok": True}
    updated = _rows(
        supabase.table("processing_center_areas")
        .update(body)
        .eq("id", area_id)
        .eq("processing_center_id", center_id)
        .execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Service area not found.")
    return {"ok": True, "area": updated[0]}


@router.delete("/{center_id}/areas/{area_id}")
async def delete_area(center_id: str, area_id: str,
                      user: dict = Depends(get_current_user)):
    _require_admin(user)
    supabase.table("processing_center_areas") \
        .delete() \
        .eq("id", area_id) \
        .eq("processing_center_id", center_id) \
        .execute()
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
