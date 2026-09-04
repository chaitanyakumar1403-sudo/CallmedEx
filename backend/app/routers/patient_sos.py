"""
Patient Emergency SOS & Medication Radar Router
Provides endpoints for emergency SOS dispatch and medicine cabinet management.
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import get_current_user
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/patient", tags=["Patient Emergency & Meds"])


class SOSTriggerPayload(BaseModel):
    lat: Optional[float] = Field(None, json_schema_extra={"example": 12.9716})
    lng: Optional[float] = Field(None, json_schema_extra={"example": 77.5946})
    notes: Optional[str] = Field(None, json_schema_extra={"example": "Feeling sudden chest tightness"})


class MedicationRefill(BaseModel):
    """Omit remaining_pills to refill back to the full pack size."""
    remaining_pills: Optional[int] = None


class MedicationIn(BaseModel):
    medicine_name: str
    dosage: str
    total_pills: int
    remaining_pills: int
    pills_per_day: int = 1
    refill_date: Optional[str] = None


@router.post("/sos/trigger")
async def trigger_emergency_sos(
    payload: SOSTriggerPayload,
    user: dict = Depends(get_current_user)
):
    """
    Triggers emergency SOS, notifies contacts via SMS/WhatsApp simulation, and logs alert.
    """
    account_id = user.get("sub")
    timestamp = datetime.now(timezone.utc).isoformat()

    try:
        contacts = _rows(
            supabase.table("emergency_sos_contacts")
            .select("*")
            .eq("patient_id", account_id)
            .eq("is_active", True)
            .execute()
        )
    except Exception as exc:
        logger.error(f"Error querying emergency_sos_contacts: {exc}")
        contacts = []

    # There used to be a fabricated fallback contact here -- a hardcoded
    # +919876543210 "Primary Emergency Contact" -- reported back as
    # contacts_notified: 1. In an emergency the patient was told someone had
    # been reached when the number belonged to nobody. If there is no contact
    # on file, say so.
    patient = {}
    try:
        rows = _rows(
            supabase.table("users")
            .select("full_name, mobile")
            .eq("id", account_id).limit(1).execute()
        )
        patient = rows[0] if rows else {}
    except Exception as exc:
        logger.warning(f"SOS: could not read patient record {account_id}: {exc}")

    where = (
        f"https://maps.google.com/?q={payload.lat},{payload.lng}"
        if payload.lat is not None and payload.lng is not None
        else "location unavailable"
    )
    body = (
        f"EMERGENCY: {patient.get('full_name') or 'A CallMedex patient'} has "
        f"triggered an SOS. Location: {where}."
        + (f" Note: {payload.notes}" if payload.notes else "")
    )

    # Actually send. Previously this endpoint only wrote a log line and
    # returned "dispatched", so no contact was ever contacted by any channel.
    from app.services.notification_engine import NotificationEngine
    from app.services.sms_otp import send_transactional_sms

    delivered = 0
    failures = []
    for c in contacts:
        phone = c.get("phone") or c.get("mobile")
        if not phone:
            failures.append(c.get("contact_name") or "unnamed contact")
            continue
        try:
            result = await send_transactional_sms(phone, body)
            if result.get("success"):
                delivered += 1
            else:
                failures.append(c.get("contact_name") or phone)
        except Exception as exc:
            logger.error(f"SOS SMS to {c.get('contact_name')} failed: {exc}")
            failures.append(c.get("contact_name") or phone)

    # The patient's own devices, so the alert is visible in-app too.
    try:
        await NotificationEngine.send_multi(
            user_id=account_id,
            channels=["in_app", "push"],
            title="Emergency SOS raised",
            body=(
                f"Alert sent to {delivered} emergency contact(s)."
                if delivered else
                "No emergency contact could be reached. Call 108 directly."
            ),
            data={"type": "sos", "lat": payload.lat, "lng": payload.lng},
        )
    except Exception as exc:
        logger.error(f"SOS self-notification failed for {account_id}: {exc}")

    alert_id = f"sos-{account_id[:8]}-{int(datetime.now(timezone.utc).timestamp())}"
    try:
        supabase.table("emergency_sos_alerts").insert({
            "id": alert_id,
            "patient_id": account_id,
            "lat": payload.lat,
            "lng": payload.lng,
            "notes": payload.notes or "",
            "contacts_total": len(contacts),
            "contacts_notified": delivered,
            "created_at": timestamp,
        }).execute()
    except Exception as exc:
        # The alert still went out; losing the audit row must not fail the call.
        logger.error(f"SOS alert record insert failed ({alert_id}): {exc}")

    logger.warning(
        f"[SOS ALERT] user={account_id} at={timestamp} "
        f"contacts={len(contacts)} delivered={delivered} failed={len(failures)}"
    )

    if not contacts:
        message = (
            "SOS raised, but you have no emergency contacts saved. "
            "Call 108 for an ambulance now."
        )
    elif delivered == 0:
        message = (
            "SOS raised, but no contact could be reached. "
            "Call 108 for an ambulance now."
        )
    elif failures:
        message = f"SOS sent to {delivered} of {len(contacts)} contacts."
    else:
        message = f"SOS sent to all {delivered} emergency contact(s)."

    return {
        # "dispatched" only when something actually left the building.
        "status": "dispatched" if delivered else "not_delivered",
        "alert_id": alert_id,
        "timestamp": timestamp,
        "location": {"lat": payload.lat, "lng": payload.lng},
        "contacts_total": len(contacts),
        "contacts_notified": delivered,
        "failed_contacts": len(failures),
        "message": message,
    }


@router.get("/sos/contacts")
async def get_emergency_contacts(
    user: dict = Depends(get_current_user)
):
    """
    Retrieve emergency SOS contacts for the authenticated patient.
    """
    account_id = user.get("sub")
    try:
        contacts = _rows(
            supabase.table("emergency_sos_contacts")
            .select("*")
            .eq("patient_id", account_id)
            .execute()
        )
    except Exception as exc:
        logger.warning(f"Error fetching emergency_sos_contacts: {exc}")
        contacts = []

    return {
        "patient_id": account_id,
        "contacts": contacts
    }


def _project_supply(med: dict) -> dict:
    """Burn a medication's pill count down by the days that have actually passed.

    `remaining_pills` was written once at creation and never touched again, so
    the cabinet reported the same "10/10, 5 days supply" months later and the
    refill radar could never fire. Nothing consumes pills on a schedule
    server-side either, so the honest model is to project from the last
    counted date at the prescribed daily rate.

    The stored row is left alone -- this is a read-time projection, so a
    patient who tops up mid-course just posts a refill and resets the anchor.
    """
    out = dict(med)
    try:
        per_day = int(med.get("pills_per_day") or 0)
        counted = int(med.get("remaining_pills") or 0)
    except (TypeError, ValueError):
        return out

    anchor_raw = (
        med.get("last_counted_at") or med.get("updated_at") or med.get("created_at")
    )
    days_elapsed = 0
    if anchor_raw and per_day > 0:
        try:
            anchor = datetime.fromisoformat(str(anchor_raw).replace("Z", "+00:00"))
            if anchor.tzinfo is None:
                anchor = anchor.replace(tzinfo=timezone.utc)
            days_elapsed = max(0, (datetime.now(timezone.utc) - anchor).days)
        except (ValueError, TypeError):
            days_elapsed = 0

    projected = max(0, counted - per_day * days_elapsed) if per_day > 0 else counted
    days_left = projected // per_day if per_day > 0 else None

    out["remaining_pills"] = projected
    out["counted_remaining_pills"] = counted
    out["days_elapsed_since_count"] = days_elapsed
    out["days_left"] = days_left
    # Refill under five days, matching the badge the dashboard shows.
    out["needs_refill"] = days_left is not None and days_left <= 5
    out["out_of_stock"] = projected == 0
    return out


@router.get("/medications")
async def get_patient_medications(
    user: dict = Depends(get_current_user)
):
    """
    Retrieve medicine cabinet items and refill radar for the authenticated patient.
    """
    account_id = user.get("sub")

    try:
        db_rows = _rows(
            supabase.table("patient_medications")
            .select("*")
            .eq("patient_id", account_id)
            .execute()
        )
    except Exception as exc:
        # An empty cabinet and an unreachable database look identical to the
        # patient otherwise, and "you have no medicines" is the more dangerous
        # of the two to show wrongly.
        logger.error(f"Error fetching patient_medications: {exc}")
        raise HTTPException(503, "Could not load your medicine cabinet. Please retry.")

    return {
        "patient_id": account_id,
        "medications": [_project_supply(m) for m in db_rows],
    }


@router.post("/medications/{medication_id}/refill")
async def refill_medication(
    medication_id: str,
    payload: MedicationRefill,
    user: dict = Depends(get_current_user)
):
    """Reset a medication's pill count after the patient restocks.

    The dashboard's "Refill Needed" button had no handler at all, so the badge
    could be raised but never cleared.
    """
    account_id = user.get("sub")
    now = datetime.now(timezone.utc).isoformat()

    existing = _rows(
        supabase.table("patient_medications")
        .select("id, total_pills")
        .eq("id", medication_id).eq("patient_id", account_id)
        .limit(1).execute()
    )
    if not existing:
        raise HTTPException(404, "Medication not found.")

    refilled_to = payload.remaining_pills
    if refilled_to is None:
        refilled_to = existing[0].get("total_pills") or 0
    if refilled_to < 0:
        raise HTTPException(400, "Pill count cannot be negative.")

    try:
        supabase.table("patient_medications").update({
            "remaining_pills": refilled_to,
            "last_counted_at": now,
            "updated_at": now,
        }).eq("id", medication_id).eq("patient_id", account_id).execute()
    except Exception as exc:
        # last_counted_at may not exist on an older deployment; the count reset
        # is the part that matters and must not be lost with it.
        logger.warning(f"Refill with anchor failed for {medication_id}: {exc}")
        try:
            supabase.table("patient_medications").update({
                "remaining_pills": refilled_to, "updated_at": now,
            }).eq("id", medication_id).eq("patient_id", account_id).execute()
        except Exception as retry_exc:
            logger.error(f"Refill failed for {medication_id}: {retry_exc}")
            raise HTTPException(503, "Could not record the refill. Please retry.")

    return {
        "status": "refilled",
        "medication_id": medication_id,
        "remaining_pills": refilled_to,
    }


@router.post("/medications")
async def add_patient_medication(
    payload: MedicationIn,
    user: dict = Depends(get_current_user)
):
    """
    Add a new medication entry into the patient's medicine cabinet.
    """
    account_id = user.get("sub")
    data = payload.model_dump()
    data["patient_id"] = account_id

    # The pill count is only meaningful relative to when it was taken, so
    # _project_supply has an anchor to burn down from. Until
    # database/task13_medication_refill_anchor.sql is applied the column does
    # not exist, and losing the whole prescription over a missing anchor would
    # be far worse than falling back to created_at for the burn-down.
    dated = dict(data)
    dated["last_counted_at"] = datetime.now(timezone.utc).isoformat()

    try:
        created = _rows(
            supabase.table("patient_medications").insert(dated).execute()
        )
    except Exception as exc:
        logger.warning(
            f"Medication insert with last_counted_at failed ({exc}); "
            f"retrying without the anchor column."
        )
        try:
            created = _rows(
                supabase.table("patient_medications").insert(data).execute()
            )
        except Exception as retry_exc:
            # Returning status "created" on a failed insert told the patient
            # their prescription was saved and then lost it -- they stop
            # tracking a medicine they believe the app is watching.
            logger.error(f"Error inserting patient medication: {retry_exc}")
            raise HTTPException(503, "Could not save this medication. Please retry.")

    if not created:
        raise HTTPException(503, "Could not save this medication. Please retry.")

    return {
        "status": "created",
        "medication": _project_supply(created[0]),
    }
