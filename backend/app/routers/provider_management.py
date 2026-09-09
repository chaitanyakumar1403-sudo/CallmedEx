"""
Provider Management Router — Phase 6A
Post-registration management for Doctors and Organizations.
Doctors: set availability, manage slots, view appointments.
Organizations: add doctors, set services/fees, manage calendar.
"""
import uuid
import re
import json
import logging
from datetime import datetime, timezone, date, timedelta, time
from typing import Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from app.middleware.auth import get_current_user, get_optional_current_user
from app.database import supabase
from app.services import provider_modes
from app.utils.db_helpers import _rows
from app.services.scope_catalogs import (
    is_allowed_diagnostic_center_service,
    get_diagnostic_center_scope,
)

from app.utils.personas import is_test_persona

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/providers", tags=["Provider Management"])


# ─── Request Models ───────────────────────────────────────────────────────

DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


# Roles that publish a bookable schedule of their own (as opposed to
# organizations, which publish opening hours).
SCHEDULING_PROVIDER_ROLES = ("doctor", "physiotherapist", "dietitian", "nurse", "dentist", "admin")


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
    # Write the same block to all seven days, linked by one template_group_id so
    # it can later be edited or removed as a unit. Doctors keep the same clinic
    # hours most days; entering them seven times is pure friction.
    apply_to_all_days: bool = False
    # Explicit list of days [0..6] to apply hours to (e.g. Mon-Sat without Sun)
    days: Optional[List[int]] = None
    # With apply_to_all_days or days, replace any existing blocks on the days covered
    # instead of stacking a second one on top.
    replace_existing: bool = False


class ShiftScheduleCreate(BaseModel):
    consultation_mode: str = Field("in_person", description="'in_person', 'online', or 'home_visit'")
    slot_duration_minutes: int = Field(30, ge=10, le=120)
    selected_days: List[int] = Field(default=[1, 2, 3, 4, 5, 6], description="0=Sun, 6=Sat")
    morning_shift_enabled: bool = True
    morning_start: str = Field("09:00", description="HH:MM format")
    morning_end: str = Field("12:00", description="HH:MM format")
    evening_shift_enabled: bool = True
    evening_start: str = Field("17:00", description="HH:MM format")
    evening_end: str = Field("19:00", description="HH:MM format")
    location_name: Optional[str] = ""
    location_address: Optional[str] = ""
    replace_existing: bool = True



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


class ProviderProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    mobile: Optional[str] = None
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    hospital_clinic_name: Optional[str] = None
    years_of_experience: Optional[int] = None
    medical_license_number: Optional[str] = None
    bio: Optional[str] = None
    fee_justification: Optional[str] = None
    languages_spoken: Optional[List[str]] = None
    urgent_home_visit_fee: Optional[float] = None
    normal_home_visit_fee: Optional[float] = None


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
    if current_user.get("role") not in SCHEDULING_PROVIDER_ROLES:
        raise HTTPException(403, "This account type cannot publish an availability schedule")

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

    if body.days:
        days = [int(d) for d in body.days if 0 <= int(d) <= 6]
        if not days:
            days = [body.day_of_week]
    elif body.apply_to_all_days:
        days = list(range(7))
    else:
        days = [body.day_of_week]

    group_id = str(uuid.uuid4()) if (body.apply_to_all_days or (body.days and len(days) > 1)) else None

    try:
        existing = (
            supabase.table("doctor_availability")
            .select("id, day_of_week, start_time, end_time")
            .eq("doctor_id", current_user["sub"])
            .eq("is_active", True)
            .execute()
        ).data or []
    except Exception as e:
        logger.error(f"Error reading existing availability: {e}")
        existing = []

    if body.replace_existing and (body.apply_to_all_days or body.days):
        try:
            if body.apply_to_all_days:
                supabase.table("doctor_availability").delete().eq(
                    "doctor_id", current_user["sub"]
                ).execute()
                existing = []
            elif body.days:
                for d in days:
                    supabase.table("doctor_availability").delete().eq(
                        "doctor_id", current_user["sub"]
                    ).eq("day_of_week", d).execute()
                existing = [row for row in existing if row.get("day_of_week") not in days]
        except Exception as e:
            logger.error(f"Error clearing availability: {e}")

    def overlaps(day: int) -> bool:
        """Two blocks on the same day overlap if each starts before the other ends."""
        for row in existing:
            if row.get("day_of_week") != day:
                continue
            if str(row.get("start_time", ""))[:5] < body.end_time and \
               body.start_time < str(row.get("end_time", ""))[:5]:
                return True
        return False

    records, skipped = [], []
    for day in days:
        if overlaps(day):
            # Overlapping availability produces double-booked slots, so a clash
            # is reported rather than written. Skipping only the clashing day
            # keeps the rest of an "apply to all" usable.
            skipped.append(day)
            continue
        records.append({**record, "id": str(uuid.uuid4()), "day_of_week": day,
                        "template_group_id": group_id})

    if not records:
        raise HTTPException(
            409,
            "That time already overlaps an existing block on "
            + ("every day" if body.apply_to_all_days else "that day"),
        )

    try:
        supabase.table("doctor_availability").insert(records).execute()
    except Exception as e:
        logger.error(f"Error creating availability: {e}")
        raise HTTPException(500, "Failed to create availability")

    message = f"Availability added for {len(records)} day(s)"
    if skipped:
        names = ", ".join(DAY_NAMES[d] for d in skipped)
        message += f". Skipped {names} — an existing block already covers that time."

    return {
        "success": True,
        "message": message,
        "created": len(records),
        "skipped_days": skipped,
        "template_group_id": group_id,
        "availability": records,
    }


@router.post("/availability/shifts")
async def create_shift_availability(
    body: ShiftScheduleCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Publish shift-based availability (Morning & Evening Shifts) across selected days
    with custom slot durations (starting from 10 minutes).
    Matches enterprise clinical workstation standards.
    """
    if current_user.get("role") not in SCHEDULING_PROVIDER_ROLES:
        raise HTTPException(403, "This account type cannot publish availability shifts")

    if not supabase:
        raise HTTPException(500, "Database not configured")

    if not body.morning_shift_enabled and not body.evening_shift_enabled:
        raise HTTPException(400, "At least one shift (Morning or Evening) must be enabled.")

    selected_days = [int(d) for d in body.selected_days if 0 <= int(d) <= 6]
    if not selected_days:
        raise HTTPException(400, "Please select at least one day of the week.")

    # Validate shift times
    shifts_to_create = []
    if body.morning_shift_enabled:
        try:
            m_start = datetime.strptime(body.morning_start, "%H:%M").time()
            m_end = datetime.strptime(body.morning_end, "%H:%M").time()
            if m_start >= m_end:
                raise HTTPException(400, "Morning shift start time must be before end time")
            shifts_to_create.append({"name": "Morning Shift", "start": body.morning_start, "end": body.morning_end})
        except ValueError:
            raise HTTPException(400, "Invalid morning shift time format (use HH:MM)")

    if body.evening_shift_enabled:
        try:
            e_start = datetime.strptime(body.evening_start, "%H:%M").time()
            e_end = datetime.strptime(body.evening_end, "%H:%M").time()
            if e_start >= e_end:
                raise HTTPException(400, "Evening shift start time must be before end time")
            shifts_to_create.append({"name": "Evening Shift", "start": body.evening_start, "end": body.evening_end})
        except ValueError:
            raise HTTPException(400, "Invalid evening shift time format (use HH:MM)")

    # Overlap check between morning and evening if both enabled
    if body.morning_shift_enabled and body.evening_shift_enabled:
        if body.morning_end > body.evening_start:
            raise HTTPException(400, "Morning shift cannot overlap with evening shift")

    # If replace_existing is requested, wipe existing availability for those days & mode
    if body.replace_existing:
        try:
            for day in selected_days:
                supabase.table("doctor_availability").delete().eq(
                    "doctor_id", current_user["sub"]
                ).eq("day_of_week", day).eq("consultation_mode", body.consultation_mode).execute()
        except Exception as e:
            logger.error(f"Error resetting existing shifts: {e}")

    # Build shift records
    records = []
    group_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    for day in selected_days:
        for s in shifts_to_create:
            records.append({
                "id": str(uuid.uuid4()),
                "doctor_id": current_user["sub"],
                "day_of_week": day,
                "start_time": s["start"],
                "end_time": s["end"],
                "slot_duration_minutes": body.slot_duration_minutes,
                "consultation_mode": body.consultation_mode,
                "max_patients_per_slot": 1,
                "location_name": body.location_name or "",
                "location_address": body.location_address or "",
                "is_active": True,
                "template_group_id": group_id,
                "created_at": now_iso,
                "updated_at": now_iso,
            })

    if not records:
        raise HTTPException(400, "No shift records to publish")

    try:
        supabase.table("doctor_availability").insert(records).execute()
    except Exception as e:
        logger.error(f"Error inserting shifts: {e}")
        raise HTTPException(500, "Failed to publish shift availability")

    # Calculate estimated slots per day and week
    total_daily_mins = 0
    for s in shifts_to_create:
        st = datetime.strptime(s["start"], "%H:%M")
        et = datetime.strptime(s["end"], "%H:%M")
        total_daily_mins += int((et - st).total_seconds() / 60)

    slots_per_day = total_daily_mins // body.slot_duration_minutes
    total_slots_week = slots_per_day * len(selected_days)

    return {
        "success": True,
        "message": f"Successfully published {len(records)} shift block(s) across {len(selected_days)} day(s).",
        "days_count": len(selected_days),
        "shifts_per_day": len(shifts_to_create),
        "slots_per_day": slots_per_day,
        "total_slots_week": total_slots_week,
        "template_group_id": group_id,
        "created_records_count": len(records),
    }


@router.put("/availability/{availability_id}")
async def update_availability(
    availability_id: str,
    body: AvailabilityUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Doctor updates an existing availability block."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Editing a single day of an "all days" template detaches that day from the
    # group. Otherwise a later group-wide edit would silently overwrite the
    # exception the doctor deliberately made — the classic recurring-event trap.
    updates["template_group_id"] = None

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
        return {
            "success": True,
            "message": "Availability updated for this day only",
            "detached_from_group": True,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating availability: {e}")
        raise HTTPException(500, "Failed to update availability")


@router.put("/availability/group/{group_id}")
async def update_availability_group(
    group_id: str,
    body: AvailabilityUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Edit every day of an "apply to all days" template at once.

    Days the doctor has since edited individually are already detached from the
    group, so they keep their exception rather than being pulled back in.
    """
    if not supabase:
        raise HTTPException(500, "Database not configured")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        result = (
            supabase.table("doctor_availability")
            .update(updates)
            .eq("template_group_id", group_id)
            .eq("doctor_id", current_user["sub"])
            .execute()
        )
        rows = result.data or []
        if not rows:
            raise HTTPException(404, "No availability found for that schedule")
        return {
            "success": True,
            "message": f"Updated {len(rows)} day(s)",
            "updated": len(rows),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating availability group: {e}")
        raise HTTPException(500, "Failed to update schedule")


@router.delete("/availability/group/{group_id}")
async def delete_availability_group(
    group_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove every day of an "apply to all days" template in one action."""
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        result = (
            supabase.table("doctor_availability")
            .delete()
            .eq("template_group_id", group_id)
            .eq("doctor_id", current_user["sub"])
            .execute()
        )
        removed = len(result.data or [])
        return {
            "success": True,
            "message": f"Removed {removed} day(s)",
            "removed": removed,
        }
    except Exception as e:
        logger.error(f"Error deleting availability group: {e}")
        raise HTTPException(500, "Failed to remove schedule")


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
    if current_user.get("role") not in SCHEDULING_PROVIDER_ROLES:
        raise HTTPException(403, "This account type cannot set consultation fees")

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


@router.post("/fees/apply-standard")
async def apply_standard_tariffs(
    current_user: dict = Depends(get_current_user),
):
    """
    Apply official CallMedex MOU benchmark prices in 1-click:
    - In-Person Clinic Consultation: ₹500 (Doctor net: ₹400)
    - Online Teleconsultation: ₹400 (Doctor net: ₹320)
    - Doorstep Home Clinical Visit: ₹800 (Doctor net: ₹640)
    """
    if current_user.get("role") not in SCHEDULING_PROVIDER_ROLES:
        raise HTTPException(403, "This account type cannot set consultation fees")

    if not supabase:
        raise HTTPException(500, "Database not configured")

    standard_tariffs = [
        {"fee_type": "in_person", "amount": 500},
        {"fee_type": "online", "amount": 400},
        {"fee_type": "home_visit", "amount": 800},
    ]

    now_iso = datetime.now(timezone.utc).isoformat()
    saved = []

    for t in standard_tariffs:
        try:
            existing = (
                supabase.table("consultation_fees")
                .select("id")
                .eq("doctor_id", current_user["sub"])
                .eq("fee_type", t["fee_type"])
                .execute()
            )
            if existing.data:
                supabase.table("consultation_fees").update({
                    "amount": t["amount"],
                    "updated_at": now_iso,
                }).eq("id", existing.data[0]["id"]).execute()
            else:
                supabase.table("consultation_fees").insert({
                    "id": str(uuid.uuid4()),
                    "doctor_id": current_user["sub"],
                    "fee_type": t["fee_type"],
                    "amount": t["amount"],
                    "currency": "INR",
                    "is_active": True,
                    "set_by": "mou_standard",
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }).execute()
            saved.append(t)
        except Exception as e:
            logger.error(f"Error applying standard fee for {t['fee_type']}: {e}")

    return {
        "success": True,
        "message": "CallMedex official MOU standard tariffs successfully applied.",
        "fees": saved,
    }


# ─── Provider MOU & Legal Agreement Viewer ───────────────────────────────────

@router.get("/mou")
async def get_provider_mou(
    subtype: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Get official active MOU and legal acceptance details for the authenticated provider.
    Accessible from Doctor Profile and other provider profile workstations.
    """
    from app.services.legal import LegalService
    role = current_user.get("role", "doctor")
    doc = LegalService.get_active_document(role, subtype=subtype)

    acceptance = None
    if supabase:
        try:
            acc_res = (
                supabase.table("legal_acceptances")
                .select("*")
                .eq("user_id", current_user["sub"])
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if acc_res.data:
                acceptance = acc_res.data[0]
        except Exception as e:
            logger.warning(f"Could not read legal acceptance for user {current_user['sub']}: {e}")

    return {
        "success": True,
        "document": doc,
        "acceptance": acceptance,
        "role": role,
    }


# ─── Provider Profile & Presentation Editor ──────────────────────────────────

@router.put("/profile")
async def update_provider_profile(
    body: ProviderProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Update provider's profile, bio, fee justification, and clinical presentation.
    Persists credentials to role table (doctors/nurses/etc) and presentation to documents store.
    """
    user_id = current_user["sub"]
    role = current_user.get("role", "doctor")

    user_updates = {}
    if body.full_name is not None:
        user_updates["full_name"] = body.full_name
    if body.mobile is not None:
        user_updates["mobile"] = body.mobile

    if user_updates and supabase:
        try:
            supabase.table("users").update(user_updates).eq("id", user_id).execute()
        except Exception as e:
            logger.error(f"Failed to update users table: {e}")

    # Role table updates
    from app.routers.auth import ROLE_TABLE_MAP
    role_table = None
    for r_enum, t_name in ROLE_TABLE_MAP.items():
        if (isinstance(r_enum, str) and r_enum == role) or (hasattr(r_enum, "value") and r_enum.value == role):
            role_table = t_name
            break

    if not role_table:
        role_table = "doctors" if role == "doctor" else None

    role_updates = {}
    if body.specialization is not None:
        role_updates["specialization"] = body.specialization
    if body.qualification is not None:
        role_updates["qualification"] = body.qualification
    if body.hospital_clinic_name is not None:
        role_updates["hospital_clinic_name"] = body.hospital_clinic_name
        if role == "dentist":
            role_updates["clinic_name"] = body.hospital_clinic_name
    if body.years_of_experience is not None:
        role_updates["years_of_experience"] = body.years_of_experience
    if body.medical_license_number is not None:
        role_updates["medical_license_number"] = body.medical_license_number
        if role in ("nurse", "dentist", "dietitian", "physiotherapist"):
            role_updates["license_number"] = body.medical_license_number
    if body.languages_spoken is not None:
        role_updates["languages_spoken"] = body.languages_spoken

    if role_table and role_updates and supabase:
        try:
            up_res = supabase.table(role_table).update(role_updates).eq("user_id", user_id).execute()
            if not up_res.data:
                role_updates["id"] = str(uuid.uuid4())
                role_updates["user_id"] = user_id
                supabase.table(role_table).insert(role_updates).execute()
        except Exception as e:
            logger.error(f"Failed to update role table {role_table}: {e}")

    # Bio and Fee Justification Presentation Storage
    presentation_data = {}
    if body.bio is not None:
        presentation_data["bio"] = body.bio
    if body.fee_justification is not None:
        presentation_data["fee_justification"] = body.fee_justification
    if body.urgent_home_visit_fee is not None:
        presentation_data["urgent_home_visit_fee"] = body.urgent_home_visit_fee
    if body.normal_home_visit_fee is not None:
        presentation_data["normal_home_visit_fee"] = body.normal_home_visit_fee

    if (body.bio is not None or body.fee_justification is not None or body.urgent_home_visit_fee is not None or body.normal_home_visit_fee is not None) and supabase:
        try:
            # Check for existing presentation doc
            existing = (
                supabase.table("documents")
                .select("id, verification_notes")
                .eq("user_id", user_id)
                .eq("document_type", "provider_presentation")
                .order("uploaded_at", desc=True)
                .limit(1)
                .execute()
            )
            merged_notes = {}
            if existing.data and existing.data[0].get("verification_notes"):
                try:
                    merged_notes = json.loads(existing.data[0]["verification_notes"])
                except Exception:
                    merged_notes = {}
            merged_notes.update(presentation_data)

            if existing.data:
                supabase.table("documents").update({
                    "verification_notes": json.dumps(merged_notes),
                }).eq("id", existing.data[0]["id"]).execute()
            else:
                supabase.table("documents").insert({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "document_type": "provider_presentation",
                    "file_name": "presentation.json",
                    "file_url": "internal://presentation",
                    "verification_notes": json.dumps(merged_notes),
                    "verification_status": "verified",
                }).execute()
        except Exception as pe:
            logger.error(f"Failed to store presentation document: {pe}")

    return {
        "success": True,
        "message": "Provider profile, presentation, and fee justification saved successfully.",
        "data": {
            **user_updates,
            **role_updates,
            **presentation_data,
        },
    }



# ─── Generate Bookable Slots for a Date ───────────────────────────────────

@router.get("/slots")
async def get_available_slots(
    provider_id: str = Query(..., description="Provider user ID"),
    target_date: str = Query(..., description="YYYY-MM-DD"),
    mode: Optional[str] = Query(
        None,
        description="Filter to one consultation mode: in_person, online or home_visit",
    ),
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    """
    Generate bookable slots for a provider (doctor, physiotherapist, dietitian
    or nurse) on a specific date. Reads their weekly availability, checks for
    blocked dates, and removes already-booked slots.

    `mode` matters for providers who work more than one way: a physiotherapist
    publishes walk-in centre hours AND online consultation hours, and a patient
    booking a walk-in appointment must not be shown the teleconsult slots.
    """
    if not supabase:
        raise HTTPException(500, "Database not configured")

    try:
        target = datetime.strptime(target_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")

    # Everything here is IST wall-clock: slot times are stored that way and the
    # patient is in India. The server runs UTC in production.
    ist_now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    ist_today = ist_now.date()

    # Don't allow booking in the past
    if target < ist_today:
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
        avail_query = (
            supabase.table("doctor_availability")
            .select("*")
            .eq("doctor_id", provider_id)
            .eq("day_of_week", db_day)
            .eq("is_active", True)
        )
        if mode:
            avail_query = avail_query.eq("consultation_mode", mode)
        avail_result = avail_query.execute()
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
        location = avail.get("location_name", "") or ""

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

            # For today, skip slots that have already passed.
            #
            # Slot times are IST wall-clock. datetime.now() is the SERVER's
            # local time, which is UTC in production — so this compared 18:00
            # IST against 12:30 UTC and happily offered appointments five hours
            # in the past. Compare in IST on both sides.
            if target == ist_today and current.time() <= ist_now.time():
                current += timedelta(minutes=duration)
                continue

            all_slots.append({
                "time": slot_time_str,
                "end_time": slot_end_str,
                # %-I is a glibc extension that raises ValueError on Windows.
                "display": f"{(current.hour % 12) or 12}:{current.minute:02d} {'AM' if current.hour < 12 else 'PM'}",
                "consultation_mode": mode,
                "max_patients": max_patients,
                "is_available": not is_booked,
                "location": location,
                "location_address": avail.get("location_address", ""),
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
    if current_user.get("role") not in ("organization", "admin", "processing_center"):
        raise HTTPException(403, "Only organizations can add doctors")

    if not supabase:
        raise HTTPException(500, "Database not configured")

    # Find the doctor by email
    try:
        doctor_result = (
            supabase.table("users")
            .select("id, full_name, email")
            .eq("email", body.doctor_email.strip())
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
            .select("id, organization_name")
            .eq("user_id", current_user["sub"])
            .execute()
        )
        if not org_result.data:
            raise HTTPException(404, "Organization profile not found. Complete registration first.")
        org_row = org_result.data[0]
        org_id = org_row["id"]
        org_name = org_row.get("organization_name", "")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finding org: {e}")
        raise HTTPException(500, "Failed to find organization")

    # Auto-populate specialization and fee if not explicitly passed
    spec = (body.specialization or "").strip()
    fee = body.consultation_fee or 0
    try:
        doc_prof = supabase.table("doctors").select("specialization, consultation_fee").eq("user_id", doctor["id"]).limit(1).execute()
        if doc_prof.data:
            if not spec:
                spec = doc_prof.data[0].get("specialization") or ""
            if not fee:
                fee = doc_prof.data[0].get("consultation_fee") or 0
    except Exception as e:
        logger.warning(f"Could not load doctor profile for defaults: {e}")

    # Link doctor
    record = {
        "id": str(uuid.uuid4()),
        "organization_id": org_id,
        "doctor_user_id": doctor["id"],
        "specialization": spec,
        "consultation_fee": fee,
        "is_active": True,
        "joined_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        # Upsert or update existing record if deactivated
        existing_link = (
            supabase.table("organization_doctors")
            .select("id")
            .eq("organization_id", org_id)
            .eq("doctor_user_id", doctor["id"])
            .execute()
        )
        if existing_link.data:
            supabase.table("organization_doctors").update({
                "is_active": True,
                "specialization": spec,
                "consultation_fee": fee,
            }).eq("id", existing_link.data[0]["id"]).execute()
        else:
            supabase.table("organization_doctors").insert(record).execute()

        # Seamlessly associate any doctor availability blocks matching this org name
        if org_name:
            try:
                supabase.table("doctor_availability").update({
                    "organization_id": org_id,
                }).eq("doctor_id", doctor["id"]).ilike("location_name", f"%{org_name}%").execute()
            except Exception as e:
                logger.warning(f"Could not update doctor availability organization_id: {e}")

        return {
            "success": True,
            "message": f"Dr. {doctor['full_name']} added to your organization",
            "doctor": {
                "id": doctor["id"],
                "name": doctor["full_name"],
                "email": doctor["email"],
                "specialization": spec,
                "fee": fee,
            },
        }
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(409, "This doctor is already linked to your organization")
        logger.error(f"Error adding doctor to org: {e}")
        raise HTTPException(500, "Failed to add doctor")


@router.get("/org/doctors")
async def org_list_doctors(current_user: dict = Depends(get_current_user)):
    """Organization lists all their linked doctors enriched with live schedules and credentials."""
    if not supabase:
        return {"success": True, "doctors": []}

    try:
        org_result = (
            supabase.table("organizations")
            .select("id, organization_name")
            .eq("user_id", current_user["sub"])
            .execute()
        )
        if not org_result.data:
            return {"success": True, "doctors": []}

        org_id = org_result.data[0]["id"]
        org_name = org_result.data[0].get("organization_name", "")

        result = (
            supabase.table("organization_doctors")
            .select("*, users!doctor_user_id(id, full_name, email, mobile)")
            .eq("organization_id", org_id)
            .eq("is_active", True)
            .execute()
        )
        raw_doctors = result.data or []
        doc_user_ids = [d.get("doctor_user_id") for d in raw_doctors if d.get("doctor_user_id")]

        # Enrich with doctor profile (qualifications, years of experience, NMC status)
        doc_profiles = {}
        if doc_user_ids:
            try:
                dp_res = (
                    supabase.table("doctors")
                    .select("user_id, qualification, years_of_experience, verification_status, hospital_clinic_name")
                    .in_("user_id", doc_user_ids)
                    .execute()
                )
                for dp in (dp_res.data or []):
                    doc_profiles[dp["user_id"]] = dp
            except Exception as e:
                logger.warning(f"Could not load doctor profiles for org: {e}")

        # Enrich with live doctor_availability blocks updated by the doctor
        doc_avails = {}
        if doc_user_ids:
            try:
                av_res = (
                    supabase.table("doctor_availability")
                    .select("id, doctor_id, day_of_week, start_time, end_time, consultation_mode, location_name, location_address, slot_duration_minutes, is_active")
                    .in_("doctor_id", doc_user_ids)
                    .eq("is_active", True)
                    .order("day_of_week")
                    .order("start_time")
                    .execute()
                )
                for av in (av_res.data or []):
                    doc_avails.setdefault(av["doctor_id"], []).append({
                        "id": av.get("id"),
                        "day_of_week": av.get("day_of_week"),
                        "start_time": str(av.get("start_time", ""))[:5],
                        "end_time": str(av.get("end_time", ""))[:5],
                        "consultation_mode": av.get("consultation_mode"),
                        "slot_duration_minutes": av.get("slot_duration_minutes", 15),
                        "location_name": av.get("location_name", ""),
                        "location_address": av.get("location_address", ""),
                    })
            except Exception as e:
                logger.warning(f"Could not load doctor availability for org: {e}")

        enriched = []
        for d in raw_doctors:
            uid = d.get("doctor_user_id")
            prof = doc_profiles.get(uid, {})
            all_av = doc_avails.get(uid, [])
            # Filter walk-in blocks matching this org or in_person
            walkin_blocks = [
                a for a in all_av
                if a.get("consultation_mode") in ("in_person", "both") or (org_name and org_name.lower() in (a.get("location_name") or "").lower())
            ]
            enriched.append({
                **d,
                "qualification": prof.get("qualification", ""),
                "experience_years": prof.get("years_of_experience", 0),
                "verification_status": prof.get("verification_status", "verified"),
                "hospital_clinic_name": prof.get("hospital_clinic_name") or org_name,
                "availability": all_av,
                "walkin_availability": walkin_blocks,
                "has_active_walkin": len(walkin_blocks) > 0,
                "walkin_blocks_count": len(walkin_blocks),
            })

        return {"success": True, "doctors": enriched}
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
            .select("id, organization_type")
            .eq("user_id", current_user["sub"])
            .execute()
        )
        if not org_result.data:
            raise HTTPException(404, "Organization not found")

        org_id = org_result.data[0]["id"]
        org_type = org_result.data[0].get("organization_type")

        # Strict Diagnostic Center Scope Enforcement
        if org_type == "diagnostic_center":
            if body.service_type == "health_package":
                raise HTTPException(
                    403,
                    "Diagnostic centers cannot offer health packages. Packages are managed centrally by CallMedex.",
                )
            if not is_allowed_diagnostic_center_service(body.name, body.service_type):
                raise HTTPException(
                    400,
                    f"Service '{body.name}' is outside Diagnostic Center Scope. Diagnostic centers can strictly only provide MRI, CT Scans, specialized scans, and CBC/Cultures. Arbitrary blood tests and health packages are prohibited.",
                )

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

        # ── Best-effort dual-write to provider_services ────────────────────
        # The marketplace reads provider_services, not organization_services,
        # so every org service must also appear in the marketplace table for
        # patients to find it. This is best-effort: never fail the main write.
        try:
            provider_user_id = current_user["sub"]
            slug = re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")
            # First try exact slug match, then parameterised name ILIKE.
            # Do NOT use .or_() with inline name — comma in the name breaks
            # PostgREST or-filter parsing.
            catalog = _rows(
                supabase.table("service_catalog")
                .select("id, name")
                .eq("slug", slug)
                .limit(1).execute()
            )
            if not catalog:
                catalog = _rows(
                    supabase.table("service_catalog")
                    .select("id, name")
                    .ilike("name", f"%{body.name}%")
                    .limit(1).execute()
                )
            if catalog:
                cat_id = catalog[0]["id"]
                # Check existing row to decide insert vs update
                existing = _rows(
                    supabase.table("provider_services")
                    .select("id")
                    .eq("provider_user_id", provider_user_id)
                    .eq("catalog_id", cat_id)
                    .limit(1).execute()
                )
                mrp = body.price  # org's price is the MRP
                # provider_services DDL columns (layer0_foundation.sql + phase1 ALTERs):
                #   id, provider_user_id, branch_id, name, category, base_price,
                #   home_available, is_active, created_at, mrp, urgent_available,
                #   catalog_id, turnaround_hours
                # NO updated_at column — see layer0_foundation.sql:47-57.
                if existing:
                    supabase.table("provider_services").update({
                        "provider_user_id": provider_user_id,
                        "catalog_id": cat_id,
                        "name": body.name,
                        "category": body.service_type,
                        "base_price": body.price,
                        "mrp": mrp,
                        "home_available": bool(body.home_collection_available),
                        "is_active": True,
                    }).eq("id", existing[0]["id"]).execute()
                else:
                    supabase.table("provider_services").insert({
                        "id": str(uuid.uuid4()),
                        "provider_user_id": provider_user_id,
                        "catalog_id": cat_id,
                        "name": body.name,
                        "category": body.service_type,
                        "base_price": body.price,
                        "mrp": mrp,
                        "home_available": bool(body.home_collection_available),
                        "is_active": True,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }).execute()
                logger.info("dual-wrote service '%s' to provider_services (catalog=%s)", body.name, cat_id)
            else:
                logger.info("no catalog match for '%s' — skipping dual-write (org-local only)", body.name)
        except Exception as dw_err:
            logger.warning("dual-write to provider_services failed for '%s': %s", body.name, dw_err)

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


@router.get("/org/{org_id}/services")
async def get_organization_public_services(org_id: str):
    """Public endpoint for patients to view active services offered by a diagnostic centre/hospital."""
    if not supabase:
        return {"success": True, "services": []}
    try:
        org_result = (
            supabase.table("organizations")
            .select("id")
            .or_(f"id.eq.{org_id},user_id.eq.{org_id}")
            .execute()
        )
        target_org_id = org_result.data[0]["id"] if org_result.data else org_id

        result = (
            supabase.table("organization_services")
            .select("*")
            .eq("organization_id", target_org_id)
            .eq("is_active", True)
            .order("service_type")
            .execute()
        )
        return {"success": True, "services": result.data or []}
    except Exception as e:
        logger.error(f"Error fetching public org services: {e}")
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


@router.get("/org/diagnostic-scope")
async def get_org_diagnostic_scope():
    """Returns the canonical Diagnostic Center Scope (MRI, CT, Scans, CBC, Cultures) with benchmark MRPs."""
    return {
        "success": True,
        "scope": get_diagnostic_center_scope(),
    }


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
        org_result = supabase.table("organizations").select("id, organization_type").eq("user_id", current_user["sub"]).execute()
        if not org_result.data:
            raise HTTPException(404, "Organization not found")

        org_type = org_result.data[0].get("organization_type")
        if org_type == "diagnostic_center":
            if body.service_type == "health_package":
                raise HTTPException(
                    403,
                    "Diagnostic centers cannot offer health packages. Packages are managed centrally by CallMedex.",
                )
            if not is_allowed_diagnostic_center_service(body.name, body.service_type):
                raise HTTPException(
                    400,
                    f"Service '{body.name}' is outside Diagnostic Center Scope. Diagnostic centers can strictly only provide MRI, CT Scans, specialized scans, and CBC/Cultures.",
                )

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
        org_result = supabase.table("organizations").select("id, organization_name, organization_type").eq("user_id", current_user["sub"]).execute()
        if not org_result.data:
            raise HTTPException(404, "Organization not found")

        org_type = org_result.data[0].get("organization_type")
        if org_type == "diagnostic_center":
            raise HTTPException(
                403,
                "Diagnostic centers cannot create health packages. Health packages are managed centrally by CallMedex.",
            )

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
        bookings_result = supabase.table("bookings").select("id, total_price, patient_id").eq("provider_id", org_id).execute()
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

def _matches_location(
    user: dict, district: Optional[str], state: Optional[str]
) -> bool:
    """District/state match for location-bound discovery.

    "Visakhapatnam" is both a city and a district and signup collected both as
    free text, so one place exists in the data as 'Vizag', 'VISAKHAPATNAM' and
    'Visakhapatnam'. Compare on a normalised key and accept either column, so a
    doctor is not hidden from their own district over a spelling.
    """
    def key(value: Optional[str]) -> str:
        return "".join(ch for ch in (value or "").lower() if ch.isalnum())

    if state:
        s = key(user.get("state"))
        if s and s != key(state):
            return False
    if district:
        want = key(district)
        candidates = {key(user.get("district")), key(user.get("city"))} - {""}
        if candidates and not any(
            c == want or c in want or want in c for c in candidates
        ):
            return False
    return True


SPECIALTY_ALIASES: dict[str, list[str]] = {
    "cardiology": ["cardio", "cardiac", "heart", "pgdcc", "cardiologist"],
    "general medicine": ["general", "physician", "internal medicine", "family medicine", "gp", "mbbs"],
    "dermatology": ["derma", "skin", "dermatologist"],
    "pediatrics": ["pediatric", "paediatric", "child", "pediatrician"],
    "gynecology": ["gynec", "gynaec", "obgyn", "obstetric", "women", "gynecologist"],
    "orthopedics": ["orthopedic", "orthopaedic", "ortho", "bone", "joint", "orthopedist"],
    "ent": ["ent", "ear", "nose", "throat", "otolaryngol"],
    "neurology": ["neuro", "brain", "neurologist"],
    "psychiatry": ["psych", "mental", "psychiatrist"],
    "dentistry": ["dent", "oral", "dentist"],
    "ophthalmology": ["ophthal", "eye", "vision", "ophthalmologist"],
    "pulmonology": ["pulmo", "chest", "respiratory", "lung", "pulmonologist"],
}


def matches_specialty(doc_spec: str, requested: Optional[str]) -> bool:
    """Semantic match between a doctor's specialization and user requested filter."""
    if not requested or requested.strip().lower() in ("all", ""):
        return True
    req = "".join(ch for ch in requested.lower() if ch.isalnum())
    doc = "".join(ch for ch in (doc_spec or "").lower() if ch.isalnum())
    if not doc:
        return False
    if req in doc or doc in req:
        return True

    # Match aliases/synonyms
    for cat_name, aliases in SPECIALTY_ALIASES.items():
        cat_key = "".join(ch for ch in cat_name if ch.isalnum())
        # Check if the requested filter targets this category
        if cat_key in req or req in cat_key or any(a in req for a in aliases):
            if any(a in doc for a in aliases) or cat_key in doc:
                return True
    return False


@router.get("/search/doctors")
async def search_doctors(
    specialization: Optional[str] = None,
    city: Optional[str] = None,
    district: Optional[str] = None,
    state: Optional[str] = None,
    consultation_mode: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(20, le=50),
):
    """
    Public endpoint: search for doctors.
    Used by the patient booking page to find real providers.

    `consultation_mode` is matched against what the doctor actually published
    (availability blocks + tariffs), not the single legacy enum column — see
    app/services/provider_modes. `district`/`state` scope in-person and
    home-visit discovery to where the doctor can physically go; video
    consultation is deliberately nationwide and passes neither.
    """
    if not supabase:
        return {"success": True, "doctors": []}

    try:
        query = (
            supabase.table("doctors")
            .select("*, users!inner(id, full_name, email, city, district, state, owner_email, registrant_role)")
            .eq("verification_status", "verified")
        )

        if city:
            query = query.ilike("users.city", f"%{city}%")

        # Over-fetch so Python semantic specialization and mode resolution
        # do not drop valid matches through rigid SQL substrings.
        result = query.limit(200 if (consultation_mode or specialization) else limit).execute()
        doctors = [d for d in (result.data or []) if not is_test_persona(d.get("users") or {})]

        if specialization:
            doctors = [d for d in doctors if matches_specialty(d.get("specialization", ""), specialization)]

        if consultation_mode:
            published = provider_modes.resolve_modes(
                [d.get("user_id") for d in doctors]
            )
            doctors = [
                d for d in doctors
                if provider_modes.offers_mode(
                    published.get(d.get("user_id"), set()),
                    d.get("consultation_mode"),
                    consultation_mode,
                )
            ]

        if district or state:
            doctors = [d for d in doctors if _matches_location(d.get("users") or {}, district, state)]

        doctors = doctors[:limit]

        # Batch-fetch presentation data (bio and fee justification) from documents
        doc_user_ids = [d.get("user_id") for d in doctors if d.get("user_id")]
        presentation_map: dict[str, dict[str, str]] = {}
        if doc_user_ids:
            try:
                pres_res = (
                    supabase.table("documents")
                    .select("user_id, verification_notes")
                    .in_("user_id", doc_user_ids)
                    .eq("document_type", "provider_presentation")
                    .execute()
                )
                for row in (pres_res.data or []):
                    try:
                        notes = json.loads(row.get("verification_notes") or "{}")
                        presentation_map[row["user_id"]] = {
                            "bio": notes.get("bio", ""),
                            "fee_justification": notes.get("fee_justification", ""),
                        }
                    except Exception:
                        pass
            except Exception as e:
                logger.warning(f"Could not load provider presentations: {e}")

        # Enrich with fees and presentation
        enriched = []
        for doc in doctors:
            user: Any = doc.get("users", {})
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

            pres = presentation_map.get(doc_user_id, {})
            enriched.append({
                "id": doc_user_id,
                "name": user.get("full_name", ""),
                "specialization": doc.get("specialization", ""),
                "qualification": doc.get("qualification", ""),
                "experience_years": doc.get("years_of_experience", 0),
                "consultation_mode": doc.get("consultation_mode", "both"),
                "consultation_modes": sorted(
                    provider_modes.resolve_modes([doc_user_id]).get(doc_user_id)
                    or provider_modes.normalise_mode(doc.get("consultation_mode"))
                ),
                "hospital_clinic_name": doc.get("hospital_clinic_name") or "",
                "bio": pres.get("bio") or doc.get("bio") or "",
                "fee_justification": pres.get("fee_justification") or doc.get("fee_justification") or "",
                "verification_status": doc.get("verification_status") or "verified",
                "city": user.get("city", ""),
                "district": user.get("district", ""),
                "state": user.get("state", ""),
                "fees": fees,
                "consultation_fee": (fees.get("home_visit") if consultation_mode == "home_visit" else None) or fees.get("in_person") or fees.get("online") or doc.get("consultation_fee") or 500,
                "home_visit_fee": fees.get("home_visit") or doc.get("home_visit_fee"),
                "in_person_fee": fees.get("in_person") or doc.get("consultation_fee") or 500,
                "online_fee": fees.get("online") or fees.get("teleconsultation") or 500,
                "languages": doc.get("languages_spoken", ["English"]),
            })

        return {"success": True, "doctors": enriched}
    except Exception as e:
        logger.error(f"Error searching doctors: {e}")
        return {"success": True, "doctors": []}


@router.get("/doctor/{doctor_id}/presentation")
async def get_doctor_presentation(doctor_id: str):
    """Public endpoint to fetch doctor professional presentation and fee justification."""
    if not supabase:
        raise HTTPException(500, "Database not configured")
    try:
        # Match either by user_id or doctor id
        doc_res = (
            supabase.table("doctors")
            .select("*, users!inner(id, full_name, email, city, district, state, owner_email, registrant_role)")
            .or_(f"user_id.eq.{doctor_id},id.eq.{doctor_id}")
            .limit(1)
            .execute()
        )
        if not doc_res.data:
            raise HTTPException(404, "Doctor not found")

        doc = doc_res.data[0]
        user = doc.get("users", {})
        if is_test_persona(user):
            raise HTTPException(404, "Doctor not found")

        uid = user.get("id") or doc.get("user_id")

        # Fetch fees
        fees = {}
        try:
            fees_res = (
                supabase.table("consultation_fees")
                .select("fee_type, amount")
                .eq("doctor_id", uid)
                .eq("is_active", True)
                .execute()
            )
            for f in (fees_res.data or []):
                fees[f["fee_type"]] = f["amount"]
        except Exception:
            pass

        if not fees and doc.get("consultation_fee"):
            fees["in_person"] = doc["consultation_fee"]

        # Fetch presentation notes from documents
        bio = ""
        fee_justification = ""
        try:
            pres_res = (
                supabase.table("documents")
                .select("verification_notes")
                .eq("user_id", uid)
                .eq("document_type", "provider_presentation")
                .order("uploaded_at", desc=True)
                .limit(1)
                .execute()
            )
            if pres_res.data and pres_res.data[0].get("verification_notes"):
                notes = json.loads(pres_res.data[0]["verification_notes"])
                bio = notes.get("bio", "")
                fee_justification = notes.get("fee_justification", "")
        except Exception:
            pass

        # Fetch availability blocks
        av_res = (
            supabase.table("doctor_availability")
            .select("day_of_week, start_time, end_time, consultation_mode, location_name, location_address, slot_duration_minutes")
            .eq("doctor_id", uid)
            .eq("is_active", True)
            .order("day_of_week")
            .order("start_time")
            .execute()
        )

        return {
            "success": True,
            "doctor": {
                "id": uid,
                "name": user.get("full_name", ""),
                "specialization": doc.get("specialization", ""),
                "qualification": doc.get("qualification", ""),
                "experience_years": doc.get("years_of_experience", 0),
                "hospital_clinic_name": doc.get("hospital_clinic_name") or "",
                "bio": bio,
                "fee_justification": fee_justification,
                "fees": fees,
                "consultation_fee": fees.get("in_person") or doc.get("consultation_fee") or 500,
                "home_visit_fee": fees.get("home_visit") or doc.get("home_visit_fee"),
                "in_person_fee": fees.get("in_person") or doc.get("consultation_fee") or 500,
                "online_fee": fees.get("online") or fees.get("teleconsultation") or 500,
                "verification_status": doc.get("verification_status", "verified"),
                "city": user.get("city", ""),
                "district": user.get("district", ""),
                "state": user.get("state", ""),
                "availability": av_res.data or [],
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching doctor presentation: {e}")
        raise HTTPException(500, "Failed to fetch doctor presentation")


@router.get("/search/providers")
async def search_providers(
    type: Optional[str] = None,
    city: Optional[str] = None,
    home_service: Optional[bool] = None,
    q: Optional[str] = None,
    limit: int = Query(50, le=100),
):
    """Marketplace search — verified + listed providers only, from provider_directory."""
    if not supabase:
        return {"success": True, "providers": []}
    try:
        query = (supabase.table("provider_directory").select("*")
                 .eq("verification_status", "verified").eq("is_listed", True))
        if type:
            t = "diagnostic_center" if type in ("lab", "diagnostic") else type
            query = query.eq("subtype", t) if t in (
            "diagnostic_center", "hospital", "clinic", "poly_clinic", "polyclinic",
            "dental_clinic", "physiotherapy_center", "nursing_home",
        ) else query.eq("provider_type", t)
        if home_service is True:
            query = query.eq("home_service_enabled", True)
        rows = [r for r in (query.limit(100).execute().data or []) if not is_test_persona(r)]

        out = []
        for r in rows:
            if city and city.strip().lower() not in f"{r.get('city','')} {r.get('state','')}".lower():
                continue
            if q and q.strip().lower() not in f"{r.get('display_name','')} {r.get('subtype','')} {r.get('city','')}".lower():
                continue
            # min price rollup (per-row isolated — one bad row must not blank the whole page)
            min_price = None
            try:
                svc = (supabase.table("provider_services").select("base_price")
                       .eq("provider_user_id", r["provider_user_id"]).eq("is_active", True)
                       .order("base_price").limit(1).execute()).data
                if svc:
                    min_price = float(svc[0]["base_price"])
            except Exception:
                min_price = None
            out.append({**r, "min_price": min_price})
            if len(out) >= limit:
                break
        return {"success": True, "providers": out}
    except Exception as e:
        logger.error(f"search_providers error: {e}")
        return {"success": True, "providers": []}


@router.get("/{provider_user_id}/catalog")
async def provider_catalog(provider_user_id: str):
    """Public: a provider's bookable services + packages from the canonical
    marketplace tables (provider_services / provider_packages), keyed by users.id —
    the id the marketplace search returns."""
    if not supabase:
        return {"success": True, "services": [], "packages": []}
    services, packages = [], []
    try:
        services = (
            supabase.table("provider_services").select("*")
            .eq("provider_user_id", provider_user_id).eq("is_active", True)
            .order("base_price").execute()
        ).data or []
    except Exception as e:
        logger.error(f"provider_catalog services error: {e}")
    try:
        packages = (
            supabase.table("provider_packages").select("*")
            .eq("provider_user_id", provider_user_id).eq("is_active", True)
            .eq("status", "approved").execute()
        ).data or []
    except Exception as e:
        logger.error(f"provider_catalog packages error: {e}")
    return {"success": True, "services": services, "packages": packages}


@router.get("/search/organizations")
async def search_organizations(org_type: Optional[str] = None, city: Optional[str] = None,
                               q: Optional[str] = None, limit: int = 50,
                               exclude_diagnostic: Optional[bool] = None):
    """Back-compat wrapper → verified orgs from provider_directory.
    
    Pass exclude_diagnostic=true to omit diagnostic_center and laboratory
    types — used by the doctor-appointment booking flow so that patients
    only see hospitals, polyclinics and clinics, never diagnostic centres.
    """
    res = await search_providers(type=org_type or "organization", city=city, q=q, limit=limit)
    DIAGNOSTIC_SUBTYPES = {"diagnostic_center", "diagnostic", "laboratory"}
    orgs = [{
        "id": p["provider_user_id"], "user_id": p["provider_user_id"],
        "name": p["display_name"], "organization_name": p["display_name"],
        "type": p["subtype"], "organization_type": p["subtype"],
        "city": p.get("city", ""), "state": p.get("state", ""),
        # Present once the provider_directory district migration runs; "" until
        # then and the client falls back to city matching.
        "district": p.get("district", ""),
        "verification_status": p["verification_status"], "min_price": p.get("min_price"),
    } for p in res["providers"]
        if (p["provider_type"] == "organization" or (org_type and org_type != "doctor"))
        and (not exclude_diagnostic or p.get("subtype", "") not in DIAGNOSTIC_SUBTYPES)]
    return {"success": True, "organizations": orgs}


@router.get("/search/packages")
async def search_packages(limit: int = Query(50, le=100)):
    if not supabase:
        return {"success": True, "packages": []}
    try:
        result = (supabase.table("provider_packages").select("*")
                  .eq("is_active", True).eq("status", "approved").limit(limit).execute())
        return {"success": True, "packages": result.data or []}
    except Exception as e:
        logger.error(f"Error fetching packages: {e}")
        return {"success": True, "packages": []}

