"""
Roster endpoints.

The centre marks who is available tomorrow; the assignment pass runs at the
roster_cutoff. A phlebotomist sees their advance list this evening and may
decline, which reassigns rather than cancels.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import get_current_user
from app.middleware.pc_auth import get_current_pc_staff, require_pc_admin
from app.services.roster import decline_job, run_roster_pass
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Roster"])


class RosterEntry(BaseModel):
    phlebotomist_user_id: str
    status: str = "available"
    max_jobs: int = 0


@router.get("/pc/roster")
async def get_roster(date: str, staff: dict = Depends(get_current_pc_staff)):
    return {"roster": _rows(
        supabase.table("phlebotomist_roster").select("*")
        .eq("processing_center_id", staff["processing_center_id"])
        .eq("roster_date", date).execute()
    )}


@router.put("/pc/roster/{date}")
async def set_roster(date: str, entries: List[RosterEntry],
                     staff: dict = Depends(require_pc_admin)):
    centre = staff["processing_center_id"]
    for entry in entries:
        if entry.status not in ("available", "unavailable", "leave"):
            raise HTTPException(status_code=400, detail=f"Bad status: {entry.status}")
        existing = _rows(
            supabase.table("phlebotomist_roster").select("id")
            .eq("phlebotomist_user_id", entry.phlebotomist_user_id)
            .eq("processing_center_id", centre)
            .eq("roster_date", date).limit(1).execute()
        )
        body = {"status": entry.status, "max_jobs": entry.max_jobs}
        if existing:
            supabase.table("phlebotomist_roster").update(body) \
                .eq("id", existing[0]["id"]).execute()
        else:
            # No roster row for this phlebotomist at THIS centre. Before
            # inserting, confirm the phlebotomist actually belongs here —
            # otherwise a phlebo of another centre with an existing row
            # there would silently fail the unique (phlebotomist_user_id,
            # roster_date) constraint on insert, or worse, if that centre
            # had no row yet, this would create a roster entry for someone
            # who isn't staff here at all.
            phlebo_rows = _rows(
                supabase.table("phlebotomists").select("processing_center_id")
                .eq("user_id", entry.phlebotomist_user_id).limit(1).execute()
            )
            if not phlebo_rows or phlebo_rows[0]["processing_center_id"] != centre:
                raise HTTPException(
                    status_code=403,
                    detail="Phlebotomist does not belong to this processing centre.",
                )
            body.update({
                "processing_center_id": centre,
                "phlebotomist_user_id": entry.phlebotomist_user_id,
                "roster_date": date,
            })
            supabase.table("phlebotomist_roster").insert(body).execute()
    return {"ok": True}


@router.post("/pc/roster/{date}/run")
async def run_pass(date: str, staff: dict = Depends(require_pc_admin)):
    """Force the assignment pass early rather than waiting for the cutoff."""
    assigned = run_roster_pass(staff["processing_center_id"], date)
    return {"assigned": assigned, "count": len(assigned)}


@router.get("/phlebo/jobs")
async def my_jobs(
    date: Optional[str] = Query(None),
    timeframe: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """Fetch advance and scheduled home collection jobs assigned to this phlebotomist."""
    if user.get("role") != "phlebotomist":
        raise HTTPException(status_code=403, detail="Phlebotomists only.")
    
    uid = user.get("sub")
    IST = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(IST)
    today_str = now_ist.strftime("%Y-%m-%d")
    tomorrow_str = (now_ist + timedelta(days=1)).strftime("%Y-%m-%d")

    target_date = None
    if isinstance(date, str) and date.strip():
        target_date = date.strip()
    elif isinstance(timeframe, str) and timeframe.strip().lower() == "today":
        target_date = today_str
    elif isinstance(timeframe, str) and timeframe.strip().lower() == "tomorrow":
        target_date = tomorrow_str

    is_upcoming = isinstance(timeframe, str) and timeframe.strip().lower() == "upcoming"

    # 1. Query dispatch_requests assigned to this phlebotomist
    query = (
        supabase.table("dispatch_requests").select("*")
        .eq("assigned_provider_id", uid)
        .not_.in_("status", ["cancelled", "declined"])
    )
    if target_date:
        query = query.eq("scheduled_for", target_date)
    elif is_upcoming:
        query = query.gte("scheduled_for", today_str)

    raw_jobs = _rows(query.order("scheduled_for", desc=False).execute())
    seen_booking_ids = {j.get("booking_id") for j in raw_jobs if j.get("booking_id")}

    # 2. Also query bookings directly assigned to this phlebotomist
    b_query = (
        supabase.table("bookings").select("*")
        .eq("provider_id", uid)
        .eq("booking_kind", "home_collection")
        .not_.in_("status", ["cancelled", "completed"])
    )
    if target_date:
        b_query = b_query.eq("collection_date", target_date)
    elif is_upcoming:
        b_query = b_query.gte("collection_date", today_str)

    direct_bookings = _rows(b_query.execute())
    for db in direct_bookings:
        if db["id"] not in seen_booking_ids:
            seen_booking_ids.add(db["id"])
            raw_jobs.append({
                "id": f"dr-{db['id'][:8]}",
                "booking_id": db["id"],
                "patient_id": db.get("patient_id"),
                "scheduled_for": db.get("collection_date") or target_date or today_str,
                "status": "provider_accepted",
                "priority": db.get("priority") or "normal",
                "patient_address": (db.get("notes") or "").split("Collection address:")[-1].strip() if "Collection address:" in (db.get("notes") or "") else db.get("collection_city", ""),
                "patient_lat": db.get("collection_lat"),
                "patient_lng": db.get("collection_lng"),
                "_is_direct_booking": True,
            })

    enriched_jobs = []
    for job in raw_jobs:
        b_id = job.get("booking_id")
        b_data = {}
        if b_id:
            try:
                b_res = _rows(supabase.table("bookings").select("*").eq("id", b_id).limit(1).execute())
                if b_res:
                    b_data = b_res[0]
            except Exception:
                pass

        pat_id = job.get("patient_id") or b_data.get("patient_id")
        pat_name = "Patient"
        pat_phone = ""
        if pat_id:
            try:
                u_res = _rows(supabase.table("users").select("full_name, mobile, address").eq("id", pat_id).limit(1).execute())
                if u_res:
                    pat_name = u_res[0].get("full_name") or pat_name
                    pat_phone = u_res[0].get("mobile") or u_res[0].get("phone") or ""
            except Exception:
                pass

        slot_str = b_data.get("slot_id") or ""
        slot_parts = slot_str.split("|")
        slot_time = b_data.get("slot_time") or "06:00"
        if len(slot_parts) == 3 and ":" in slot_parts[2]:
            slot_time = slot_parts[2]
        elif b_data.get("slot_start") and "T" in b_data["slot_start"]:
            try:
                # Convert UTC slot_start to IST time
                dt = datetime.fromisoformat(b_data["slot_start"].replace("Z", "+00:00"))
                dt_ist = dt.astimezone(IST)
                slot_time = dt_ist.strftime("%H:%M")
            except Exception:
                pass

        # Clean display time: e.g. "06:00 AM"
        display_time = slot_time
        try:
            h, m = [int(p) for p in slot_time.split(":")[:2]]
            ampm = "AM" if h < 12 else "PM"
            h12 = h % 12 or 12
            display_time = f"{h12:02d}:{m:02d} {ampm}"
        except Exception:
            pass

        addr = job.get("patient_address") or (b_data.get("notes", "").split("Collection address:")[-1].strip() if "Collection address:" in b_data.get("notes", "") else "") or b_data.get("collection_city") or "Patient address"
        if addr.startswith("\n"):
            addr = addr.strip()

        tests_list = b_data.get("selected_tests") or []

        enriched_jobs.append({
            **job,
            "patient_name": pat_name,
            "patient_phone": pat_phone,
            "patient_address": addr,
            "scheduled_time": display_time,
            "slot_time": display_time,
            "selected_tests": tests_list,
            "tests": tests_list,
            "collection_date": job.get("scheduled_for") or b_data.get("collection_date") or today_str,
            "total_price": b_data.get("total_price") or 0,
            "dispatch_id": job.get("id"),
        })

    return {"jobs": enriched_jobs}


@router.post("/phlebo/jobs/{dispatch_id}/decline")
async def decline(dispatch_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "phlebotomist":
        raise HTTPException(status_code=403, detail="Phlebotomists only.")
    try:
        result = decline_job(dispatch_id, user.get("sub"))
    except ValueError as exc:
        # decline_job raises when this dispatch request is not an advance-mode
        # roster job (realtime/urgent jobs are declined through the offer flow
        # in dispatch_engine instead) — surface that as a client error, not a
        # 500.
        raise HTTPException(status_code=400, detail=str(exc))
    except PermissionError as exc:
        # decline_job raises when the caller is not the phlebotomist actually
        # assigned to this job — never let a phlebotomist decline (and so
        # reassign) another centre's work by guessing a dispatch_id.
        raise HTTPException(status_code=403, detail=str(exc))
    if result is None:
        # Nobody left. The centre picks it up manually rather than it vanishing.
        return {"reassigned": False, "needs_manual_assignment": True}
    return {"reassigned": True, "assigned_to": result["phlebotomist_user_id"]}
