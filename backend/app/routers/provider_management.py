"""
Provider Management Router — Phase 6A
Post-registration management for Doctors and Organizations.
Doctors: set availability, manage slots, view appointments.
Organizations: add doctors, set services/fees, manage calendar.
"""
import uuid
import logging
from datetime import datetime, timezone, date, timedelta, time
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from app.middleware.auth import get_current_user
from app.database import supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/providers", tags=["Provider Management"])


# ─── Request Models ───────────────────────────────────────────────────────

class AvailabilityCreate(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Sunday, 6=Saturday")
    start_time: str = Field(..., description="HH:MM format, e.g. '09:00'")
    end_time: str = Field(..., description="HH:MM format, e.g. '13:00'")
    slot_duration_minutes: int = Field(30, ge=10, le=120)
    consultation_mode: str = Field("in_person")
    max_patients_per_slot: int = Field(1, ge=1, le=10)
    location_name: Optional[str] = ""
    location_address: Optional[str] = ""
    organization_id: Optional[str] = None


class AvailabilityUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    slot_duration_minutes: Optional[int] = None
    consultation_mode: Optional[str] = None
    max_patients_per_slot: Optional[int] = None
    is_active: Optional[bool] = None
    location_name: Optional[str] = None
    location_address: Optional[str] = None


class BlockedDateCreate(BaseModel):
    blocked_date: str = Field(..., description="YYYY-MM-DD")
    reason: Optional[str] = ""


class FeeCreate(BaseModel):
    fee_type: str = Field("in_person", description="in_person, online, or home_visit")
    amount: float = Field(..., gt=0)
    organization_id: Optional[str] = None


class OrgDoctorAdd(BaseModel):
    doctor_email: str = Field(..., description="Email of an existing doctor on CallMedex")
    specialization: Optional[str] = ""
    consultation_fee: Optional[float] = 0


class OrgServiceCreate(BaseModel):
    service_type: str = Field("lab_test")
    name: str
    description: Optional[str] = ""
    price: float = Field(..., gt=0)
    included_tests: Optional[List[str]] = []
    home_collection_available: Optional[bool] = False
    home_collection_surcharge: Optional[float] = 0


class OrgPackageCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    tests_included: List[str]
    price: float = Field(..., gt=0)


class OrgTimingsUpdate(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    is_open: bool
    open_time: Optional[str] = None
    close_time: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════
# DOCTOR ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/my-availability")
async def get_my_availability(current_user: dict = Depends(get_current_user)):
    """Doctor views their weekly availability schedule."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        result = (
            supabase.table("doctor_availability")
            .select("*")
            .eq("doctor_id", current_user["sub"])
            .order("day_of_week")
            .order("start_time")
            .execute()
        )
        return {"success": True, "availability": result.data or []}
    except Exception as e:
        logger.error(f"Error fetching availability: {e}")
        raise HTTPException(500, "Failed to fetch availability")


@router.post("/availability")
async def create_availability(
    body: AvailabilityCreate,
    current_user: dict = Depends(get_current_user),
):
    """Doctor creates a recurring availability block (e.g., every Monday 9:00-13:00)."""
    if current_user.get("role") not in ("doctor", "admin"):
        raise HTTPException(403, "Only doctors can set availability")

    if not supabase:
        raise HTTPException(500, "Database not configured")

    # Validate time format
    try:
        start = datetime.strptime(body.start_time, "%H:%M").time()
        end = datetime.strptime(body.end_time, "%H:%M").time()
        if start >= end:
            raise HTTPException(400, "Start time must be before end time")
    except ValueError:
        raise HTTPException(400, "Invalid time format. Use HH:MM (e.g., '09:00')")

    record = {
        "id": str(uuid.uuid4()),
        "doctor_id": current_user["sub"],
        "day_of_week": body.day_of_week,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "slot_duration_minutes": body.slot_duration_minutes,
        "consultation_mode": body.consultation_mode,
        "max_patients_per_slot": body.max_patients_per_slot,
        "location_name": body.location_name or "",
        "location_address": body.location_address or "",
        "organization_id": body.organization_id,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        supabase.table("doctor_availability").insert(record).execute()
        return {"success": True, "message": "Availability created", "availability": record}
    except Exception as e:
        logger.error(f"Error creating availability: {e}")
        raise HTTPException(500, "Failed to create availability")


@router.put("/availability/{availability_id}")
async def update_availability(
    availability_id: str,
    body: AvailabilityUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Doctor updates an existing availability block."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        result = (
            supabase.table("doctor_availability")
            .update(updates)
            .eq("id", availability_id)
            .eq("doctor_id", current_user["sub"])
            .execute()
        )
        if not result.data:
            raise HTTPException(404, "Availability not found or not yours")
        return {"success": True, "message": "Availability updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating availability: {e}")
        raise HTTPException(500, "Failed to update availability")


@router.delete("/availability/{availability_id}")
async def delete_availability(
    availability_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Doctor deletes an availability block."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        result = (
            supabase.table("doctor_availability")
            .delete()
            .eq("id", availability_id)
            .eq("doctor_id", current_user["sub"])
            .execute()
        )
        return {"success": True, "message": "Availability deleted"}
    except Exception as e:
        logger.error(f"Error deleting availability: {e}")
        raise HTTPException(500, "Failed to delete availability")


# ─── Blocked Dates ────────────────────────────────────────────────────────

@router.get("/my-blocked-dates")
async def get_my_blocked_dates(current_user: dict = Depends(get_current_user)):
    """Doctor views their blocked dates (holidays, leave)."""
    if not supabase:
        return {"success": True, "blocked_dates": []}

    try:
        result = (
            supabase.table("doctor_blocked_dates")
            .select("*")
            .eq("doctor_id", current_user["sub"])
            .gte("blocked_date", date.today().isoformat())
            .order("blocked_date")
            .execute()
        )
        return {"success": True, "blocked_dates": result.data or []}
    except Exception as e:
        logger.error(f"Error fetching blocked dates: {e}")
        return {"success": True, "blocked_dates": []}


@router.post("/blocked-dates")
async def add_blocked_date(
    body: BlockedDateCreate,
    current_user: dict = Depends(get_current_user),
):
    """Doctor blocks a specific date (holiday, leave)."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        record = {
            "id": str(uuid.uuid4()),
            "doctor_id": current_user["sub"],
            "blocked_date": body.blocked_date,
            "reason": body.reason or "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("doctor_blocked_dates").insert(record).execute()
        return {"success": True, "message": f"Date {body.blocked_date} blocked"}
    except Exception as e:
        logger.error(f"Error blocking date: {e}")
        raise HTTPException(500, "Failed to block date")


@router.delete("/blocked-dates/{blocked_date_id}")
async def remove_blocked_date(
    blocked_date_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Doctor removes a blocked date."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        supabase.table("doctor_blocked_dates").delete().eq("id", blocked_date_id).eq("doctor_id", current_user["sub"]).execute()
        return {"success": True, "message": "Blocked date removed"}
    except Exception as e:
        logger.error(f"Error removing blocked date: {e}")
        raise HTTPException(500, "Failed to remove blocked date")


# ─── Consultation Fees ────────────────────────────────────────────────────

@router.get("/my-fees")
async def get_my_fees(current_user: dict = Depends(get_current_user)):
    """Doctor views their consultation fees."""
    if not supabase:
        return {"success": True, "fees": []}

    try:
        result = (
            supabase.table("consultation_fees")
            .select("*")
            .eq("doctor_id", current_user["sub"])
            .eq("is_active", True)
            .execute()
        )
        return {"success": True, "fees": result.data or []}
    except Exception as e:
        logger.error(f"Error fetching fees: {e}")
        return {"success": True, "fees": []}


@router.post("/fees")
async def set_fee(
    body: FeeCreate,
    current_user: dict = Depends(get_current_user),
):
    """Doctor sets a consultation fee for a given mode."""
    if current_user.get("role") not in ("doctor", "admin"):
        raise HTTPException(403, "Only doctors can set fees")

    if not supabase:
        raise HTTPException(500, "Database not configured")

    record = {
        "id": str(uuid.uuid4()),
        "doctor_id": current_user["sub"],
        "organization_id": body.organization_id,
        "fee_type": body.fee_type,
        "amount": body.amount,
        "currency": "INR",
        "is_active": True,
        "set_by": "doctor",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        # Upsert: update if exists, insert if not
        existing = (
            supabase.table("consultation_fees")
            .select("id")
            .eq("doctor_id", current_user["sub"])
            .eq("fee_type", body.fee_type)
            .is_("organization_id", "null" if not body.organization_id else None)
            .execute()
        )

        if body.organization_id:
            existing = (
                supabase.table("consultation_fees")
                .select("id")
                .eq("doctor_id", current_user["sub"])
                .eq("fee_type", body.fee_type)
                .eq("organization_id", body.organization_id)
                .execute()
            )

        if existing.data:
            supabase.table("consultation_fees").update({
                "amount": body.amount,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", existing.data[0]["id"]).execute()
            return {"success": True, "message": f"Fee updated: ₹{body.amount} for {body.fee_type}"}
        else:
            supabase.table("consultation_fees").insert(record).execute()
            return {"success": True, "message": f"Fee set: ₹{body.amount} for {body.fee_type}"}
    except Exception as e:
        logger.error(f"Error setting fee: {e}")
        raise HTTPException(500, "Failed to set fee")


# ─── Generate Bookable Slots for a Date ───────────────────────────────────

@router.get("/slots")
async def get_available_slots(
    provider_id: str = Query(..., description="Doctor user ID"),
    target_date: str = Query(..., description="YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
):
    """
    Generate bookable slots for a specific doctor on a specific date.
    Reads the doctor's weekly availability, checks for blocked dates,
    and removes already-booked slots.
    """
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        target = datetime.strptime(target_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")

    # Don't allow booking in the past
    if target < date.today():
        return {"success": True, "slots": [], "message": "Cannot book past dates"}

    # Check if date is blocked
    try:
        blocked = (
            supabase.table("doctor_blocked_dates")
            .select("id")
            .eq("doctor_id", provider_id)
            .eq("blocked_date", target_date)
            .execute()
        )
        if blocked.data:
            return {"success": True, "slots": [], "message": "Doctor is not available on this date"}
    except Exception:
        pass

    # Get availability for this day of week
    day_of_week = target.weekday()  # Python: 0=Mon, 6=Sun
    # Convert to our schema: 0=Sun, 6=Sat
    db_day = (day_of_week + 1) % 7

    try:
        avail_result = (
            supabase.table("doctor_availability")
            .select("*")
            .eq("doctor_id", provider_id)
            .eq("day_of_week", db_day)
            .eq("is_active", True)
            .execute()
        )
    except Exception as e:
        logger.error(f"Error fetching availability: {e}")
        raise HTTPException(500, "Failed to fetch availability")

    if not avail_result.data:
        return {"success": True, "slots": [], "message": "No availability on this day"}

    # Get existing bookings for this date
    booked_slots = set()
    try:
        bookings_result = (
            supabase.table("bookings")
            .select("slot_time")
            .eq("provider_id", provider_id)
            .eq("booking_date", target_date)
            .neq("status", "cancelled")
            .execute()
        )
        for b in (bookings_result.data or []):
            if b.get("slot_time"):
                booked_slots.add(b["slot_time"])
    except Exception:
        pass

    # Generate slots
    all_slots = []
    for avail in avail_result.data:
        start_str = avail["start_time"]
        end_str = avail["end_time"]
        duration = avail.get("slot_duration_minutes", 30)
        mode = avail.get("consultation_mode", "in_person")
        max_patients = avail.get("max_patients_per_slot", 1)
        location = avail.get("location_name", "")

        # Parse times (handle both HH:MM and HH:MM:SS formats)
        start_parts = start_str.split(":")
        end_parts = end_str.split(":")
        start_time = time(int(start_parts[0]), int(start_parts[1]))
        end_time = time(int(end_parts[0]), int(end_parts[1]))

        # Generate individual slots
        current = datetime.combine(target, start_time)
        slot_end = datetime.combine(target, end_time)

        while current + timedelta(minutes=duration) <= slot_end:
            slot_time_str = current.strftime("%H:%M")
            slot_end_str = (current + timedelta(minutes=duration)).strftime("%H:%M")

            is_booked = slot_time_str in booked_slots

            # For today, skip past slots
            if target == date.today():
                now = datetime.now().time()
                if current.time() <= now:
                    current += timedelta(minutes=duration)
                    continue

            all_slots.append({
                "time": slot_time_str,
                "end_time": slot_end_str,
                "display": current.strftime("%-I:%M %p") if hasattr(current, 'strftime') else slot_time_str,
                "consultation_mode": mode,
                "max_patients": max_patients,
                "is_available": not is_booked,
                "location": location,
                "availability_id": avail["id"],
            })
            current += timedelta(minutes=duration)

    # Sort by time
    all_slots.sort(key=lambda x: x["time"])

    return {"success": True, "slots": all_slots, "date": target_date, "provider_id": provider_id}


# ═══════════════════════════════════════════════════════════════════════════
# ORGANIZATION ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/org/add-doctor")
async def org_add_doctor(
    body: OrgDoctorAdd,
    current_user: dict = Depends(get_current_user),
):
    """Organization adds a doctor by their email."""
    if current_user.get("role") not in ("organization", "admin"):
        raise HTTPException(403, "Only organizations can add doctors")

    if not supabase:
        raise HTTPException(500, "Database not configured")

    # Find the doctor by email
    try:
        doctor_result = (
            supabase.table("users")
            .select("id, full_name, email")
            .eq("email", body.doctor_email)
            .eq("role", "doctor")
            .execute()
        )
        if not doctor_result.data:
            raise HTTPException(404, f"No registered doctor found with email: {body.doctor_email}")

        doctor = doctor_result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finding doctor: {e}")
        raise HTTPException(500, "Failed to find doctor")

    # Get organization ID
    try:
        org_result = (
            supabase.table("organizations")
            .select("id")
            .eq("user_id", current_user["sub"])
            .execute()
        )
        if not org_result.data:
            raise HTTPException(404, "Organization profile not found. Complete registration first.")
        org_id = org_result.data[0]["id"]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finding org: {e}")
        raise HTTPException(500, "Failed to find organization")

    # Link doctor
    record = {
        "id": str(uuid.uuid4()),
        "organization_id": org_id,
        "doctor_user_id": doctor["id"],
        "specialization": body.specialization or "",
        "consultation_fee": body.consultation_fee or 0,
        "is_active": True,
        "joined_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        supabase.table("organization_doctors").insert(record).execute()
        return {
            "success": True,
            "message": f"Dr. {doctor['full_name']} added to your organization",
            "doctor": {
                "id": doctor["id"],
                "name": doctor["full_name"],
                "email": doctor["email"],
                "specialization": body.specialization,
                "fee": body.consultation_fee,
            },
        }
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(409, "This doctor is already linked to your organization")
        logger.error(f"Error adding doctor to org: {e}")
        raise HTTPException(500, "Failed to add doctor")


@router.get("/org/doctors")
async def org_list_doctors(current_user: dict = Depends(get_current_user)):
    """Organization lists all their linked doctors."""
    if not supabase:
        return {"success": True, "doctors": []}

    try:
        org_result = (
            supabase.table("organizations")
            .select("id")
            .eq("user_id", current_user["sub"])
            .execute()
        )
        if not org_result.data:
            return {"success": True, "doctors": []}

        org_id = org_result.data[0]["id"]

        result = (
            supabase.table("organization_doctors")
            .select("*, users!doctor_user_id(id, full_name, email, mobile)")
            .eq("organization_id", org_id)
            .eq("is_active", True)
            .execute()
        )
        return {"success": True, "doctors": result.data or []}
    except Exception as e:
        logger.error(f"Error listing org doctors: {e}")
        return {"success": True, "doctors": []}


@router.delete("/org/doctor/{doctor_user_id}")
async def org_remove_doctor(
    doctor_user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Organization removes a linked doctor."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        org_result = (
            supabase.table("organizations")
            .select("id")
            .eq("user_id", current_user["sub"])
            .execute()
        )
        if not org_result.data:
            raise HTTPException(404, "Organization not found")

        org_id = org_result.data[0]["id"]
        supabase.table("organization_doctors").update({"is_active": False}).eq("organization_id", org_id).eq("doctor_user_id", doctor_user_id).execute()
        return {"success": True, "message": "Doctor removed from organization"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing doctor: {e}")
        raise HTTPException(500, "Failed to remove doctor")


# ─── Organization Services ────────────────────────────────────────────────

@router.post("/org/services")
async def org_add_service(
    body: OrgServiceCreate,
    current_user: dict = Depends(get_current_user),
):
    """Organization adds a lab test, health package, or imaging service."""
    if current_user.get("role") not in ("organization", "admin"):
        raise HTTPException(403, "Only organizations can add services")

    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        org_result = (
            supabase.table("organizations")
            .select("id")
            .eq("user_id", current_user["sub"])
            .execute()
        )
        if not org_result.data:
            raise HTTPException(404, "Organization not found")

        org_id = org_result.data[0]["id"]

        record = {
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "service_type": body.service_type,
            "name": body.name,
            "description": body.description or "",
            "price": body.price,
            "included_tests": body.included_tests or [],
            "home_collection_available": body.home_collection_available,
            "home_collection_surcharge": body.home_collection_surcharge or 0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        supabase.table("organization_services").insert(record).execute()
        return {"success": True, "message": f"Service '{body.name}' added", "service": record}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding service: {e}")
        raise HTTPException(500, "Failed to add service")


@router.get("/org/services")
async def org_list_services(current_user: dict = Depends(get_current_user)):
    """Organization lists their services."""
    if not supabase:
        return {"success": True, "services": []}

    try:
        org_result = (
            supabase.table("organizations")
            .select("id")
            .eq("user_id", current_user["sub"])
            .execute()
        )
        if not org_result.data:
            return {"success": True, "services": []}

        result = (
            supabase.table("organization_services")
            .select("*")
            .eq("organization_id", org_result.data[0]["id"])
            .eq("is_active", True)
            .order("service_type")
            .execute()
        )
        return {"success": True, "services": result.data or []}
    except Exception as e:
        logger.error(f"Error listing services: {e}")
        return {"success": True, "services": []}


@router.delete("/org/services/{service_id}")
async def org_remove_service(
    service_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Organization removes a service."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        org_result = (
            supabase.table("organizations")
            .select("id")
            .eq("user_id", current_user["sub"])
            .execute()
        )
        if not org_result.data:
            raise HTTPException(404, "Organization not found")

        supabase.table("organization_services").update({"is_active": False}).eq("id", service_id).eq("organization_id", org_result.data[0]["id"]).execute()
        return {"success": True, "message": "Service removed"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing service: {e}")
        raise HTTPException(500, "Failed to remove service")


@router.put("/org/services/{service_id}")
async def update_org_service(
    service_id: str,
    body: OrgServiceCreate,
    current_user: dict = Depends(get_current_user),
):
    """Organization updates a service."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        org_result = supabase.table("organizations").select("id").eq("user_id", current_user["sub"]).execute()
        if not org_result.data:
            raise HTTPException(404, "Organization not found")

        update_data = {
            "name": body.name,
            "description": body.description,
            "price": body.price,
            "included_tests": body.included_tests,
            "home_collection_available": body.home_collection_available,
            "home_collection_surcharge": body.home_collection_surcharge,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("organization_services").update(update_data).eq("id", service_id).eq("organization_id", org_result.data[0]["id"]).execute()
        return {"success": True, "message": "Service updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating service: {e}")
        raise HTTPException(500, "Failed to update service")


@router.post("/org/packages")
async def add_org_package(
    body: OrgPackageCreate,
    current_user: dict = Depends(get_current_user),
):
    """Organization adds a test package."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        org_result = supabase.table("organizations").select("id, organization_name").eq("user_id", current_user["sub"]).execute()
        if not org_result.data:
            raise HTTPException(404, "Organization not found")

        package_record = {
            "id": str(uuid.uuid4()),
            "organization_id": org_result.data[0]["id"],
            "organization_name": org_result.data[0]["organization_name"],
            "name": body.name,
            "description": body.description,
            "tests_included": body.tests_included,
            "price": body.price,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        supabase.table("organization_packages").insert(package_record).execute()
        return {"success": True, "message": "Package added successfully"}
    except Exception as e:
        logger.error(f"Error adding package: {e}")
        raise HTTPException(500, "Failed to add package")


@router.get("/org/packages")
async def get_org_packages(current_user: dict = Depends(get_current_user)):
    """Organization retrieves their test packages."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        org_result = supabase.table("organizations").select("id").eq("user_id", current_user["sub"]).execute()
        if not org_result.data:
            return {"success": True, "packages": []}

        result = supabase.table("organization_packages").select("*").eq("organization_id", org_result.data[0]["id"]).eq("is_active", True).execute()
        return {"success": True, "packages": result.data or []}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching packages: {e}")
        return {"success": True, "packages": []}


@router.delete("/org/packages/{package_id}")
async def remove_org_package(package_id: str, current_user: dict = Depends(get_current_user)):
    """Organization removes a package."""
    if not supabase:
        raise HTTPException(500, "Database not configured")
    try:
        org_result = supabase.table("organizations").select("id").eq("user_id", current_user["sub"]).execute()
        if not org_result.data:
            raise HTTPException(404, "Organization not found")

        supabase.table("organization_packages").update({"is_active": False}).eq("id", package_id).eq("organization_id", org_result.data[0]["id"]).execute()
        return {"success": True, "message": "Package removed"}
    except Exception as e:
        logger.error(f"Error removing package: {e}")
        raise HTTPException(500, "Failed to remove package")


@router.get("/org/timings")
async def get_org_timings(current_user: dict = Depends(get_current_user)):
    """Get organization operating hours."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        org_result = supabase.table("organizations").select("id").eq("user_id", current_user["sub"]).execute()
        if not org_result.data:
            return {"success": True, "timings": []}

        result = supabase.table("organization_timings").select("*").eq("organization_id", org_result.data[0]["id"]).order("day_of_week").execute()
        return {"success": True, "timings": result.data or []}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching org timings: {e}")
        return {"success": True, "timings": []}


@router.post("/org/timings")
async def set_org_timings(body: OrgTimingsUpdate, current_user: dict = Depends(get_current_user)):
    """Set or update organization operating hours."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        org_result = supabase.table("organizations").select("id").eq("user_id", current_user["sub"]).execute()
        if not org_result.data:
            raise HTTPException(404, "Organization not found")

        org_id = org_result.data[0]["id"]
        
        # Upsert timing
        existing = supabase.table("organization_timings").select("id").eq("organization_id", org_id).eq("day_of_week", body.day_of_week).execute()
        
        record = {
            "organization_id": org_id,
            "day_of_week": body.day_of_week,
            "is_open": body.is_open,
            "open_time": body.open_time,
            "close_time": body.close_time,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if existing.data:
            supabase.table("organization_timings").update(record).eq("id", existing.data[0]["id"]).execute()
        else:
            record["id"] = str(uuid.uuid4())
            record["created_at"] = datetime.now(timezone.utc).isoformat()
            supabase.table("organization_timings").insert(record).execute()

        return {"success": True, "message": "Timings updated successfully"}
    except Exception as e:
        logger.error(f"Error updating timings: {e}")
        raise HTTPException(500, "Failed to update timings")


@router.get("/org/stats")
async def get_org_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard stats for organization."""
    if not supabase:
        raise HTTPException(500, "Database not configured")
    try:
        org_result = supabase.table("organizations").select("id").eq("user_id", current_user["sub"]).execute()
        if not org_result.data:
            return {
                "success": True,
                "stats": {
                    "total_bookings": 0,
                    "total_revenue": 0,
                    "total_patients": 0,
                    "total_doctors": 0,
                    "total_services": 0,
                }
            }
        org_id = org_result.data[0]["id"]

        # Fetch bookings
        bookings_result = supabase.table("bookings").select("id, total_price, patient_id").eq("organization_id", org_id).execute()
        bookings = bookings_result.data or []
        
        # Calculate stats
        total_bookings = len(bookings)
        total_revenue = sum(b.get("total_price") or 0 for b in bookings)
        total_patients = len(set(b["patient_id"] for b in bookings))

        # Fetch doctors count
        docs_res = supabase.table("organization_doctors").select("id", count="exact").eq("organization_id", org_id).eq("is_active", True).execute()
        total_doctors = docs_res.count or 0

        # Fetch services count
        svcs_res = supabase.table("organization_services").select("id", count="exact").eq("organization_id", org_id).eq("is_active", True).execute()
        total_services = svcs_res.count or 0

        return {
            "success": True,
            "stats": {
                "total_bookings": total_bookings,
                "total_revenue": total_revenue,
                "total_patients": total_patients,
                "total_doctors": total_doctors,
                "total_services": total_services,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching org stats: {e}")
        return {
            "success": True,
            "stats": {
                "total_bookings": 0,
                "total_revenue": 0,
                "total_patients": 0,
                "total_doctors": 0,
                "total_services": 0,
            }
        }


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC SEARCH ENDPOINTS (for Patient Booking Page)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/search/doctors")
async def search_doctors(
    specialization: Optional[str] = None,
    city: Optional[str] = None,
    consultation_mode: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(20, le=50),
):
    """
    Public endpoint: search for doctors.
    Used by the patient booking page to find real providers.
    """
    if not supabase:
        return {"success": True, "doctors": []}

    try:
        query = (
            supabase.table("doctors")
            .select("*, users!inner(id, full_name, email, city, district, state)")
            .eq("verification_status", "verified")
        )

        if specialization:
            query = query.ilike("specialization", f"%{specialization}%")
        if city:
            query = query.ilike("users.city", f"%{city}%")
        if consultation_mode:
            query = query.eq("consultation_mode", consultation_mode)

        result = query.limit(limit).execute()
        doctors = result.data or []

        # Enrich with fees
        enriched = []
        for doc in doctors:
            user = doc.get("users", {})
            doc_user_id = user.get("id", doc.get("user_id", ""))

            # Get fees
            fees = {}
            try:
                fees_result = (
                    supabase.table("consultation_fees")
                    .select("fee_type, amount")
                    .eq("doctor_id", doc_user_id)
                    .eq("is_active", True)
                    .execute()
                )
                for f in (fees_result.data or []):
                    fees[f["fee_type"]] = f["amount"]
            except Exception:
                pass

            # Fallback to doctor table fee
            if not fees and doc.get("consultation_fee"):
                fees["in_person"] = doc["consultation_fee"]

            enriched.append({
                "id": doc_user_id,
                "name": user.get("full_name", ""),
                "specialization": doc.get("specialization", ""),
                "qualification": doc.get("qualification", ""),
                "experience_years": doc.get("years_of_experience", 0),
                "consultation_mode": doc.get("consultation_mode", "both"),
                "city": user.get("city", ""),
                "fees": fees,
                "languages": doc.get("languages_spoken", ["English"]),
            })

        return {"success": True, "doctors": enriched}
    except Exception as e:
        logger.error(f"Error searching doctors: {e}")
        return {"success": True, "doctors": []}


@router.get("/search/organizations")
async def search_organizations(
    org_type: Optional[str] = None,
    city: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(20, le=50),
):
    """Public endpoint: search for organizations (hospitals, clinics, labs)."""
    if not supabase:
        return {"success": True, "organizations": []}

    try:
        query = (
            supabase.table("organizations")
            .select("*, users!inner(id, full_name, city, district, state, address)")
            .eq("verification_status", "verified")
        )

        if org_type:
            query = query.eq("organization_type", org_type)
        if city:
            query = query.ilike("users.city", f"*{city}*")
        if q:
            query = query.ilike("organization_name", f"*{q}*")

        result = query.limit(limit).execute()
        orgs = result.data or []

        enriched = []
        for org in orgs:
            user = org.get("users", {})
            org_id = org.get("id", "")

            # Get linked doctors count
            doc_count = 0
            try:
                doc_result = (
                    supabase.table("organization_doctors")
                    .select("id", count="exact")
                    .eq("organization_id", org_id)
                    .eq("is_active", True)
                    .execute()
                )
                doc_count = doc_result.count or 0
            except Exception:
                pass

            # Get services count
            svc_count = 0
            try:
                svc_result = (
                    supabase.table("organization_services")
                    .select("id", count="exact")
                    .eq("organization_id", org_id)
                    .eq("is_active", True)
                    .execute()
                )
                svc_count = svc_result.count or 0
            except Exception:
                pass

            org_name = org.get("organization_name", "")
            org_type_val = org.get("organization_type", "clinic")
            enriched.append({
                "id": org_id,
                "user_id": user.get("id", ""),
                "name": org_name,
                "organization_name": org_name,
                "type": org_type_val,
                "organization_type": org_type_val,
                "address": user.get("address", "") or org.get("address", ""),
                "city": user.get("city", "") or org.get("city", ""),
                "district": user.get("district", "") or org.get("district", ""),
                "state": user.get("state", "") or org.get("state", ""),
                "doctors_count": doc_count,
                "total_doctors": doc_count,
                "services_count": svc_count,
                "total_services": svc_count,
                "license_number": org.get("license_number", ""),
                "operating_hours": org.get("operating_hours", ""),
            })

        return {"success": True, "organizations": enriched}
    except Exception as e:
        logger.error(f"Error searching orgs: {e}")
        return {"success": True, "organizations": []}


@router.get("/search/packages")
async def search_packages(limit: int = Query(50, le=100)):
    """
    Public endpoint: retrieve active health packages created by organizations.
    Used by the patient health packages page.
    """
    if not supabase:
        return {"success": True, "packages": []}

    try:
        # Fetch active packages
        result = (
            supabase.table("organization_packages")
            .select("*")
            .eq("is_active", True)
            .limit(limit)
            .execute()
        )
        packages = result.data or []
        
        # We can enrich the packages with tests info if needed, but for now just return them
        return {"success": True, "packages": packages}
    except Exception as e:
        logger.error(f"Error fetching public org packages: {e}")
        return {"success": True, "packages": []}
