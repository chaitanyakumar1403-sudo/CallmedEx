"""
Roster endpoints.

The centre marks who is available tomorrow; the assignment pass runs at the
roster_cutoff. A phlebotomist sees their advance list this evening and may
decline, which reassigns rather than cancels.
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import get_current_user
from app.middleware.pc_auth import get_current_pc_staff, require_pc_admin
from app.services.roster import decline_job, run_roster_pass

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Roster"])


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


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
async def my_jobs(date: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "phlebotomist":
        raise HTTPException(status_code=403, detail="Phlebotomists only.")
    return {"jobs": _rows(
        supabase.table("dispatch_requests").select("*")
        .eq("assigned_provider_id", user.get("sub"))
        .eq("scheduled_for", date).execute()
    )}


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
    if result is None:
        # Nobody left. The centre picks it up manually rather than it vanishing.
        return {"reassigned": False, "needs_manual_assignment": True}
    return {"reassigned": True, "assigned_to": result["phlebotomist_user_id"]}
