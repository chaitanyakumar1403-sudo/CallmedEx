"""
Provider Scope of Services & Tariff Management Router
Supports Doctors, Dietitians, Physiotherapists, and Nurses.
Allows providers to view and update their scope of services and custom prices,
and allows patients to search active verified providers by specialty, modality, and district.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from app.models.schemas import APIResponse, ProviderScopeUpdateRequest, UserRole
from app.middleware.auth import get_current_user
from app.services.scope_catalogs import (
    get_master_catalog_for_role,
    sanitize_selected_scope,
    compute_commercial_split,
)
from app.database import supabase
from app.routers.auth import _local_profiles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/providers", tags=["Provider Scope & Directory"])

ROLE_TABLE_MAP = {
    "doctor": "doctors",
    "dietitian": "dietitians",
    "physiotherapist": "physiotherapists",
    "nurse": "nurses",
}


def _commercial_split() -> dict:
    """The MOU split, quoted from the one place that defines the fee.

    Every partner agreement fixes 20% platform / 80% provider. Restating the
    numbers here meant a provider could be shown a share that no longer matched
    what payment.py actually credited them.
    """
    from app.services.marketplace import PricingService

    fee_pct = PricingService.platform_fee_pct()
    return {
        "provider_share_pct": round(100.0 - fee_pct, 2),
        "platform_fee_pct": round(fee_pct, 2),
    }


@router.get("/catalog/{role}", response_model=APIResponse)
async def get_role_catalog(role: str):
    """Return the master reference service catalog and 80/20 fee benchmarks for a role."""
    catalog = get_master_catalog_for_role(role)
    return APIResponse(
        success=True,
        message=f"Master scope catalog for {role}",
        data={
            "role": role,
            "catalog": catalog,
            "commercial_split": _commercial_split(),
        },
    )


@router.get("/me/scope", response_model=APIResponse)
async def get_my_scope(current_user: dict = Depends(get_current_user)):
    """Fetch current provider's active scope of services, custom rates, and modalities."""
    role = current_user.get("role", "")
    table = ROLE_TABLE_MAP.get(role)
    if not table:
        raise HTTPException(status_code=400, detail=f"Role '{role}' does not have a scope catalog")

    profile: Optional[dict] = None
    if supabase:
        try:
            res = supabase.table(table).select("*").eq("user_id", current_user["sub"]).execute()
            if res.data:
                profile = res.data[0]
        except Exception as e:
            pass

    if not profile:
        # Check local fallback
        for p in _local_profiles.get(table, []):
            if p.get("user_id") == current_user["sub"]:
                profile = p
                break

    scope = profile.get("scope_of_services") if profile else None
    if not scope:
        # Default to master catalog
        scope = sanitize_selected_scope(role, [])

    return APIResponse(
        success=True,
        message="Active provider scope of services retrieved",
        data={
            "role": role,
            "scope_of_services": scope,
            "consultation_fee": profile.get("consultation_fee", 400.0) if profile else 400.0,
            "home_visit_fee": profile.get("home_visit_fee", 800.0) if profile else 800.0,
            "available_for_online": profile.get("available_for_online", True) if profile else True,
            "available_for_home_visit": profile.get("available_for_home_visit", True) if profile else True,
            "commercial_split": _commercial_split(),
        },
    )


@router.put("/me/scope", response_model=APIResponse)
async def update_my_scope(
    req: ProviderScopeUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update active services, modalities, and custom agreed tariffs with 80/20 calculation."""
    role = current_user.get("role", "")
    table = ROLE_TABLE_MAP.get(role)
    if not table:
        raise HTTPException(status_code=400, detail=f"Role '{role}' does not support scope updates")

    sanitized = sanitize_selected_scope(role, req.scope_of_services)
    update_data = {"scope_of_services": sanitized}

    if req.consultation_fee is not None:
        update_data["consultation_fee"] = max(0.0, float(req.consultation_fee))
    if req.home_visit_fee is not None:
        update_data["home_visit_fee"] = max(0.0, float(req.home_visit_fee))
    if req.available_for_online is not None:
        update_data["available_for_online"] = req.available_for_online
    if req.available_for_home_visit is not None:
        update_data["available_for_home_visit"] = req.available_for_home_visit

    if supabase:
        try:
            supabase.table(table).update(update_data).eq("user_id", current_user["sub"]).execute()
        except Exception as e:
            pass

    # Update local fallback
    for p in _local_profiles.get(table, []):
        if p.get("user_id") == current_user["sub"]:
            p.update(update_data)
            break

    return APIResponse(
        success=True,
        message="Scope of services and rates updated successfully",
        data={"updated_scope": sanitized, "fields_updated": list(update_data.keys())},
    )


@router.get("/search", response_model=APIResponse)
async def search_providers(
    role: str = Query(..., description="doctor, dietitian, physiotherapist, nurse"),
    modality: Optional[str] = Query(None, description="online, home, clinic"),
    district: Optional[str] = Query(None, description="Filter by district"),
    q: Optional[str] = Query(None, description="Search query by name or specialty"),
):
    """Search verified healthcare providers for patient booking.

    Only genuinely verified, real providers are returned. This endpoint used to
    fall back to a hardcoded roster of invented specialists ("Dr. Rajesh Varma,
    MPT", "Dt. Ananya Sharma, RD") whenever the table was empty, so a patient
    could book — and pay for — a consultation with a person who does not exist.
    An empty list is honest; a plausible fake is not recoverable once someone
    has booked against it. Same reasoning as the telemedicine doctor list.
    """
    table = ROLE_TABLE_MAP.get(role.lower())
    if not table:
        raise HTTPException(status_code=400, detail=f"Invalid provider role: {role}")

    if not supabase:
        return APIResponse(
            success=True,
            message="Provider directory unavailable",
            data={"providers": [], "count": 0},
        )

    providers = []
    try:
        query = (
            supabase.table(table)
            .select("*, users(full_name, city, state, district, mobile)")
            # A patient must never be offered someone the platform has not
            # verified — this filter was missing entirely.
            .eq("verification_status", "verified")
        )
        if modality == "online":
            query = query.eq("available_for_online", True)
        elif modality == "home":
            query = query.eq("available_for_home_visit", True)
        # "clinic" (walk-in) is not a column on the role tables — it is
        # expressed as an in_person availability block, so it is resolved
        # below against doctor_availability rather than silently ignored.

        res = query.execute()
        clinic_only_ids = None
        if modality == "clinic":
            clinic_only_ids = _providers_with_walkin_availability(
                [r.get("user_id") for r in (res.data or []) if r.get("user_id")]
            )

        for row in (res.data or []):
            u = row.get("users") or {}
            user_id = row.get("user_id")

            if clinic_only_ids is not None and user_id not in clinic_only_ids:
                continue

            # The district filter was accepted and then never applied, so
            # "physiotherapists in Visakhapatnam" quietly returned the whole
            # country.
            if district and district.strip().lower() not in (
                (u.get("district") or "").strip().lower()
            ):
                continue

            specialization = (
                row.get("specialization")
                or ", ".join(row.get("specializations") or [])
                or ""
            )
            full_name = u.get("full_name") or ""

            if q:
                haystack = f"{full_name} {specialization}".lower()
                if q.strip().lower() not in haystack:
                    continue

            providers.append({
                "id": row.get("id"),
                "user_id": user_id,
                "full_name": full_name or "Healthcare Specialist",
                "role": role,
                "specialization": specialization or "General Practice",
                "qualification": row.get("qualification", ""),
                "years_of_experience": row.get("years_of_experience", 0),
                "consultation_fee": row.get("consultation_fee"),
                "home_visit_fee": row.get("home_visit_fee"),
                # No invented 4.9. An unrated provider is unrated, and the UI
                # omits the badge rather than manufacturing trust.
                "rating": row.get("rating"),
                "total_reviews": row.get("total_reviews", 0),
                "city": u.get("city") or "",
                "district": u.get("district") or "",
                "state": u.get("state") or "",
                "available_for_online": row.get("available_for_online", False),
                "available_for_home_visit": row.get("available_for_home_visit", False),
                "clinic_center_name": row.get("clinic_center_name") or "",
                "scope_of_services": row.get("scope_of_services", []),
            })
    except Exception as e:
        logger.error(f"search_providers({role}) failed: {e}")
        raise HTTPException(
            status_code=503,
            detail="Could not load the provider directory. Please retry.",
        )

    return APIResponse(
        success=True,
        message=f"Found {len(providers)} verified {role} provider(s)",
        data={"providers": providers, "count": len(providers)},
    )


def _providers_with_walkin_availability(user_ids: List[str]) -> set:
    """User ids among *user_ids* that publish at least one active in-person
    (walk-in centre) availability block.

    Walk-in is not a flag on the role table — it exists only as an availability
    block the provider set up, which is exactly what the patient will be
    shown slots from.
    """
    if not user_ids or not supabase:
        return set()
    try:
        rows = (
            supabase.table("doctor_availability")
            .select("doctor_id")
            .in_("doctor_id", list({u for u in user_ids if u}))
            .eq("consultation_mode", "in_person")
            .eq("is_active", True)
            .execute()
        ).data or []
        return {r["doctor_id"] for r in rows if r.get("doctor_id")}
    except Exception as e:
        logger.warning(f"walk-in availability lookup failed: {e}")
        return set()
