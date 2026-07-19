"""
Bookings Router — Next-Gen CallMedex
Slot-based booking for diagnostic services + universal service types.
Includes booking history audit trail for every status change.
"""
import uuid
import logging
from datetime import datetime, timezone, date, time, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from app.models.schemas import (
    BookingCreate, BookingResponse, SlotResponse, APIResponse,
    BookingStatus, ServiceType
)
from app.middleware.auth import get_current_user
from app.database import supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


def _record_booking_history(
    booking_id: str,
    old_status: str,
    new_status: str,
    changed_by: str = None,
    notes: str = "",
):
    """Record a status change to the booking_history table for audit."""
    record = {
        "id": str(uuid.uuid4()),
        "booking_id": booking_id,
        "old_status": old_status,
        "new_status": new_status,
        "changed_by": changed_by,
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if supabase:
        try:
            supabase.table("booking_history").insert(record).execute()
        except Exception as e:
            logger.warning(f"Failed to record booking history: {e}")
    logger.info(f"Booking {booking_id}: {old_status} → {new_status}")

# ─── In-memory stores for local dev ──────────────────────────────────────
_local_slots = []
_local_bookings = []


def _init_demo_slots():
    """Generate demo slots for local dev if empty."""
    if _local_slots:
        return
    # Generate 7 days of slots for 2 demo providers
    providers = [
        {"id": "org-demo-1", "type": "organization", "name": "Vizag Diagnostics Center"},
        {"id": "org-demo-2", "type": "organization", "name": "Apollo Health Hub"},
    ]
    base_date = date.today()
    for provider in providers:
        for day_offset in range(7):
            slot_date = base_date + timedelta(days=day_offset)
            for hour in [8, 9, 10, 11, 14, 15, 16, 17]:
                _local_slots.append({
                    "id": str(uuid.uuid4()),
                    "provider_id": provider["id"],
                    "provider_type": provider["type"],
                    "provider_name": provider["name"],
                    "date": slot_date.isoformat(),
                    "start_time": f"{hour:02d}:00:00",
                    "end_time": f"{hour:02d}:30:00",
                    "is_available": True,
                    "capacity": 3,
                })


@router.get("/slots", response_model=APIResponse)
async def get_available_slots(
    provider_id: Optional[str] = None,
    date_str: Optional[str] = Query(None, alias="date"),
    service_type: Optional[str] = None,
):
    """Get available booking slots, optionally filtered by provider and date."""
    if supabase:
        query = supabase.table("slots").select("*").eq("is_available", True)
        if provider_id:
            query = query.eq("provider_id", provider_id)
        if date_str:
            query = query.eq("date", date_str)
        result = query.execute()
        return APIResponse(success=True, message="Available slots", data={"slots": result.data})

    # Local fallback with demo data
    _init_demo_slots()
    filtered = [s for s in _local_slots if s["is_available"]]
    if provider_id:
        filtered = [s for s in filtered if s["provider_id"] == provider_id]
    if date_str:
        filtered = [s for s in filtered if s["date"] == date_str]

    return APIResponse(
        success=True,
        message="Available slots",
        data={"slots": filtered}
    )


@router.post("", response_model=APIResponse)
async def create_booking(
    booking: BookingCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new booking for the authenticated patient."""
    if current_user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Only patients can create bookings")

    booking_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # The frontend sends slot_id as "provider_id|date|time" (e.g. "org-demo-1|2026-07-15|09:00")
    # Parse it to build the booking record
    slot_parts = booking.slot_id.split("|")
    if len(slot_parts) == 3:
        slot_provider, slot_date, slot_time = slot_parts
        slot_start = f"{slot_date}T{slot_time}:00"
        hour = int(slot_time.split(":")[0])
        slot_end = f"{slot_date}T{hour:02d}:30:00"
    else:
        # Fallback: try to find in local slots by UUID
        slot = None
        _init_demo_slots()
        slot = next((s for s in _local_slots if s["id"] == booking.slot_id), None)
        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found")
        slot_start = f"{slot['date']}T{slot['start_time']}"
        slot_end = f"{slot['date']}T{slot['end_time']}"

    # Prevent double-booking: same user, same slot
    conflict = False
    if supabase:
        try:
            # Checking using slot_start string instead of slot_id to avoid UUID error
            existing = supabase.table("bookings").select("id").eq("patient_id", current_user["sub"]).eq("slot_start", slot_start).execute()
            if existing.data:
                conflict = True
        except Exception:
            pass # Fallback to local

    if not conflict:
        for b in _local_bookings:
            if b["patient_id"] == current_user["sub"] and b.get("slot_start") == slot_start:
                conflict = True
                break

    if conflict:
        raise HTTPException(status_code=409, detail="You have already booked this slot. Please choose a different time.")

    booking_data = {
        "id": booking_id,
        "patient_id": current_user["sub"],
        "provider_id": booking.provider_id,
        "provider_type": booking.provider_type,
        "service_type": booking.service_type.value,
        "slot_id": booking.slot_id,
        "slot_start": slot_start,
        "slot_end": slot_end,
        "status": BookingStatus.CONFIRMED.value,
        "notes": booking.notes or "",
        "selected_tests": booking.selected_tests or [],
        "total_price": booking.total_price or 0,
        "created_at": now,
    }

    if supabase:
        try:
            supabase.table("bookings").insert(booking_data).execute()
        except Exception as e:
            print(f"Supabase insert failed, falling back to local: {e}")
            _local_bookings.append(booking_data)
    else:
        _local_bookings.append(booking_data)

    return APIResponse(
        success=True,
        message="Booking confirmed",
        data=booking_data
    )


@router.get("/my", response_model=APIResponse)
async def get_my_bookings(current_user: dict = Depends(get_current_user)):
    """Get all bookings for the authenticated user."""
    user_id = current_user["sub"]

    supabase_bookings = []
    if supabase:
        try:
            result = (
                supabase.table("bookings")
                .select("*")
                .eq("patient_id", user_id)
                .order("created_at", desc=True)
                .execute()
            )
            supabase_bookings = result.data
        except Exception as e:
            print(f"Supabase read failed, falling back to local: {e}")

    # Combine Local fallback and Supabase
    user_bookings = [b for b in _local_bookings if b["patient_id"] == user_id]
    
    # Merge avoiding duplicates (prefer Supabase)
    merged = {b["id"]: b for b in user_bookings}
    for sb in supabase_bookings:
        merged[sb["id"]] = sb
        
    sorted_bookings = sorted(merged.values(), key=lambda x: x.get("created_at", ""), reverse=True)

    return APIResponse(
        success=True,
        message="Your bookings",
        data={"bookings": sorted_bookings}
    )


@router.patch("/{booking_id}/status", response_model=APIResponse)
async def update_booking_status(
    booking_id: str,
    status: BookingStatus,
    current_user: dict = Depends(get_current_user),
):
    """Update booking status (confirm, cancel, complete)."""
    # Get old status for history
    old_status = "unknown"
    if supabase:
        try:
            old_result = supabase.table("bookings").select("status").eq("id", booking_id).execute()
            if old_result.data:
                old_status = old_result.data[0].get("status", "unknown")
        except Exception:
            pass

    if supabase:
        try:
            result = (
                supabase.table("bookings")
                .update({"status": status.value, "updated_at": datetime.now(timezone.utc).isoformat()})
                .eq("id", booking_id)
                .execute()
            )
            if not result.data:
                raise HTTPException(status_code=404, detail="Booking not found")
            _record_booking_history(booking_id, old_status, status.value, current_user.get("sub"))
            return APIResponse(success=True, message=f"Booking {status.value}", data=result.data[0])
        except HTTPException:
            raise
        except Exception as e:
            print(f"Supabase update failed, falling back to local: {e}")

    # Local fallback
    for b in _local_bookings:
        if b["id"] == booking_id:
            old_status = b.get("status", "unknown")
            b["status"] = status.value
            _record_booking_history(booking_id, old_status, status.value, current_user.get("sub"))
            return APIResponse(success=True, message=f"Booking {status.value}", data=b)

    raise HTTPException(status_code=404, detail="Booking not found")


@router.get("/health-packages", response_model=APIResponse)
async def get_health_packages():
    """Get all available health packages."""
    if supabase:
        result = supabase.table("health_packages").select("*").execute()
        return APIResponse(success=True, message="Health packages", data={"packages": result.data})

    # Demo packages for local dev
    demo_packages = [
        {
            "id": "pkg-1",
            "name": "Basic Health Checkup",
            "description": "Complete blood count, blood sugar, lipid profile, thyroid, liver & kidney function",
            "tests_included": ["CBC", "Fasting Blood Sugar", "Lipid Profile", "Thyroid Profile", "LFT", "KFT", "Urine Routine"],
            "price": 799,
            "organization_name": "Vizag Diagnostics Center",
        },
        {
            "id": "pkg-2",
            "name": "Comprehensive Wellness Panel",
            "description": "Full-body screening with 60+ parameters including cardiac, diabetic, and vitamin markers",
            "tests_included": ["CBC", "HbA1c", "Lipid Profile", "Thyroid Profile", "LFT", "KFT", "Vitamin D", "Vitamin B12", "Iron Studies", "Uric Acid", "Calcium", "ECG"],
            "price": 1999,
            "organization_name": "Vizag Diagnostics Center",
        },
        {
            "id": "pkg-3",
            "name": "Cardiac Risk Assessment",
            "description": "Specialized cardiac markers with ECG and advanced lipid analysis",
            "tests_included": ["Lipid Profile Advanced", "hs-CRP", "Homocysteine", "ECG", "Troponin T", "BNP"],
            "price": 2499,
            "organization_name": "Apollo Health Hub",
        },
        {
            "id": "pkg-4",
            "name": "Diabetic Care Package",
            "description": "Complete diabetic monitoring with HbA1c, fasting/PP sugar, kidney function, and eye screening referral",
            "tests_included": ["HbA1c", "Fasting Blood Sugar", "Post-Prandial Sugar", "KFT", "Urine Microalbumin", "Lipid Profile"],
            "price": 1299,
            "organization_name": "Apollo Health Hub",
        },
        {
            "id": "pkg-5",
            "name": "Women's Wellness Package",
            "description": "Comprehensive screening tailored for women including hormonal, thyroid, and anemia panels",
            "tests_included": ["CBC", "Thyroid Profile", "Iron Studies", "Vitamin D", "Vitamin B12", "Calcium", "FSH", "LH", "Prolactin", "Pap Smear Referral"],
            "price": 2299,
            "organization_name": "Vizag Diagnostics Center",
        },
    ]
    return APIResponse(success=True, message="Health packages", data={"packages": demo_packages})


# ─── Staff Endpoints ─────────────────────────────────────────────────────

def _get_staff_profile(user_id: str) -> dict | None:
    """Get staff profile with linked_organization_id."""
    if supabase:
        try:
            result = supabase.table("staff").select("*").eq("user_id", user_id).execute()
            if result.data:
                return result.data[0]
        except Exception as e:
            print(f"Supabase staff lookup failed: {e}")

    # Local fallback
    from app.routers.auth import _local_profiles
    if "staff" in _local_profiles:
        for profile in _local_profiles["staff"]:
            if profile["user_id"] == user_id:
                return profile
    return None


def _get_org_profile(user_id: str) -> dict | None:
    """Get organization profile for an org admin."""
    if supabase:
        try:
            result = supabase.table("organizations").select("*").eq("user_id", user_id).execute()
            if result.data:
                return result.data[0]
        except Exception as e:
            print(f"Supabase org lookup failed: {e}")

    from app.routers.auth import _local_profiles
    if "organizations" in _local_profiles:
        for profile in _local_profiles["organizations"]:
            if profile["user_id"] == user_id:
                return profile
    return None


@router.get("/staff/profile", response_model=APIResponse)
async def get_staff_profile(current_user: dict = Depends(get_current_user)):
    """Get the staff member's profile including their linked organization."""
    role = current_user.get("role")

    if role == "staff":
        profile = _get_staff_profile(current_user["sub"])
        if not profile:
            raise HTTPException(status_code=404, detail="Staff profile not found")
        return APIResponse(success=True, message="Staff profile", data=profile)

    elif role == "organization":
        profile = _get_org_profile(current_user["sub"])
        if not profile:
            raise HTTPException(status_code=404, detail="Organization profile not found")
        # For org admins, they ARE the organization, so linked_organization_id = their own user_id
        profile["linked_organization_id"] = current_user["sub"]
        return APIResponse(success=True, message="Organization profile", data=profile)

    raise HTTPException(status_code=403, detail="Only staff and organization roles can access this")


@router.get("/organization/{org_id}", response_model=APIResponse)
async def get_org_bookings(
    org_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get all bookings for a specific organization. Staff/Org-admin only."""
    role = current_user.get("role")

    # Verify that the user is either:
    # 1. A staff member linked to this org
    # 2. An org admin (their own user_id matches org_id)
    # 3. A super admin
    if role == "staff":
        staff_profile = _get_staff_profile(current_user["sub"])
        if not staff_profile or staff_profile.get("linked_organization_id") != org_id:
            raise HTTPException(status_code=403, detail="You are not linked to this organization")
    elif role == "organization":
        if current_user["sub"] != org_id:
            raise HTTPException(status_code=403, detail="You can only view your own organization's bookings")
    elif role != "admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Fetch bookings by provider_id
    org_bookings = []
    if supabase:
        try:
            result = (
                supabase.table("bookings")
                .select("*")
                .eq("provider_id", org_id)
                .order("created_at", desc=True)
                .execute()
            )
            org_bookings = result.data
        except Exception as e:
            print(f"Supabase org bookings fetch failed: {e}")

    # Local fallback — also search by provider_id
    local_matches = [b for b in _local_bookings if b.get("provider_id") == org_id]

    # Merge (prefer Supabase)
    merged = {b["id"]: b for b in local_matches}
    for sb in org_bookings:
        merged[sb["id"]] = sb

    all_bookings = sorted(merged.values(), key=lambda x: x.get("created_at", ""), reverse=True)

    return APIResponse(
        success=True,
        message=f"Bookings for organization {org_id}",
        data={"bookings": all_bookings, "total": len(all_bookings)}
    )


@router.patch("/{booking_id}/checkin", response_model=APIResponse)
async def checkin_patient(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a patient as checked-in. Staff/Org-admin only."""
    role = current_user.get("role")
    if role not in ("staff", "organization", "admin"):
        raise HTTPException(status_code=403, detail="Only staff can check in patients")

    now = datetime.now(timezone.utc).isoformat()

    if supabase:
        try:
            result = (
                supabase.table("bookings")
                .update({"status": "checked_in", "updated_at": now})
                .eq("id", booking_id)
                .execute()
            )
            if result.data:
                return APIResponse(success=True, message="Patient checked in", data=result.data[0])
        except Exception as e:
            print(f"Supabase checkin failed: {e}")

    # Local fallback
    for b in _local_bookings:
        if b["id"] == booking_id:
            b["status"] = "checked_in"
            b["updated_at"] = now
            return APIResponse(success=True, message="Patient checked in", data=b)

    raise HTTPException(status_code=404, detail="Booking not found")


@router.patch("/{booking_id}/complete", response_model=APIResponse)
async def complete_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a booking as completed. Staff/Org-admin only."""
    role = current_user.get("role")
    if role not in ("staff", "organization", "admin"):
        raise HTTPException(status_code=403, detail="Only staff can complete bookings")

    now = datetime.now(timezone.utc).isoformat()

    if supabase:
        try:
            result = (
                supabase.table("bookings")
                .update({"status": "completed", "updated_at": now})
                .eq("id", booking_id)
                .execute()
            )
            if result.data:
                return APIResponse(success=True, message="Booking completed", data=result.data[0])
        except Exception as e:
            print(f"Supabase complete failed: {e}")

    # Local fallback
    for b in _local_bookings:
        if b["id"] == booking_id:
            b["status"] = "completed"
            b["updated_at"] = now
            return APIResponse(success=True, message="Booking completed", data=b)

    raise HTTPException(status_code=404, detail="Booking not found")


# ─── Booking History (Audit Trail) ────────────────────────────────────────

@router.get("/{booking_id}/history", response_model=APIResponse)
async def get_booking_history(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get the complete status change history for a booking."""
    if not supabase:
        return APIResponse(success=True, message="Booking history", data={"history": []})

    try:
        result = (
            supabase.table("booking_history")
            .select("*")
            .eq("booking_id", booking_id)
            .order("created_at", desc=False)
            .execute()
        )
        return APIResponse(
            success=True,
            message="Booking history",
            data={"history": result.data or [], "booking_id": booking_id},
        )
    except Exception:
        return APIResponse(success=True, message="Booking history", data={"history": []})


# ─── Public Endpoint for Booking Page ──────────────────────────────────────

@router.get("/org-services/{org_id}", response_model=APIResponse)
async def get_org_services_for_booking(org_id: str):
    """Fetch tests, packages, and doctors for a specific organization."""
    if not supabase:
        return APIResponse(success=True, message="Services fetched", data={"services": [], "packages": [], "doctors": []})
        
    try:
        # Fetch active services
        services_res = supabase.table("organization_services").select("*").eq("organization_id", org_id).eq("is_active", True).execute()
        services = services_res.data or []
        
        # Fetch active packages
        packages_res = supabase.table("organization_packages").select("*").eq("organization_id", org_id).eq("is_active", True).execute()
        packages = packages_res.data or []
        
        # Fetch active doctors
        doctors_res = (
            supabase.table("organization_doctors")
            .select("*, doctors(specialization, consultation_mode), users(full_name, email)")
            .eq("organization_id", org_id)
            .eq("is_active", True)
            .execute()
        )
        docs_raw = doctors_res.data or []
        
        # Format doctors
        doctors = []
        for d in docs_raw:
            user = d.get("users", {})
            doc = d.get("doctors", {})
            doctors.append({
                "doctor_id": d["doctor_id"],
                "name": user.get("full_name", ""),
                "specialization": doc.get("specialization", ""),
                "consultation_mode": doc.get("consultation_mode", "both"),
                "consultation_fee": d.get("consultation_fee", 0),
            })
            
        return APIResponse(
            success=True,
            message="Organization services fetched",
            data={
                "services": services,
                "packages": packages,
                "doctors": doctors,
            }
        )
    except Exception as e:
        logger.error(f"Error fetching org services for booking: {e}")
        return APIResponse(success=False, message="Failed to fetch services", data={"services": [], "packages": [], "doctors": []})
