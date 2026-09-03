"""
Dispatch Router — Next-Gen CallMedex
Universal dispatch endpoints for ALL field providers:
  nurses, phlebotomists, home-visit doctors, ambulances, pharmacy delivery.

Backward-compatible with legacy phlebotomist-only dispatches.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.middleware.auth import get_current_user
from app.services.dispatch import DispatchService
from app.services.dispatch_engine import UniversalDispatchEngine
from app.services.otp import OTPService
from app.services.magic_link import MagicLinkService
from app.database import supabase
from app.utils.db_helpers import _rows


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dispatch", tags=["Dispatch"])

# Roles allowed to use field dispatch features
FIELD_PROVIDER_ROLES = {
    "phlebotomist", "nurse", "doctor", "ambulance", "pharmacy_delivery", "admin",
    # Both offer home visits, so both need the field-provider surfaces
    # (my-tasks, pending offers, duty toggle) like any other visiting provider.
    "dietitian", "physiotherapist",
}

# Local in-memory store for fallback dispatch tracking
_local_dispatches = []

# Columns that must never leave this router except through the dedicated,
# ownership-gated /{dispatch_id}/patient-otp endpoint. The OTP exists to prove
# the provider is physically present with the patient — if the provider (or
# an admin browsing the active-dispatch list) can read it back from any other
# endpoint, it stops proving anything.
_OTP_FIELDS = ("patient_otp", "verification_otp")


def _strip_otp_fields(rows):
    if isinstance(rows, dict):
        return {k: v for k, v in rows.items() if k not in _OTP_FIELDS}
    return [{k: v for k, v in r.items() if k not in _OTP_FIELDS} for r in (rows or [])]


def _require_own_dispatch(dispatch_id: str, current_user: dict) -> str:
    """Assert the caller is the provider assigned to this dispatch, and return
    its existing notes so the caller can append to them.

    Field-log endpoints append to a shared notes column keyed only by
    dispatch_id, so without this any provider could write a handover or a set
    of clinical vitals onto a stranger's visit record.
    """
    rows = _rows(
        supabase.table("dispatch_requests")
        .select("notes, assigned_provider_id")
        .eq("id", dispatch_id)
        .limit(1)
        .execute()
    )
    if not rows:
        raise HTTPException(404, "Dispatch not found.")
    if (
        rows[0].get("assigned_provider_id") != current_user["sub"]
        and current_user.get("role") != "admin"
    ):
        raise HTTPException(403, "This dispatch is not assigned to you.")
    return rows[0].get("notes") or ""


def _require_dispatch_party(dispatch_id: str, current_user: dict) -> None:
    """Assert the caller is the patient on this dispatch, the provider assigned
    to it, or an admin.

    Live tracking returns the patient's address plus the provider's name,
    mobile and current GPS fix. Without this check any authenticated account
    could walk dispatch ids and follow a stranger — or a lone field collector —
    around the city in real time.
    """
    rows = _rows(
        supabase.table("dispatch_requests")
        .select("patient_id, assigned_provider_id")
        .eq("id", dispatch_id)
        .limit(1)
        .execute()
    )
    if not rows:
        raise HTTPException(404, "Dispatch not found.")
    if current_user.get("role") == "admin":
        return
    row = rows[0]
    if current_user["sub"] not in (row.get("patient_id"), row.get("assigned_provider_id")):
        raise HTTPException(403, "Access denied.")


def _attach_slot_times(tasks):
    """Merge each task's booking slot_start/slot_id in place so the provider
    dashboard can show when a task is actually scheduled for, not just when
    it was accepted."""
    booking_ids = list({t["booking_id"] for t in tasks if t.get("booking_id")})
    if not booking_ids or not supabase:
        return
    try:
        b_res = (
            supabase.table("bookings")
            .select("id, slot_start, slot_id")
            .in_("id", booking_ids)
            .execute()
        )
    except Exception:
        return
    slots_by_booking = {b["id"]: b for b in (b_res.data or [])}
    for t in tasks:
        b = slots_by_booking.get(t.get("booking_id"))
        if b:
            t["slot_start"] = b.get("slot_start")
            t["slot_id"] = b.get("slot_id")


# ─── Request Models ──────────────────────────────────────────────────────

class UniversalDispatchRequest(BaseModel):
    provider_type: str = "phlebotomist"     # 'nurse','phlebotomist','doctor','ambulance','pharmacy_delivery'
    service_subtype: Optional[str] = None   # e.g. 'wound_dressing','blood_collection'
    patient_lat: float
    patient_lng: float
    patient_address: str
    priority: str = "normal"          # 'normal' | 'urgent'

    patient_address_details: Optional[dict] = None  # {house_number, landmark, floor}
    notes: str = ""
    booking_id: Optional[str] = None
    search_radius_km: float = 10.0


class OnlineToggle(BaseModel):
    provider_type: str = "phlebotomist"
    is_online: bool
    lat: Optional[float] = None
    lng: Optional[float] = None


class LocationUpdate(BaseModel):
    provider_type: str = "phlebotomist"
    lat: float
    lng: float
    heading: Optional[float] = None
    speed_kmh: Optional[float] = None


class StatusUpdate(BaseModel):
    status: str


class OfferResponse(BaseModel):
    accepted: bool


class OTPVerifyRequest(BaseModel):
    otp: str


class LabHandoverRequest(BaseModel):
    hub_name: str
    sample_barcodes: str
    temperature_status: str = "Cold Chain Maintained (2-8°C)"
    notes: Optional[str] = None


class ClinicalNotesRequest(BaseModel):
    blood_pressure: Optional[str] = None
    pulse_rate: Optional[str] = None
    temperature_f: Optional[str] = None
    spo2_percent: Optional[str] = None
    procedure_notes: str
    attachment_url: Optional[str] = None



# ═══════════════════════════════════════════════════════════════════════════
# PATIENT-FACING ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/request")
async def request_dispatch(
    req: UniversalDispatchRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Patient requests any type of home service.
    System auto-assigns nearest available provider within the search radius.
    Supports: nurse, phlebotomist, home-visit doctor, ambulance, pharmacy delivery.
    """
    if current_user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Only patients can request dispatch")

    now = datetime.now(timezone.utc).isoformat()
    booking_id = req.booking_id

    # If no booking_id supplied (e.g. on-demand nurse/home visit booking), create a booking record
    if not booking_id:
        booking_id = str(uuid.uuid4())
        service_type_map = {
            "nurse": "nurse_visit",
            "phlebotomist": "lab_collection",
            "doctor": "home_visit",
            "physiotherapist": "therapy_visit",
            "dietitian": "diet_consult",
            "ambulance": "ambulance_dispatch",
            "pharmacy_delivery": "pharmacy_delivery",
        }
        service_type = service_type_map.get(req.provider_type, f"{req.provider_type}_dispatch")

        booking_data = {
            "id": booking_id,
            "patient_id": current_user["sub"],
            "provider_type": req.provider_type,
            "service_type": service_type,
            "status": "confirmed",
            "notes": req.notes or f"On-demand {req.provider_type} request",
            "created_at": now,
            "updated_at": now,
        }
        if req.patient_lat is not None:
            booking_data["collection_lat"] = req.patient_lat
        if req.patient_lng is not None:
            booking_data["collection_lng"] = req.patient_lng
        if req.patient_address:
            booking_data["collection_address"] = req.patient_address
            booking_data["collection_city"] = (req.patient_address_details or {}).get("city", "")

        if supabase:
            try:
                supabase.table("bookings").insert(booking_data).execute()
            except Exception as e:
                # If provider_id NOT NULL constraint is enforced by legacy table schema, fallback with patient sub
                if "provider_id" in str(e).lower():
                    try:
                        booking_data["provider_id"] = current_user["sub"]
                        supabase.table("bookings").insert(booking_data).execute()
                    except Exception as inner_e:
                        logger.warning(f"Could not auto-create booking record fallback: {inner_e}")
                else:
                    logger.warning(f"Could not auto-create booking record: {e}")

    result = await UniversalDispatchEngine.create_dispatch(
        patient_id=current_user["sub"],
        patient_lat=req.patient_lat,
        patient_lng=req.patient_lng,
        patient_address=req.patient_address,
        provider_type=req.provider_type,
        service_subtype=req.service_subtype,
        notes=req.notes,
        booking_id=booking_id,
        address_details=req.patient_address_details,
        search_radius_km=req.search_radius_km,
        priority="urgent" if req.priority == "urgent" else "normal",
    )
    return {"success": True, "booking_id": booking_id, **result}


@router.get("/track/{dispatch_id}")
async def track_dispatch(
    dispatch_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get live tracking data for any dispatch — patient sees provider location + ETA."""
    if supabase:
        _require_dispatch_party(dispatch_id, current_user)
    tracking = await UniversalDispatchEngine.get_live_tracking(dispatch_id)
    return {"success": True, **tracking}


@router.get("/for-booking/{booking_id}")
async def get_dispatch_for_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Resolve the active dispatch_id for a booking the caller owns.

    Scheduled bookings only get a dispatch_requests row once the background
    scheduler creates it (see scheduled_dispatch.py), long after the
    patient's browser tab loaded — so the frontend can't rely on
    localStorage (only ever set at on-demand dispatch creation time) to
    find it. The patient dashboard polls this instead.
    """
    if not supabase:
        return {"success": True, "dispatch_id": None}

    booking = _rows(
        supabase.table("bookings").select("id, patient_id").eq("id", booking_id).execute()
    )
    if not booking or booking[0]["patient_id"] != current_user["sub"]:
        raise HTTPException(status_code=404, detail="Booking not found")

    active = _rows(
        supabase.table("dispatch_requests")
        .select("id")
        .eq("booking_id", booking_id)
        .in_("status", ["searching", "provider_notified", "provider_accepted", "en_route", "arrived", "in_progress"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return {"success": True, "dispatch_id": active[0]["id"] if active else None}


@router.get("/nearby")
async def find_nearby_providers(
    lat: float,
    lng: float,
    provider_type: str = "phlebotomist",
    radius_km: float = 10.0,
    current_user: dict = Depends(get_current_user),
):
    """Find available providers near a location (preview before booking)."""
    candidates = await UniversalDispatchEngine.find_nearby_providers(
        patient_lat=lat,
        patient_lng=lng,
        provider_type=provider_type,
        radius_km=radius_km,
    )
    return {
        "success": True,
        "count": len(candidates),
        "providers": candidates,
        "provider_type": provider_type,
        "search_radius_km": radius_km,
    }


# ═══════════════════════════════════════════════════════════════════════════
# PROVIDER-FACING ENDPOINTS (universal for all field providers)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/toggle-online")
async def toggle_online_status(
    toggle: OnlineToggle,
    current_user: dict = Depends(get_current_user),
):
    """Provider toggles online/offline status. Universal for all field provider types."""
    if current_user.get("role") not in FIELD_PROVIDER_ROLES:
        raise HTTPException(status_code=403, detail="Not a field provider")

    result = await UniversalDispatchEngine.toggle_online(
        user_id=current_user["sub"],
        provider_type=toggle.provider_type,
        is_online=toggle.is_online,
        lat=toggle.lat,
        lng=toggle.lng,
    )
    return {"success": True, **result}


@router.post("/location")
async def update_location(
    loc: LocationUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Update provider GPS location (called every 10-15s while online).
    Universal for all field provider types.
    """
    if current_user.get("role") not in FIELD_PROVIDER_ROLES:
        raise HTTPException(status_code=403, detail="Not a field provider")

    result = await UniversalDispatchEngine.update_provider_location(
        user_id=current_user["sub"],
        provider_type=loc.provider_type,
        lat=loc.lat,
        lng=loc.lng,
        heading=loc.heading,
        speed_kmh=loc.speed_kmh,
    )
    return {"success": True, **result}


@router.post("/respond/{offer_id}")
async def respond_to_offer(
    offer_id: str,
    response: OfferResponse,
    current_user: dict = Depends(get_current_user),
):
    """Provider accepts or rejects a dispatch offer."""
    if current_user.get("role") not in FIELD_PROVIDER_ROLES:
        raise HTTPException(status_code=403, detail="Not a field provider")

    result = await UniversalDispatchEngine.respond_to_offer(
        offer_id=offer_id,
        provider_id=current_user["sub"],
        accepted=response.accepted,
    )
    return result


@router.post("/status/{dispatch_id}")
async def update_dispatch_status(
    dispatch_id: str,
    update: StatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Update dispatch status through the universal lifecycle:
    provider_accepted → en_route → arrived → in_progress → completed
    (or → cancelled at any point)
    """
    if current_user.get("role") not in FIELD_PROVIDER_ROLES:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await UniversalDispatchEngine.update_status(
        dispatch_id=dispatch_id,
        new_status=update.status,
        provider_id=current_user["sub"],
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Update failed"))
    return result


@router.get("/offers/pending")
async def get_pending_offers(
    current_user: dict = Depends(get_current_user),
):
    """Get pending dispatch offers for the current provider."""
    if current_user.get("role") not in FIELD_PROVIDER_ROLES:
        raise HTTPException(status_code=403, detail="Not a field provider")

    from app.database import supabase
    if not supabase:
        return {"offers": []}

    try:
        result = (
            supabase.table("dispatch_offers")
            .select("*, dispatch_requests!inner(patient_address, service_subtype, provider_type, patient_lat, patient_lng, priority, notes)")
            .eq("provider_id", current_user["sub"])
            .eq("status", "pending")
            .order("offered_at", desc=True)
            .execute()
        )
        offers = []
        for o in result.data or []:
            dr = o.get("dispatch_requests", {})
            offers.append({
                "offer_id": o["id"],
                "dispatch_request_id": o["dispatch_request_id"],
                "patient_address": dr.get("patient_address", ""),
                "service_subtype": dr.get("service_subtype", ""),
                "provider_type": dr.get("provider_type", ""),
                "distance_km": o.get("distance_km", 0),
                "expires_at": o.get("expires_at", ""),
                "priority": dr.get("priority", "normal"),
                "notes": dr.get("notes", ""),
            })
        # Urgent first, then nearest. A provider scanning their inbox must not
        # have to hunt for the emergency among routine work.
        offers.sort(key=lambda x: (
            0 if x["priority"] == "urgent" else 1,
            x.get("distance_km") or 0,
        ))
        return {"offers": offers}
    except Exception as e:
        # An empty list here reads as "no work available" — the provider stops
        # looking and the offer expires unanswered. Surface the outage instead.
        logger.error(f"Failed to load pending offers for {current_user['sub']}: {e}")
        raise HTTPException(503, "Could not load your offers. Please retry.")


@router.get("/my-tasks")
async def get_my_tasks(
    current_user: dict = Depends(get_current_user),
):
    """Get active dispatch tasks assigned to the current provider (any type)."""
    if current_user.get("role") not in FIELD_PROVIDER_ROLES:
        raise HTTPException(status_code=403, detail="Not a field provider")

    from app.database import supabase
    if not supabase:
        return {"tasks": []}

    active_statuses = ["provider_accepted", "en_route", "arrived", "in_progress"]

    # Check universal dispatch_requests table first. A failure here is
    # remembered rather than swallowed: falling through to an empty list tells
    # the provider "you have no runs today" during an outage, which is how a
    # live collection gets missed.
    primary_error = None
    try:
        result = (
            supabase.table("dispatch_requests")
            .select("*")
            .eq("assigned_provider_id", current_user["sub"])
            .in_("status", active_statuses)
            .order("created_at", desc=True)
            .execute()
        )
        if result.data:
            tasks = _strip_otp_fields(result.data)
            _attach_slot_times(tasks)
            return {"tasks": tasks}
    except Exception as e:
        primary_error = e
        logger.error(f"my-tasks primary query failed for {current_user['sub']}: {e}")

    # Fallback: legacy phlebotomist dispatches
    if current_user.get("role") == "phlebotomist":
        try:
            phleb_result = supabase.table("phlebotomists").select("id").eq("user_id", current_user["sub"]).execute()
            if phleb_result.data:
                phleb_id = phleb_result.data[0]["id"]
                tasks_result = (
                    supabase.table("dispatches")
                    .select("*")
                    .eq("phlebotomist_id", phleb_id)
                    .in_("status", ["assigned", "en_route", "sample_collected"])
                    .order("created_at", desc=True)
                    .execute()
                )
                return {"tasks": tasks_result.data or []}
        except Exception as e:
            logger.error(f"my-tasks legacy fallback failed for {current_user['sub']}: {e}")
            primary_error = primary_error or e

    if primary_error is not None:
        raise HTTPException(503, "Could not load your tasks. Please retry.")

    return {"tasks": []}


# ═══════════════════════════════════════════════════════════════════════════
# ADMIN / DASHBOARD ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/active")
async def get_active_dispatches(
    current_user: dict = Depends(get_current_user),
):
    """Get all active dispatches (admin/org view)."""
    if current_user.get("role") not in ("admin", "organization"):
        raise HTTPException(status_code=403, detail="Not authorized")

    from app.database import supabase
    if not supabase:
        return {"dispatches": []}

    # Universal dispatch_requests
    try:
        result = (
            supabase.table("dispatch_requests")
            .select("*")
            .in_("status", ["searching", "provider_notified", "provider_accepted", "en_route", "arrived", "in_progress"])
            .order("created_at", desc=True)
            .execute()
        )
        return {"dispatches": _strip_otp_fields(result.data or [])}
    except Exception:
        pass

    # Legacy fallback
    try:
        result = (
            supabase.table("dispatches")
            .select("*")
            .in_("status", ["requested", "assigned", "en_route", "sample_collected"])
            .order("created_at", desc=True)
            .execute()
        )
        return {"dispatches": _strip_otp_fields(result.data or [])}
    except Exception:
        return {"dispatches": []}


# ═══════════════════════════════════════════════════════════════════════════
# LEGACY COMPAT: Keep old phlebotomist duty toggle working
# ═══════════════════════════════════════════════════════════════════════════

class LegacyDutyToggle(BaseModel):
    on_duty: bool
    lat: Optional[float] = None
    lng: Optional[float] = None


@router.post("/duty")
async def legacy_toggle_duty(
    toggle: LegacyDutyToggle,
    current_user: dict = Depends(get_current_user),
):
    """Legacy endpoint: Phlebotomist toggles on-duty/off-duty status."""
    if current_user.get("role") != "phlebotomist":
        raise HTTPException(status_code=403, detail="Only phlebotomists can toggle duty")

    # UniversalDispatchEngine.toggle_online already handles updating both
    # provider_locations (universal) and phlebotomists (legacy) tables.
    # No need for a second DispatchService call — that was a double write.
    result = await UniversalDispatchEngine.toggle_online(
        user_id=current_user["sub"],
        provider_type="phlebotomist",
        is_online=toggle.on_duty,
        lat=toggle.lat,
        lng=toggle.lng,
    )

    return result


# ═══════════════════════════════════════════════════════════════════════════
# PROVIDER ACTION ENDPOINTS (accept, reject, update-status, cancel)
# ═══════════════════════════════════════════════════════════════════════════

class DutyToggle(BaseModel):
    is_online: bool

class SimpleLocationUpdate(BaseModel):
    lat: float
    lng: float


@router.post("/toggle-duty")
async def toggle_duty_simple(
    body: DutyToggle,
    current_user: dict = Depends(get_current_user),
):
    """Simplified duty toggle for phlebotomist dashboard."""
    # toggle_online already mirrors the flag into provider_locations AND into the
    # legacy role table using each table's real column — phlebotomists.on_duty /
    # nurses.is_online. Duplicating that here wrote a non-existent
    # phlebotomists.is_online column, so the phlebotomist toggle silently no-op'd
    # while dispatch matching kept reading on_duty.
    await UniversalDispatchEngine.toggle_online(
        user_id=current_user["sub"],
        provider_type=current_user.get("role", "phlebotomist"),
        is_online=body.is_online,
    )
    return {"success": True, "is_online": body.is_online}


@router.post("/update-location")
async def update_location_simple(
    body: SimpleLocationUpdate,
    current_user: dict = Depends(get_current_user),
):
    """GPS location update from field provider.

    CRITICAL: Updates BOTH the universal provider_locations table (used by
    the dispatch engine's find_nearby_providers for candidate discovery)
    AND the legacy role table (phlebotomists/nurses). The primary query
    in find_nearby_providers reads provider_locations — if only the legacy
    table is updated, the phlebotomist is invisible to dispatch matching
    and never receives offers. This was the root cause of the recurring
    "phlebotomist doesn't get notified" bug.
    """
    from app.database import supabase
    from datetime import datetime, timezone
    import uuid as _uuid
    if supabase:
        now = datetime.now(timezone.utc).isoformat()
        role = current_user.get("role", "")

        # 1. Update universal provider_locations table — THE critical one for dispatch
        try:
            loc_result = supabase.table("provider_locations").update({
                "current_lat": body.lat,
                "current_lng": body.lng,
                "last_updated": now,
            }).eq("user_id", current_user["sub"]).execute()
            if not loc_result.data:
                # Insert if no existing record (first time going online)
                supabase.table("provider_locations").insert({
                    "id": str(_uuid.uuid4()),
                    "user_id": current_user["sub"],
                    "provider_type": role if role in ("phlebotomist", "nurse", "doctor") else "phlebotomist",
                    "is_online": True,
                    "current_lat": body.lat,
                    "current_lng": body.lng,
                    "last_updated": now,
                }).execute()
        except Exception as e:
            logger.warning(f"Failed to update provider_locations for {current_user['sub']}: {e}")

        # 2. Update legacy role-specific table (backward compat)
        try:
            supabase.table("phlebotomists").update({
                "current_lat": body.lat,
                "current_lng": body.lng,
            }).eq("user_id", current_user["sub"]).execute()
        except Exception:
            try:
                supabase.table("nurses").update({
                    "current_lat": body.lat,
                    "current_lng": body.lng,
                }).eq("user_id", current_user["sub"]).execute()
            except Exception:
                pass
    return {"success": True}


@router.get("/{dispatch_id}")
async def get_dispatch_by_id(
    dispatch_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a single dispatch record by ID — for patient tracking page."""
    from app.database import supabase
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        result = (
            supabase.table("dispatch_requests")
            .select("*")
            .eq("id", dispatch_id)
            .execute()
        )
        if result.data:
            d = result.data[0]
            # Verify access: only the patient or the assigned provider
            if d.get("patient_id") != current_user["sub"] and d.get("provider_id") != current_user["sub"] and d.get("assigned_provider_id") != current_user["sub"]:
                if current_user.get("role") != "admin":
                    raise HTTPException(403, "Access denied")
            # Even the assigned provider gets this row via the "or" above (they
            # need it for tracking) — but the OTP itself must stay behind the
            # dedicated /patient-otp endpoint's ownership check, not leak here.
            return {"success": True, "dispatch": _strip_otp_fields(d)}
    except HTTPException:
        raise
    except Exception:
        pass

    # Legacy fallback
    try:
        result = supabase.table("dispatches").select("*").eq("id", dispatch_id).execute()
        if result.data:
            return {"success": True, "dispatch": _strip_otp_fields(result.data[0])}
    except Exception:
        pass

    raise HTTPException(404, "Dispatch not found")


@router.post("/{dispatch_id}/accept")
async def accept_task(
    dispatch_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Provider accepts an incoming dispatch request."""
    if current_user.get("role") not in FIELD_PROVIDER_ROLES:
        raise HTTPException(403, "Not authorized")

    from app.database import supabase
    from datetime import datetime, timezone
    if not supabase:
        raise HTTPException(500, "Database not configured")

    now = datetime.now(timezone.utc).isoformat()
    try:
        result = (
            supabase.table("dispatch_requests")
            .update({
                "status": "provider_accepted",
                "assigned_provider_id": current_user["sub"],
                "assigned_at": now,
                "updated_at": now,
            })
            .eq("id", dispatch_id)
            .in_("status", ["pending", "searching", "provider_notified"])
            .execute()
        )
        if result.data:
            d_row = result.data[0]
            booking_id = d_row.get("booking_id")
            if booking_id:
                try:
                    supabase.table("bookings").update({
                        "status": "in_progress",
                        "provider_id": current_user["sub"],
                        "updated_at": now,
                    }).eq("id", booking_id).execute()
                except Exception as b_err:
                    logger.warning(f"Failed to sync booking on accept_task: {b_err}")
            return {"success": True, "message": "Task accepted. Head to the patient's location."}
        raise HTTPException(409, "Task already taken or not available")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to accept task: {e}")


@router.post("/{dispatch_id}/reject")
async def reject_task(
    dispatch_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Provider declines a dispatch request (it goes back to searching)."""
    from app.database import supabase
    from datetime import datetime, timezone
    if not supabase:
        raise HTTPException(503, "Database unavailable — decline not recorded. Please retry.")

    now = datetime.now(timezone.utc).isoformat()
    try:
        supabase.table("dispatch_requests").update({
            "status": "searching",
            "updated_at": now,
        }).eq("id", dispatch_id).eq("assigned_provider_id", current_user["sub"]).execute()
    except Exception as e:
        # Reporting "declined" on a failed write leaves the request still
        # assigned to this provider while they believe they are free of it,
        # so the job silently stalls until it expires.
        logger.error(f"Failed to record decline of dispatch {dispatch_id}: {e}")
        raise HTTPException(503, "Could not record the decline. Please retry.")

    return {"success": True, "message": "Task declined. You will receive the next available request."}


@router.post("/{dispatch_id}/update-status")
async def update_task_status_lifecycle(
    dispatch_id: str,
    body: StatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Provider updates task status along the workflow:
    assigned → en_route → arrived → in_progress → completed
    """
    if current_user.get("role") not in FIELD_PROVIDER_ROLES:
        raise HTTPException(403, "Not authorized")

    allowed_statuses = {"en_route", "arrived", "in_progress", "completed"}
    if body.status not in allowed_statuses:
        raise HTTPException(400, f"Invalid status. Must be one of: {allowed_statuses}")

    from app.database import supabase
    from datetime import datetime, timezone
    if not supabase:
        raise HTTPException(500, "Database not configured")

    # "in_progress" must never be reachable through this generic endpoint —
    # it is only granted by a successful OTP verification (see /verify-otp),
    # which is the arrival-proof control. Letting a provider set it directly
    # here (and therefore "completed" right after) would let a collection be
    # recorded without the patient ever confirming the provider showed up.
    if body.status == "in_progress":
        raise HTTPException(
            400,
            "in_progress can only be reached via OTP verification (/verify-otp), not update-status.",
        )

    PREREQUISITE_STATUS = {
        "en_route": {"provider_accepted", "en_route"},
        "arrived": {"en_route", "arrived"},
        "completed": {"in_progress", "completed"},
    }

    now = datetime.now(timezone.utc).isoformat()
    update_data: dict = {"status": body.status, "updated_at": now}

    if body.status == "arrived":
        update_data["arrived_at"] = now
    if body.status == "completed":
        update_data["completed_at"] = now

    try:
        current = (
            supabase.table("dispatch_requests")
            .select("status")
            .eq("id", dispatch_id)
            .eq("assigned_provider_id", current_user["sub"])
            .execute()
        )
        if not current.data:
            raise HTTPException(404, "Dispatch not found or not assigned to you")
        current_status = current.data[0].get("status")
        if current_status not in PREREQUISITE_STATUS.get(body.status, set()):
            raise HTTPException(
                409,
                f"Cannot move to '{body.status}' from '{current_status}'."
                + (" OTP verification is required first." if body.status == "completed" else ""),
            )

        result = (
            supabase.table("dispatch_requests")
            .update(update_data)
            .eq("id", dispatch_id)
            .eq("assigned_provider_id", current_user["sub"])
            .execute()
        )
        if result.data:
            # The patient's verification code is only ever produced here — the
            # arrival transition is its trigger. Without this call the patient
            # dashboard has nothing to show and the provider's /verify-otp
            # step can never succeed.
            if body.status == "arrived":
                OTPService.generate_otp(dispatch_id)
            if body.status == "completed":
                d_row = result.data[0]
                booking_id = d_row.get("booking_id")
                if booking_id:
                    try:
                        supabase.table("bookings").update({
                            "status": "completed",
                            "updated_at": now,
                        }).eq("id", booking_id).execute()
                    except Exception as b_err:
                        logger.warning(f"Failed to sync booking on completed: {b_err}")
            return {"success": True, "status": body.status, "message": f"Status updated to {body.status}"}
        raise HTTPException(404, "Dispatch not found or not assigned to you")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to update status: {e}")





@router.post("/{dispatch_id}/masked-call")
async def initiate_masked_call(
    dispatch_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Initiate a masked/proxy call between patient and provider.
    Returns a proxy number so real numbers stay private.
    """
    # In production: integrate Exotel/Twilio number masking
    # For now: return a simulated proxy number
    return {
        "success": True,
        "proxy_number": "+91-1800-CALLMEDEX",
        "message": "In production, this returns a real Exotel proxy number. Your phone number is never shared.",
    }


# ═══════════════════════════════════════════════════════════════════════════
# OTP VERIFICATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/{dispatch_id}/generate-otp")
async def generate_dispatch_otp(
    dispatch_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate OTP for a dispatch. Called automatically when provider status changes to 'arrived'.
    Can also be called manually by the provider to regenerate.
    """
    if current_user.get("role") not in FIELD_PROVIDER_ROLES:
        raise HTTPException(403, "Only field providers can generate OTP")

    otp = OTPService.generate_otp(dispatch_id)
    return {
        "success": True,
        "message": "OTP generated. Patient can see it on their tracking screen.",
        "otp_generated": True,
    }


@router.post("/{dispatch_id}/verify-otp")
async def verify_dispatch_otp(
    dispatch_id: str,
    body: OTPVerifyRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Provider submits OTP to verify identity before starting service.
    Patient gives the OTP verbally → provider enters it here.
    On success, dispatch status moves from 'arrived' to 'in_progress'.
    """
    if current_user.get("role") not in FIELD_PROVIDER_ROLES:
        raise HTTPException(403, "Only field providers can verify OTP")

    result = OTPService.verify_otp(dispatch_id, body.otp)
    if not result["success"]:
        raise HTTPException(400, result.get("error", "OTP verification failed"))

    # Auto-transition to in_progress on successful OTP verification
    try:
        status_result = await UniversalDispatchEngine.update_status(
            dispatch_id=dispatch_id,
            new_status="in_progress",
            provider_id=current_user["sub"],
        )
    except Exception as e:
        # OTP was verified but status update failed — still return success
        pass


    return {
        "success": True,
        "message": "OTP verified! Service can now begin.",
        "status": "in_progress",
    }


@router.get("/{dispatch_id}/patient-otp")
async def get_patient_otp(
    dispatch_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Patient endpoint: returns the OTP to display on their tracking screen.
    The patient tells this code verbally to the provider for verification.

    Only the owning patient (or an admin) may read this — the whole point of
    the OTP is that the assigned provider must NOT be able to look up their
    own arrival-verification answer.
    """
    if supabase:
        try:
            owner = (
                supabase.table("dispatch_requests")
                .select("patient_id")
                .eq("id", dispatch_id)
                .execute()
            )
            if owner.data:
                patient_id = owner.data[0].get("patient_id")
                if patient_id != current_user["sub"] and current_user.get("role") != "admin":
                    raise HTTPException(403, "Access denied")
        except HTTPException:
            raise
        except Exception:
            pass

    result = OTPService.get_patient_otp(dispatch_id)
    return result


# ═══════════════════════════════════════════════════════════════════════════
# MAGIC EMAIL UN-AUTHENTICATED ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

class MagicRespondRequest(BaseModel):
    action: str  # "accept" or "decline"
    token: str


@router.post("/magic-respond")
async def magic_respond(req: MagicRespondRequest):
    """
    Called by the lightweight frontend when a provider clicks the email link.
    Validates the magic JWT and assigns the task securely without a login session.
    """
    payload = MagicLinkService.decode_token(req.token)
    if not payload:
        raise HTTPException(status_code=400, detail="Link expired or invalid.")

    offer_id = payload["offer_id"]
    provider_id = payload["provider_id"]
    accepted = (req.action == "accept")

    # Atomic response using existing dispatch engine (which checks if already taken)
    result = await UniversalDispatchEngine.respond_to_offer(
        offer_id=offer_id,
        provider_id=provider_id,
        accepted=accepted
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to process response."))

    response_data = {
        "success": True,
        "message": "Accepted successfully" if accepted else "Declined successfully",
        "dispatch_id": result.get("dispatch_id")
    }

    # If accepted, give them a session token for just this task
    if accepted and result.get("dispatch_id"):
        task_token = MagicLinkService.generate_task_session_token(
            dispatch_id=result["dispatch_id"],
            provider_id=provider_id,
            expiration_hours=12
        )
        response_data["task_session_token"] = task_token
        
        # Also return patient info so frontend can draw Map immediately
        from app.database import supabase
        if supabase:
            dp_res = supabase.table("dispatch_requests").select("*").eq("id", result["dispatch_id"]).single().execute()
            if dp_res.data:
                response_data["patient_lat"] = dp_res.data.get("patient_lat")
                response_data["patient_lng"] = dp_res.data.get("patient_lng")
                response_data["patient_address"] = dp_res.data.get("patient_address")

    return response_data


class MagicStatusRequest(BaseModel):
    task_session_token: str
    status: str
    otp: Optional[str] = None


@router.post("/magic-status/{dispatch_id}")
async def magic_status(dispatch_id: str, req: MagicStatusRequest):
    """
    Allows a provider using the magic email flow to update status
    and verify OTPs without logging in. Uses the task_session_token.
    """
    payload = MagicLinkService.decode_task_session_token(req.task_session_token)
    if not payload or payload["dispatch_id"] != dispatch_id:
        raise HTTPException(status_code=401, detail="Invalid or expired task session.")

    provider_id = payload["provider_id"]

    if req.status == "in_progress":
        # They are submitting the OTP!
        if not req.otp:
            raise HTTPException(status_code=400, detail="OTP is required to start service.")
        otp_res = OTPService.verify_otp(dispatch_id, req.otp)
        if not otp_res["success"]:
            raise HTTPException(status_code=400, detail=otp_res.get("error", "Invalid OTP"))

    # Update the status securely
    result = await UniversalDispatchEngine.update_status(
        dispatch_id=dispatch_id,
        new_status=req.status,
        provider_id=provider_id
    )
    
    return {"success": True, "status": req.status}



@router.post("/{dispatch_id}/cancel")
async def cancel_dispatch(dispatch_id: str, current_user: dict = Depends(get_current_user)):
    """
    Cancel a dispatch request directly.
    Also cancels the associated booking if it exists.
    """
    user_id = current_user["sub"]
    from app.database import supabase
    from app.services.dispatch_engine import _local_dispatches

    dispatch = None
    if supabase:
        try:
            res = supabase.table("dispatch_requests").select("*").eq("id", dispatch_id).execute()
            if res.data:
                dispatch = res.data[0]
        except Exception:
            pass

    if not dispatch:
        dispatch = next((d for d in _local_dispatches if d.get("id") == dispatch_id), None)

    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch request not found")

    if dispatch.get("patient_id") and dispatch.get("patient_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this dispatch")

    current_status = dispatch.get("status", "searching")

    if current_status == "cancelled":
        return {"success": True, "message": "Request is already cancelled", "fee_applied": False}

    if current_status in ["completed", "arrived", "in_progress"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel a dispatch that is currently {current_status}")

    fee_applied = False
    if current_status in ["provider_accepted", "en_route"]:
        created_at_str = dispatch.get("created_at")
        if created_at_str:
            try:
                from datetime import datetime, timezone
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                elapsed_mins = (datetime.now(timezone.utc) - created_at).total_seconds() / 60
                if current_status == "en_route" or elapsed_mins > 5:
                    fee_applied = True
            except Exception:
                fee_applied = True

    # 1. Update dispatch in Supabase and memory fallback
    update_data = {"status": "cancelled"}
    dispatch["status"] = "cancelled"

    if supabase:
        try:
            supabase.table("dispatch_requests").update(update_data).eq("id", dispatch_id).execute()
        except Exception as e:
            # Telling the patient their visit is cancelled while the provider
            # is still dispatched and en route is worse than an honest error.
            logger.error(f"Failed to cancel dispatch {dispatch_id}: {e}")
            raise HTTPException(503, "Could not cancel the request. Please retry.")

    # 2. Cancel the associated booking if it exists
    booking_id = dispatch.get("booking_id")
    if booking_id:
        from datetime import datetime
        notes = "Cancelled by patient via dispatch tracker."
        if fee_applied:
            notes += " Cancellation fee applied."

        if supabase:
            try:
                b_res = supabase.table("bookings").select("*").eq("id", booking_id).execute()
                if b_res.data:
                    existing_notes = b_res.data[0].get("notes", "")
                    supabase.table("bookings").update({
                        "status": "cancelled",
                        "notes": existing_notes + f"\n[{datetime.now().isoformat()}] {notes}"
                    }).eq("id", booking_id).execute()

                    try:
                        from app.routers.bookings import _record_booking_history
                        _record_booking_history(booking_id, b_res.data[0].get("status"), "cancelled", changed_by=user_id, notes=notes)
                    except Exception:
                        pass
            except Exception:
                pass

    return {
        "success": True, 
        "message": f"Request cancelled successfully. {'A cancellation fee will be applied.' if fee_applied else 'No fee applied.'}",
        "fee_applied": fee_applied
    }


class EmergencySOSRequest(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = "Emergency Patient Location"
    note: Optional[str] = "1-Tap Emergency SOS Alert"


@router.post("/emergency-sos")
async def trigger_emergency_sos(
    req: EmergencySOSRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Industry-First 1-Tap Emergency SOS Dispatch Beacon:
    Broadcasts high-priority emergency beacon to all nearby doctors, nurses, and emergency transport network.
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    dispatch_id = f"sos_{str(uuid.uuid4())[:8]}"

    sos_data = {
        "id": dispatch_id,
        "patient_id": current_user["sub"],
        "provider_type": "doctor",
        "patient_lat": req.lat,
        "patient_lng": req.lng,
        "patient_address": req.address,
        "status": "searching",
        "notes": f"🚨 EMERGENCY SOS BEACON ({current_user.get('name', 'Patient')}): {req.note}",
        "created_at": now,
        "updated_at": now,
    }

    _local_dispatches.append(sos_data)

    if supabase:
        try:
            supabase.table("dispatch_requests").insert(sos_data).execute()
        except Exception as e:
            logger.warning(f"Failed to insert SOS dispatch in DB: {e}")

    # Generate 6-digit OTP
    otp = OTPService.generate_otp(dispatch_id)

    return {
        "success": True,
        "dispatch_id": dispatch_id,
        "status": "searching",
        "otp": otp,
        "message": "🚨 EMERGENCY BEACON BROADCASTED! Nearby emergency doctor and ambulance alerted.",
    }


@router.post("/{dispatch_id}/lab-handover")
async def lab_handover(
    dispatch_id: str,
    req: LabHandoverRequest,
    current_user: dict = Depends(get_current_user),
):
    """Phlebotomist registers blood sample drop-off / handover to Diagnostic Hub."""
    if current_user.get("role") not in ["phlebotomist", "admin"]:
        raise HTTPException(status_code=403, detail="Only phlebotomists can log lab drop-offs")

    timestamp = datetime.now(timezone.utc).isoformat()
    handover_log = f"\n🧪 LAB HANDOVER [{timestamp}]: Hub: {req.hub_name} | Barcodes: {req.sample_barcodes} | Temp: {req.temperature_status} | Notes: {req.notes or 'None'}"

    if not supabase:
        raise HTTPException(503, "Database unavailable — handover not recorded. Please retry.")

    try:
        existing = _require_own_dispatch(dispatch_id, current_user)
        # A handover the centre never sees breaks the chain of custody, so a
        # failed write must not be reported back as a completed drop-off.
        supabase.table("dispatch_requests").update({
            "status": "samples_delivered_to_lab",
            "notes": existing + handover_log,
            "updated_at": timestamp
        }).eq("id", dispatch_id).execute()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to record lab handover for dispatch {dispatch_id}: {e}")
        raise HTTPException(503, "Could not record the handover. Please retry.")

    return {
        "success": True,
        "status": "samples_delivered_to_lab",
        "message": f"Samples handed over to {req.hub_name}! Status updated to delivered to lab.",
    }


@router.post("/{dispatch_id}/clinical-notes")
async def record_clinical_notes(
    dispatch_id: str,
    req: ClinicalNotesRequest,
    current_user: dict = Depends(get_current_user),
):
    """Nurse records patient vitals chart and clinical notes upon finishing home visit."""
    if current_user.get("role") not in ["nurse", "admin"]:
        raise HTTPException(status_code=403, detail="Only nurses can submit clinical notes")

    timestamp = datetime.now(timezone.utc).isoformat()
    vitals_summary = f"BP: {req.blood_pressure or 'N/A'}, Pulse: {req.pulse_rate or 'N/A'} bpm, Temp: {req.temperature_f or 'N/A'}°F, SpO2: {req.spo2_percent or 'N/A'}%"
    notes_log = f"\n🩺 CLINICAL NOTES [{timestamp}]: Vitals: ({vitals_summary}) | Procedure: {req.procedure_notes}{f' | Attachment: {req.attachment_url}' if req.attachment_url else ''}"

    if not supabase:
        raise HTTPException(503, "Database unavailable — notes not saved. Please retry.")

    try:
        existing = _require_own_dispatch(dispatch_id, current_user)
        # Clinical notes silently dropped are lost care documentation.
        supabase.table("dispatch_requests").update({
            "notes": existing + notes_log,
            "updated_at": timestamp
        }).eq("id", dispatch_id).execute()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save clinical notes for dispatch {dispatch_id}: {e}")
        raise HTTPException(503, "Could not save the clinical notes. Please retry.")

    return {
        "success": True,
        "vitals_summary": vitals_summary,
        "message": "Clinical notes and vitals chart saved successfully!",
    }


class RateVisitRequest(BaseModel):
    stars: int
    comment: str = ""


@router.post("/{dispatch_id}/rate")
async def rate_visit(
    dispatch_id: str,
    body: RateVisitRequest,
    current_user: dict = Depends(get_current_user),
):
    """Patient rates the provider who attended their visit.

    This is where the stars shown on the tracking screens come from. Before
    it existed, `rating REAL DEFAULT 5.0` on the role tables was the only
    source and nothing ever wrote to it.
    """
    from app.services import ratings

    result = ratings.submit_rating(
        dispatch_id=dispatch_id,
        patient_user_id=current_user["sub"],
        stars=body.stars,
        comment=body.comment,
    )
    if not result["success"]:
        raise HTTPException(result.get("status", 400), result["error"])

    return {
        "success": True,
        "message": "Thanks — your rating has been recorded.",
        "summary": result["summary"],
    }


@router.get("/debug/booking/{booking_id}")
async def debug_dispatch_state(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Debug endpoint: show dispatch state for a booking. Admin only —
    it dumps whole dispatch rows plus provider names and email addresses."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if not supabase:
        return {"error": "No database"}
    try:
        dr = _rows(
            supabase.table("dispatch_requests")
            .select("*")
            .eq("booking_id", booking_id)
            .execute()
        )
        offers = []
        for d in dr:
            off = _rows(
                supabase.table("dispatch_offers")
                .select("*, users!inner(full_name, email)")
                .eq("dispatch_request_id", d["id"])
                .execute()
            )
            offers.extend(off)
        return {
            "booking_id": booking_id,
            "dispatch_requests": dr,
            "offers": offers,
            "dispatch_count": len(dr),
            "offer_count": len(offers),
        }
    except Exception as e:
        return {"error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════
# GUARDIAN LINK & TRUST HANDSHAKE (§8.2)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/track/{booking_id}/share")
async def share_guardian_link(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate a signed short-lived token for Guardian Link (§8.2).
    Allows family members to watch live field provider tracking, visit start/end,
    without requiring an account or app installation.
    """
    if not supabase:
        raise HTTPException(500, "Database unavailable.")

    user_id = current_user["sub"]
    role = current_user.get("role")

    # Verify ownership of booking
    b_rows = _rows(
        supabase.table("bookings")
        .select("id, patient_id, status")
        .eq("id", booking_id)
        .limit(1)
        .execute()
    )
    if not b_rows:
        raise HTTPException(404, "Booking not found.")

    booking = b_rows[0]
    if role != "admin" and booking.get("patient_id") != user_id:
        raise HTTPException(403, "Only the booking patient can generate a Guardian Link.")

    # Generate token
    token = MagicLinkService.generate_guardian_token(
        booking_id=booking_id,
        patient_id=booking.get("patient_id"),
        expiration_hours=12,
    )

    # Log to consent_records if table exists
    try:
        supabase.table("consent_records").insert({
            "patient_id": booking.get("patient_id"),
            "consent_type": "guardian_tracking_share",
            "purpose": "Live field tracking shared with family member via Guardian Link",
            "granted_to": "public_token_bearer",
            "granted_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat(),
            "is_active": True,
        }).execute()
    except Exception:
        pass

    return {
        "success": True,
        "token": token,
        "share_url": f"/track/{token}",
        "expires_in_hours": 12,
        "message": "Guardian Link generated successfully. Send this link to a family member.",
    }


@router.get("/public-track/{token}")
async def get_public_guardian_track(token: str):
    """
    Public live-tracking endpoint for Guardian Link (§8.2).
    Strict Leak Guard:
    - Never returns patient address, patient full name, or test names.
    - Only returns provider first name, coarse position, ETA minutes, and status.
    - Auto-expires 30 minutes after visit completion.
    """
    payload = MagicLinkService.decode_guardian_token(token)
    if not payload:
        raise HTTPException(401, "Tracking link is invalid or has expired.")

    booking_id = payload.get("booking_id")
    if not supabase or not booking_id:
        raise HTTPException(404, "Booking not found.")

    # 1. Fetch dispatch request
    dr_rows = _rows(
        supabase.table("dispatch_requests")
        .select(
            "id, status, assigned_provider_id, scheduled_time, completed_at, "
            "updated_at, estimated_eta_minutes, estimated_distance_km"
        )
        .eq("booking_id", booking_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not dr_rows:
        return {
            "success": True,
            "status": "scheduled",
            "provider_name": "Assigned Provider",
            "eta_minutes": None,
            "distance_km": None,
            "coarse_lat": None,
            "coarse_lng": None,
            "is_completed": False,
            "message": "Dispatch scheduled. Tracking will activate when the provider is en route.",
        }

    dispatch = dr_rows[0]
    status = dispatch.get("status", "searching")
    provider_id = dispatch.get("assigned_provider_id")

    # Expiry guard: visit completion + 30 minutes
    if status == "completed" and dispatch.get("completed_at"):
        try:
            completed_dt = datetime.fromisoformat(dispatch["completed_at"].replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - completed_dt).total_seconds() > 1800:
                raise HTTPException(410, "Tracking for this completed visit has expired.")
        except HTTPException:
            raise
        except Exception:
            pass

    # Provider first name, verification, rating and visit count — all read
    # from real records. A family member deciding whether to let this person
    # into the house must never be shown an invented 4.9★ / 120-jobs badge, so
    # anything without a source stays null and the page omits it.
    provider_first_name = "Health Specialist"
    provider_rating = None
    provider_jobs = None
    provider_verified = False
    if provider_id:
        from app.services import ratings as _ratings

        summary = _ratings.get_summary(provider_id)
        provider_rating = summary["average_stars"]
        provider_jobs = _ratings.completed_visit_count(provider_id)
    if provider_id:
        try:
            u_rows = _rows(
                supabase.table("users")
                .select("full_name, verification_status")
                .eq("id", provider_id).limit(1).execute()
            )
            if u_rows:
                if u_rows[0].get("full_name"):
                    provider_first_name = u_rows[0]["full_name"].split()[0]
                provider_verified = u_rows[0].get("verification_status") == "verified"
        except Exception as e:
            logger.warning(f"Guardian track: could not load provider {provider_id}: {e}")

    # Fetch provider location (coarse only: 2 decimals = ~1km accuracy)
    coarse_lat, coarse_lng = None, None
    if provider_id:
        try:
            loc_rows = _rows(supabase.table("provider_locations").select("current_lat, current_lng").eq("user_id", provider_id).limit(1).execute())
            if loc_rows and loc_rows[0].get("current_lat") is not None:
                raw_lat = float(loc_rows[0]["current_lat"])
                raw_lng = float(loc_rows[0]["current_lng"])
                coarse_lat = round(raw_lat, 2)
                coarse_lng = round(raw_lng, 2)
        except Exception:
            pass

    # ETA/distance: zero once the provider is on site, otherwise whatever the
    # dispatch row actually estimated. A made-up "12 min / 3.2 km" that never
    # moves is worse than showing nothing to someone waiting at the door.
    if status in ("arrived", "in_progress", "completed"):
        eta_minutes = 0
        distance_km = 0.0
    else:
        eta_minutes = dispatch.get("estimated_eta_minutes")
        distance_km = dispatch.get("estimated_distance_km")

    return {
        "success": True,
        "status": status,
        "provider": {
            "first_name": provider_first_name,
            "rating": provider_rating,
            "completed_jobs": provider_jobs,
            "verified": provider_verified,
        },
        "eta_minutes": eta_minutes,
        "distance_km": distance_km,
        "coarse_lat": coarse_lat,
        "coarse_lng": coarse_lng,
        "is_completed": status == "completed",
    }



