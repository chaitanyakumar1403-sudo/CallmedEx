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
    BookingCreate, BookingResponse, APIResponse,
    BookingStatus, ServiceType,
    SlotAllotment, SlotResponse as SlotResponseSchema
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

    # The frontend sends slot_id as "provider_id|date|time" or "provider_id|date|pending"
    # Parse it to build the booking record
    slot_parts = booking.slot_id.split("|")
    if len(slot_parts) == 3 and slot_parts[2] != "pending" and ":" in slot_parts[2]:
        slot_provider, slot_date, slot_time = slot_parts
        slot_start = f"{slot_date}T{slot_time}:00"
        try:
            hour = int(slot_time.split(":")[0])
            slot_end = f"{slot_date}T{hour:02d}:30:00"
        except ValueError:
            slot_end = f"{slot_date}T23:59:59"
    elif len(slot_parts) == 3 or booking.preferred_date:
        slot_date = slot_parts[1] if len(slot_parts) >= 2 else (booking.preferred_date or now.split("T")[0])
        slot_start = f"{slot_date}T00:00:00"
        slot_end = f"{slot_date}T23:59:59"
    else:
        # Fallback: try to find in local slots by UUID
        slot = None
        _init_demo_slots()
        slot = next((s for s in _local_slots if s["id"] == booking.slot_id), None)
        if not slot:
            # Default to full day if slot_id is dynamic/custom
            slot_start = f"{now.split('T')[0]}T00:00:00"
            slot_end = f"{now.split('T')[0]}T23:59:59"
        else:
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

    # Determine if this is a diagnostic/lab booking that uses the review workflow
    is_diagnostic_review = booking.service_type in (
        ServiceType.LAB_TEST, ServiceType.IMAGING, ServiceType.HEALTH_PACKAGE
    ) and booking.preferred_date

    if is_diagnostic_review:
        # Diagnostic booking: patient selects date only, org allots time
        booking_data = {
            "id": booking_id,
            "patient_id": current_user["sub"],
            "provider_id": booking.provider_id,
            "provider_type": booking.provider_type,
            "service_type": booking.service_type.value,
            "slot_id": f"{booking.provider_id}|{booking.preferred_date}|pending",
            "slot_start": f"{booking.preferred_date}T00:00:00",
            "slot_end": f"{booking.preferred_date}T23:59:59",
            "preferred_date": booking.preferred_date,
            "status": BookingStatus.PENDING_REVIEW.value,
            "notes": booking.notes or "",
            "selected_tests": booking.selected_tests or [],
            "total_price": booking.total_price or 0,
            "created_at": now,
        }
    else:
        # Standard booking: patient selects date + time slot → confirmed immediately
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

    status_msg = (
        "Booking submitted for review. The diagnostic centre will allot your time slot."
        if is_diagnostic_review
        else "Booking confirmed"
    )

    return APIResponse(
        success=True,
        message=status_msg,
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
        # Look up the org record to verify this user owns the org
        owns_org = False
        if supabase:
            try:
                org_check = supabase.table("organizations").select("id").eq("user_id", current_user["sub"]).eq("id", org_id).execute()
                if org_check.data:
                    owns_org = True
            except Exception:
                pass
        if not owns_org:
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
        
        # Fetch active packages (graceful fallback if table missing)
        packages = []
        try:
            packages_res = supabase.table("organization_packages").select("*").eq("organization_id", org_id).eq("is_active", True).execute()
            packages = packages_res.data or []
        except Exception:
            pass
        
        
        # Fetch active doctors (graceful fallback)
        doctors = []
        try:
            doctors_res = (
                supabase.table("organization_doctors")
                .select("*, doctors(specialization, consultation_mode), users(full_name, email)")
                .eq("organization_id", org_id)
                .eq("is_active", True)
                .execute()
            )
            docs_raw = doctors_res.data or []
            
            # Format doctors
            for d in docs_raw:
                user = d.get("users", {}) or {}
                doc = d.get("doctors", {}) or {}
                doctors.append({
                    "doctor_id": d.get("doctor_id"),
                    "name": user.get("full_name", ""),
                    "specialization": doc.get("specialization", ""),
                    "consultation_mode": doc.get("consultation_mode", "both"),
                    "consultation_fee": d.get("consultation_fee", 0),
                })
        except Exception as e:
            logger.error(f"Error fetching doctors: {e}")
            
        # Fetch organization operating hours (timings)
        timings = []
        try:
            timings_res = supabase.table("organization_timings").select("*").eq("organization_id", org_id).order("day_of_week").execute()
            timings = timings_res.data or []
        except Exception:
            pass

        return APIResponse(
            success=True,
            message="Organization services fetched",
            data={
                "services": services,
                "packages": packages,
                "doctors": doctors,
                "timings": timings,
            }
        )
    except Exception as e:
        logger.error(f"Error fetching org services for booking: {e}")
        return APIResponse(success=False, message="Failed to fetch services", data={"services": [], "packages": [], "doctors": []})


# ─── Diagnostic Booking Workflow: Request → Review → Allot → Accept ──────

@router.get("/pending-review", response_model=APIResponse)
async def get_pending_review_bookings(current_user: dict = Depends(get_current_user)):
    """Get all bookings with PENDING_REVIEW status for this organization."""
    role = current_user.get("role")
    if role not in ("organization", "staff", "admin"):
        raise HTTPException(status_code=403, detail="Only organization staff can view pending reviews")

    user_id = current_user["sub"]
    org_id = None

    if role == "staff":
        staff_profile = _get_staff_profile(user_id)
        if not staff_profile:
            raise HTTPException(status_code=404, detail="Staff profile not found")
        org_id = staff_profile.get("linked_organization_id")
    elif role == "organization":
        # Look up the actual organization ID from the organizations table
        if supabase:
            try:
                org_result = supabase.table("organizations").select("id").eq("user_id", user_id).execute()
                if org_result.data:
                    org_id = org_result.data[0]["id"]
                else:
                    logger.warning(f"No organization found for user_id={user_id}")
            except Exception as e:
                logger.error(f"Error looking up org for user {user_id}: {e}")
    elif role == "admin":
        org_id = user_id  # Admin can see all — handled separately if needed

    if not org_id:
        return APIResponse(
            success=True,
            message="No organization linked to this account",
            data={"bookings": [], "total": 0}
        )

    pending_bookings = []
    if supabase:
        try:
            result = (
                supabase.table("bookings")
                .select("*")
                .eq("provider_id", org_id)
                .eq("status", "pending_review")
                .order("created_at", desc=True)
                .execute()
            )
            pending_bookings = result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch pending reviews: {e}")

    # Local fallback
    local_pending = [
        b for b in _local_bookings
        if b.get("provider_id") == org_id and b.get("status") == "pending_review"
    ]
    merged = {b["id"]: b for b in local_pending}
    for sb in pending_bookings:
        merged[sb["id"]] = sb

    return APIResponse(
        success=True,
        message="Pending review bookings",
        data={"bookings": list(merged.values()), "total": len(merged)}
    )


@router.post("/{booking_id}/allot-slot", response_model=APIResponse)
async def allot_slot(
    booking_id: str,
    allotment: SlotAllotment,
    current_user: dict = Depends(get_current_user),
):
    """Organization allots a specific time slot to a pending diagnostic booking."""
    role = current_user.get("role")
    if role not in ("organization", "staff", "admin"):
        raise HTTPException(status_code=403, detail="Only organization staff can allot slots")

    now = datetime.now(timezone.utc).isoformat()

    # Find the booking
    booking = None
    is_local = False

    if supabase:
        try:
            result = supabase.table("bookings").select("*").eq("id", booking_id).execute()
            if result.data:
                booking = result.data[0]
        except Exception:
            pass

    if not booking:
        for b in _local_bookings:
            if b["id"] == booking_id:
                booking = b
                is_local = True
                break

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.get("status") not in ("pending_review", "slot_rejected"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot allot slot to a booking with status '{booking.get('status')}'."
        )

    # Build the allotted slot datetime using the preferred date
    preferred_date = booking.get("preferred_date", booking.get("slot_start", "")[:10])
    allotted_start = f"{preferred_date}T{allotment.allotted_start_time}:00"
    allotted_end = f"{preferred_date}T{allotment.allotted_end_time}:00"

    update_data = {
        "status": BookingStatus.SLOT_ALLOTTED.value,
        "slot_start": allotted_start,
        "slot_end": allotted_end,
        "slot_id": f"{booking.get('provider_id')}|{preferred_date}|{allotment.allotted_start_time}",
        "updated_at": now,
    }
    if allotment.message:
        existing_notes = booking.get("notes", "")
        update_data["notes"] = f"{existing_notes}\n[Org] {allotment.message}".strip()

    if is_local:
        for b in _local_bookings:
            if b["id"] == booking_id:
                b.update(update_data)
                break
    elif supabase:
        try:
            supabase.table("bookings").update(update_data).eq("id", booking_id).execute()
        except Exception as e:
            logger.error(f"Failed to allot slot: {e}")
            raise HTTPException(status_code=500, detail="Failed to allot slot")

    _record_booking_history(
        booking_id, booking.get("status", "pending_review"),
        "slot_allotted", current_user.get("sub"),
        f"Allotted: {allotment.allotted_start_time} - {allotment.allotted_end_time}"
    )

    return APIResponse(
        success=True,
        message=f"Slot allotted: {allotment.allotted_start_time} - {allotment.allotted_end_time}. Waiting for patient response.",
        data={
            "booking_id": booking_id,
            "allotted_start": allotted_start,
            "allotted_end": allotted_end,
            "status": "slot_allotted",
        }
    )


@router.post("/{booking_id}/respond-slot", response_model=APIResponse)
async def respond_to_slot(
    booking_id: str,
    response: SlotResponseSchema,
    current_user: dict = Depends(get_current_user),
):
    """Patient accepts or rejects an allotted time slot."""
    if current_user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Only patients can respond to slot allotments")

    now = datetime.now(timezone.utc).isoformat()

    # Find the booking
    booking = None
    is_local = False

    if supabase:
        try:
            result = supabase.table("bookings").select("*").eq("id", booking_id).execute()
            if result.data:
                booking = result.data[0]
        except Exception:
            pass

    if not booking:
        for b in _local_bookings:
            if b["id"] == booking_id:
                booking = b
                is_local = True
                break

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.get("patient_id") != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not your booking")

    if booking.get("status") != "slot_allotted":
        raise HTTPException(status_code=400, detail="This booking does not have a pending slot allotment")

    if response.accepted:
        new_status = BookingStatus.CONFIRMED.value
        message = "Slot accepted! Your booking is now confirmed."
    else:
        new_status = BookingStatus.SLOT_REJECTED.value
        message = "Slot declined. The centre will assign a new time slot."

    update_data = {"status": new_status, "updated_at": now}
    if response.reason:
        existing_notes = booking.get("notes", "")
        update_data["notes"] = f"{existing_notes}\n[Patient] Declined: {response.reason}".strip()

    if is_local:
        for b in _local_bookings:
            if b["id"] == booking_id:
                b.update(update_data)
                break
    elif supabase:
        try:
            supabase.table("bookings").update(update_data).eq("id", booking_id).execute()
        except Exception as e:
            logger.error(f"Failed to respond to slot: {e}")
            raise HTTPException(status_code=500, detail="Failed to process response")

    _record_booking_history(
        booking_id, "slot_allotted", new_status, current_user.get("sub"),
        f"{'Accepted' if response.accepted else 'Rejected'}: {response.reason or ''}"
    )

    return APIResponse(success=True, message=message, data={"status": new_status, "booking_id": booking_id})


@router.post("/{booking_id}/cancel")
async def cancel_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    """
    Cancel a booking based on industry-standard cancellation policies.
    - Free cancellation if 'pending' or 'searching'.
    - 5-min grace period if 'provider_accepted'.
    - Fee applies if 'en_route' or late 'provider_accepted'.
    - Blocked if 'arrived', 'in_progress', 'completed'.
    """
    user_id = current_user["sub"]
    
    if not supabase:
        return APIResponse(success=True, message="Simulated cancellation", data={"status": "cancelled"})
        
    # 1. Fetch booking
    b_res = supabase.table("bookings").select("*").eq("id", booking_id).execute()
    booking = None
    is_local = False
    if not b_res.data:
        # Check local fallback
        for b in _local_bookings:
            if b["id"] == booking_id:
                booking = b
                is_local = True
                break
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
    else:
        booking = b_res.data[0]
    
    if booking.get("patient_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")
        
    current_status = booking.get("status")
    
    if current_status in ["cancelled", "completed", "arrived", "in_progress"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel a booking that is currently {current_status}")
        
    # 2. Enforce Cancellation Policy (Grace Period vs Fee)
    fee_applied = False
    penalty_amount = 0
    
    if current_status in ["provider_accepted", "en_route", "confirmed"]:
        # Check time since booking created (Using created_at for MVP)
        created_at_str = booking.get("created_at")
        if created_at_str:
            try:
                # Handle ISO format with Z
                created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                elapsed_mins = (datetime.now(timezone.utc) - created_at).total_seconds() / 60
                
                if current_status == "en_route" or elapsed_mins > 5:
                    fee_applied = True
                    total_price = booking.get("total_price") or 0
                    penalty_amount = round(float(total_price) * 0.20, 2) # 20% industry standard fee
            except Exception as e:
                logger.error(f"Error parsing date for cancellation: {e}")
                fee_applied = True # Safe fallback if date parsing fails

    # 3. Update Booking
    update_data = {"status": "cancelled"}
    notes = "Cancelled by patient."
    if fee_applied:
        notes += f" Cancellation fee applied (Late Cancellation / En Route). Penalty: ₹{penalty_amount}."
        update_data["notes"] = booking.get("notes", "") + f"\n[{datetime.now().isoformat()}] {notes}"
        
        # Deduct penalty directly from total_price for accounting purposes (or we could store it separately if a cancellation_fee column existed)
        # We will keep total_price intact for history, and just add it to notes.
        
    try:
        if is_local:
            for b in _local_bookings:
                if b["id"] == booking_id:
                    b["status"] = "cancelled"
                    if "notes" in update_data:
                        b["notes"] = update_data["notes"]
                    break
        else:
            supabase.table("bookings").update(update_data).eq("id", booking_id).execute()
            
            # 4. Cancel related live_dispatch if it exists
            # Wait, live_dispatch is not a table, dispatch_requests is. But leaving as is since it doesn't hurt.
            try:
                supabase.table("dispatch_requests").update({"status": "cancelled"}).eq("booking_id", booking_id).execute()
            except Exception:
                pass
        
        _record_booking_history(booking_id, current_status, "cancelled", changed_by=user_id, notes=notes)
        
        return APIResponse(
            success=True, 
            message=f"Booking cancelled successfully. {'A cancellation fee will be applied.' if fee_applied else 'No fee applied.'}",
            data={"status": "cancelled", "fee_applied": fee_applied}
        )
    except Exception as e:
        logger.error(f"Failed to cancel booking: {e}")
        raise HTTPException(status_code=500, detail="Failed to process cancellation")
