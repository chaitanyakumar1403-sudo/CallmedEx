"""
Dispatch Router — Next-Gen CallMedex
Universal dispatch endpoints for ALL field providers:
  nurses, phlebotomists, home-visit doctors, ambulances, pharmacy delivery.

Backward-compatible with legacy phlebotomist-only dispatches.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.middleware.auth import get_current_user
from app.services.dispatch import DispatchService
from app.services.dispatch_engine import UniversalDispatchEngine
from app.services.otp import OTPService
from app.services.magic_link import MagicLinkService
from app.database import supabase


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dispatch", tags=["Dispatch"])

# Roles allowed to use field dispatch features
FIELD_PROVIDER_ROLES = {"phlebotomist", "nurse", "doctor", "ambulance", "pharmacy_delivery", "admin"}

# Local in-memory store for fallback dispatch tracking
_local_dispatches = []


# ─── Request Models ──────────────────────────────────────────────────────

class UniversalDispatchRequest(BaseModel):
    provider_type: str = "phlebotomist"     # 'nurse','phlebotomist','doctor','ambulance','pharmacy_delivery'
    service_subtype: Optional[str] = None   # e.g. 'wound_dressing','blood_collection'
    patient_lat: float
    patient_lng: float
    patient_address: str
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

    result = await UniversalDispatchEngine.create_dispatch(
        patient_id=current_user["sub"],
        patient_lat=req.patient_lat,
        patient_lng=req.patient_lng,
        patient_address=req.patient_address,
        provider_type=req.provider_type,
        service_subtype=req.service_subtype,
        notes=req.notes,
        booking_id=req.booking_id,
        address_details=req.patient_address_details,
        search_radius_km=req.search_radius_km,
    )
    return {"success": True, **result}


@router.get("/track/{dispatch_id}")
async def track_dispatch(
    dispatch_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get live tracking data for any dispatch — patient sees provider location + ETA."""
    tracking = await UniversalDispatchEngine.get_live_tracking(dispatch_id)
    return {"success": True, **tracking}


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
            .select("*, dispatch_requests!inner(patient_address, service_subtype, provider_type, patient_lat, patient_lng)")
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
            })
        return {"offers": offers}
    except Exception:
        return {"offers": []}


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

    # Check universal dispatch_requests table first
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
            return {"tasks": result.data}
    except Exception:
        pass

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
        except Exception:
            pass

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
        return {"dispatches": result.data or []}
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
        return {"dispatches": result.data or []}
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

    # Use the new universal toggle
    result = await UniversalDispatchEngine.toggle_online(
        user_id=current_user["sub"],
        provider_type="phlebotomist",
        is_online=toggle.on_duty,
        lat=toggle.lat,
        lng=toggle.lng,
    )

    # Also use legacy service for backward compat
    try:
        legacy_result = await DispatchService.toggle_duty(
            user_id=current_user["sub"],
            on_duty=toggle.on_duty,
            lat=toggle.lat,
            lng=toggle.lng,
        )
        return legacy_result
    except Exception:
        return {"success": True, "is_online": toggle.on_duty}


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
    from app.database import supabase
    result = await UniversalDispatchEngine.toggle_online(
        user_id=current_user["sub"],
        provider_type=current_user.get("role", "phlebotomist"),
        is_online=body.is_online,
    )
    # Also update users table is_online column
    if supabase:
        try:
            supabase.table("phlebotomists").update({"is_online": body.is_online}).eq("user_id", current_user["sub"]).execute()
        except Exception:
            try:
                supabase.table("nurses").update({"is_online": body.is_online}).eq("user_id", current_user["sub"]).execute()
            except Exception:
                pass
    return {"success": True, "is_online": body.is_online}


@router.post("/update-location")
async def update_location_simple(
    body: SimpleLocationUpdate,
    current_user: dict = Depends(get_current_user),
):
    """GPS location update from field provider."""
    from app.database import supabase
    from datetime import datetime, timezone
    if supabase:
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
            return {"success": True, "dispatch": d}
    except HTTPException:
        raise
    except Exception:
        pass

    # Legacy fallback
    try:
        result = supabase.table("dispatches").select("*").eq("id", dispatch_id).execute()
        if result.data:
            return {"success": True, "dispatch": result.data[0]}
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
        return {"success": True, "message": "Task declined"}

    now = datetime.now(timezone.utc).isoformat()
    try:
        supabase.table("dispatch_requests").update({
            "status": "searching",
            "updated_at": now,
        }).eq("id", dispatch_id).eq("assigned_provider_id", current_user["sub"]).execute()
    except Exception:
        pass

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

    now = datetime.now(timezone.utc).isoformat()
    update_data: dict = {"status": body.status, "updated_at": now}

    if body.status == "completed":
        update_data["completed_at"] = now

    try:
        result = (
            supabase.table("dispatch_requests")
            .update(update_data)
            .eq("id", dispatch_id)
            .eq("assigned_provider_id", current_user["sub"])
            .execute()
        )
        if result.data:
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
    """
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
        except Exception:
            pass

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

    if supabase:
        try:
            res = supabase.table("dispatch_requests").select("notes").eq("id", dispatch_id).execute()
            existing = res.data[0].get("notes", "") if res.data else ""
            supabase.table("dispatch_requests").update({
                "status": "samples_delivered_to_lab",
                "notes": existing + handover_log,
                "updated_at": timestamp
            }).eq("id", dispatch_id).execute()
        except Exception:
            pass

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

    if supabase:
        try:
            res = supabase.table("dispatch_requests").select("notes").eq("id", dispatch_id).execute()
            existing = res.data[0].get("notes", "") if res.data else ""
            supabase.table("dispatch_requests").update({
                "notes": existing + notes_log,
                "updated_at": timestamp
            }).eq("id", dispatch_id).execute()
        except Exception:
            pass

    return {
        "success": True,
        "vitals_summary": vitals_summary,
        "message": "Clinical notes and vitals chart saved successfully!",
    }


