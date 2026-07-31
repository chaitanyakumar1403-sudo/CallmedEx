"""
Home-service catalog — CallMedex owned.

Admin holds full CRUD. A Processing Center reads the catalog (it needs to know
this booking should have produced a lavender EDTA tube) but cannot change a
clinical definition or a price.

Patient-facing responses here carry NO centre identity. The price is resolved
against the caller's city behind the scenes.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import get_current_user
from app.middleware.pc_auth import get_current_pc_staff
from app.services.processing_center import check_coverage, resolve_center
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Home Services"])

# Never widen this. It is what keeps a laboratory out of a patient's browser.
PATIENT_FIELDS = (
    "id", "code", "name", "category", "service_kind", "description",
    "home_collection_available", "fasting_required", "fasting_hours",
    "preparation_instructions", "estimated_report_hours",
)


def _num(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


class HomeServiceIn(BaseModel):
    code: str
    name: str
    service_kind: str = "blood_test"
    category: str = "blood_test"
    description: str = ""
    base_price: float
    urgent_surcharge_override: Optional[float] = None
    home_collection_available: bool = True
    fasting_required: bool = False
    fasting_hours: int = 0
    preparation_instructions: str = ""
    estimated_report_hours: Optional[int] = None
    is_active: bool = True


class CityPriceIn(BaseModel):
    price: float
    is_active: bool = True


class AreaRequestIn(BaseModel):
    mobile: str
    city: str = ""
    pincode: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    requested_service_ids: List[str] = []


def price_for_city(home_service_id: str, processing_center_id: str) -> float:
    """The city override when one is active, otherwise the platform base price."""
    override = _rows(
        supabase.table("home_service_city_pricing")
        .select("price, is_active")
        .eq("home_service_id", home_service_id)
        .eq("processing_center_id", processing_center_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if override:
        return _num(override[0].get("price"))

    base = _rows(
        supabase.table("home_services")
        .select("base_price")
        .eq("id", home_service_id)
        .limit(1)
        .execute()
    )
    return _num(base[0].get("base_price")) if base else 0.0


def urgent_surcharge_for_service(home_service_id: str, base_price: float) -> float:
    """Per-service override when set, otherwise the platform-wide knob.

    Reuses PricingService.urgent_surcharge_for so operations keep tuning the
    default from platform_settings without a deploy. A 0.0 override means
    "no surcharge on this test", which is different from "not configured".
    """
    from app.services.marketplace import PricingService

    rows = _rows(
        supabase.table("home_services")
        .select("urgent_surcharge_override")
        .eq("id", home_service_id)
        .limit(1)
        .execute()
    )
    if rows:
        override = rows[0].get("urgent_surcharge_override")
        if override is not None:
            return _num(override)

    return PricingService.urgent_surcharge_for(base_price)


def soft_delete_home_service(home_service_id: str) -> dict:
    """Soft delete by default; hard delete only if nothing has ever booked it.

    Disabling a service must never affect a booking already placed against it,
    so history stays readable.
    """
    booked = _rows(
        supabase.table("booking_tests")
        .select("id")
        .eq("home_service_id", home_service_id)
        .limit(1)
        .execute()
    )
    if booked:
        supabase.table("home_services").update({"is_active": False}) \
            .eq("id", home_service_id).execute()
        return {"hard_deleted": False, "id": home_service_id}

    supabase.table("home_services").delete().eq("id", home_service_id).execute()
    return {"hard_deleted": True, "id": home_service_id}


def _require_admin(user: dict) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only.")
    return user


# ─── Admin ────────────────────────────────────────────────────────────────

@router.get("/admin/home-services")
async def list_all(user: dict = Depends(get_current_user)):
    _require_admin(user)
    return {"services": _rows(supabase.table("home_services").select("*").execute())}


@router.post("/admin/home-services")
async def create(payload: HomeServiceIn, user: dict = Depends(get_current_user)):
    _require_admin(user)
    body = payload.model_dump()
    body["created_by"] = user.get("sub")
    created = _rows(supabase.table("home_services").insert(body).execute())
    return {"service": created[0] if created else None}


@router.patch("/admin/home-services/{service_id}")
async def update(service_id: str, payload: dict, user: dict = Depends(get_current_user)):
    _require_admin(user)
    payload = dict(payload)
    payload["updated_by"] = user.get("sub")
    updated = _rows(
        supabase.table("home_services").update(payload).eq("id", service_id).execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Home service not found.")
    return {"service": updated[0]}


@router.delete("/admin/home-services/{service_id}")
async def delete(service_id: str, user: dict = Depends(get_current_user)):
    _require_admin(user)
    return soft_delete_home_service(service_id)


@router.put("/admin/home-services/{service_id}/pricing/{center_id}")
async def set_city_price(service_id: str, center_id: str, payload: CityPriceIn,
                         user: dict = Depends(get_current_user)):
    _require_admin(user)
    existing = _rows(
        supabase.table("home_service_city_pricing").select("id")
        .eq("home_service_id", service_id)
        .eq("processing_center_id", center_id).limit(1).execute()
    )
    body = {"price": payload.price, "is_active": payload.is_active,
            "updated_by": user.get("sub")}
    if existing:
        supabase.table("home_service_city_pricing").update(body) \
            .eq("id", existing[0]["id"]).execute()
    else:
        body.update({"home_service_id": service_id, "processing_center_id": center_id})
        supabase.table("home_service_city_pricing").insert(body).execute()
    return {"ok": True}


# ─── Processing centre (read-only) ────────────────────────────────────────

@router.get("/pc/home-services")
async def pc_catalog(staff: dict = Depends(get_current_pc_staff)):
    """The centre reads the catalog to verify tubes. It cannot change it."""
    services = _rows(
        supabase.table("home_services").select("*").eq("is_active", True).execute()
    )
    for svc in services:
        svc["price"] = price_for_city(svc["id"], staff["processing_center_id"])
    return {"services": services}


# ─── Patient ──────────────────────────────────────────────────────────────

@router.get("/home-services")
async def patient_search(city: Optional[str] = None, pincode: Optional[str] = None,
                         lat: Optional[float] = None, lng: Optional[float] = None,
                         district: Optional[str] = None,
                         q: Optional[str] = Query(default=None)):
    """Patient-facing search. The resolved centre is used for pricing and then
    discarded — it never appears in the response."""
    centre = resolve_center(city=city, pincode=pincode, lat=lat, lng=lng,
                            district=district)
    if centre is None:
        return {"serviceable": False, "services": []}

    services = _rows(
        supabase.table("home_services").select("*")
        .eq("is_active", True).eq("service_kind", "blood_test").execute()
    )
    if q:
        needle = q.strip().lower()
        services = [s for s in services
                    if needle in (s.get("name") or "").lower()
                    or needle in (s.get("code") or "").lower()]

    out = []
    for svc in services:
        item = {k: svc.get(k) for k in PATIENT_FIELDS}
        item["price"] = price_for_city(svc["id"], centre["id"])
        out.append(item)

    return {"serviceable": True, "services": out}


@router.get("/coverage")
async def coverage(city: Optional[str] = None, pincode: Optional[str] = None,
                   lat: Optional[float] = None, lng: Optional[float] = None,
                   district: Optional[str] = None):
    """Checked at the location step, before slots, address or payment."""
    return check_coverage(city=city, pincode=pincode, lat=lat, lng=lng,
                          district=district)


@router.post("/service-area-requests")
async def request_area(payload: AreaRequestIn):
    supabase.table("service_area_requests").insert(payload.model_dump()).execute()
    return {"ok": True}
