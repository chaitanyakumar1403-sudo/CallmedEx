"""
Phlebo performance stats + availability self-service (DoctorC profile model).

  - GET /api/phlebo/performance  — current-month scorecard from real tables only.
  - POST /api/phlebo/availability — phlebo sets their own roster status for
    today/future dates (own rows only).
  - GET /api/phlebo/roster       — phlebo fetches their own roster rows for
    a date window (default next 7 days).

Every number traces to a real table or the tile is omitted.
"""
import logging
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import get_current_user
from app.services.roster import decline_job
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/phlebo", tags=["Phlebo Stats"])


def _num(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


# ── Performance endpoint ────────────────────────────────────────────────────


@router.get("/performance")
async def performance(user: dict = Depends(get_current_user)):
    """Current-month performance scorecard — real data only.

    Returns:
      slots_completed, cancellation_pct (null when no jobs),
      incentives_month, fines_month.
      late_pct — OMITTED because dispatch_requests has no scheduled_time
      column to compare against.
      rating — OMITTED because no phlebotomist-specific reviews table exists.
    """
    if user.get("role") != "phlebotomist":
        raise HTTPException(status_code=403, detail="Phlebotomists only.")

    user_id = user.get("sub")
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_start_iso = month_start.isoformat()

    # ── Slots completed & cancelled this month ──────────────────────────────
    completed = 0
    cancelled = 0
    if supabase:
        try:
            rows = _rows(
                supabase.table("dispatch_requests")
                .select("status")
                .eq("assigned_provider_id", user_id)
                .gte("created_at", month_start_iso)
                .execute()
            )
            for r in rows:
                st = r.get("status", "")
                if st == "completed":
                    completed += 1
                elif st == "cancelled":
                    cancelled += 1
        except Exception as e:
            logger.error(f"performance dispatch query failed: {e}")

    total = completed + cancelled
    cancellation_pct: Optional[float] = None
    if total > 0:
        cancellation_pct = round((cancelled / total) * 100, 1)

    # ── Wallet incentives & fines this month ────────────────────────────────
    incentives_month = 0.0
    fines_month = 0.0
    if supabase:
        try:
            txn_rows = _rows(
                supabase.table("wallet_transactions")
                .select("reason, direction, amount, created_at")
                .eq("provider_user_id", user_id)
                .execute()
            )
            for t in txn_rows:
                t_created = t.get("created_at", "")
                if t_created < month_start_iso:
                    continue
                reason = t.get("reason", "")
                direction = t.get("direction", "")
                amount = _num(t.get("amount"))
                # Incentives: credit entries with reason 'incentive'
                if reason == "incentive" and direction == "credit":
                    incentives_month += amount
                # Fines: debit entries with reason 'penalty'
                if reason in ("penalty",) and direction == "debit":
                    fines_month += amount
        except Exception as e:
            logger.error(f"performance wallet query failed: {e}")

    return {
        "slots_completed": completed,
        "cancellation_pct": cancellation_pct,
        "incentives_month": round(incentives_month, 2),
        "fines_month": round(fines_month, 2),
        # late_pct: OMITTED — no scheduled_time in dispatch_requests
        # rating: OMITTED — no phlebotomist reviews table
        "month_label": now.strftime("%B %Y"),
    }


# ── Availability self-service ───────────────────────────────────────────────


class AvailabilityRequest(BaseModel):
    date: str  # YYYY-MM-DD
    status: str = "available"  # available | unavailable | leave


@router.post("/availability")
async def set_availability(body: AvailabilityRequest, user: dict = Depends(get_current_user)):
    """Phlebo sets their own roster status for a future/today date.

    The PC can still override via PUT /pc/roster/{date}.
    """
    if user.get("role") != "phlebotomist":
        raise HTTPException(status_code=403, detail="Phlebotomists only.")

    if body.status not in ("available", "unavailable", "leave"):
        raise HTTPException(status_code=400, detail=f"Bad status: {body.status}")

    # Parse and validate date
    try:
        target_date = date.fromisoformat(body.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Only today or future dates — no editing the past
    today = date.today()
    if target_date < today:
        raise HTTPException(status_code=400, detail="Cannot set availability for past dates.")

    user_id = user.get("sub")

    if not supabase:
        return {"ok": True, "simulated": True}

    # Find the phlebotomist's processing_center_id
    phlebo_rows = _rows(
        supabase.table("phlebotomists")
        .select("processing_center_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not phlebo_rows:
        raise HTTPException(status_code=404, detail="Phlebotomist profile not found.")

    centre_id = phlebo_rows[0].get("processing_center_id")
    if not centre_id:
        raise HTTPException(status_code=400, detail="No processing centre assigned.")

    # Upsert own roster row
    existing = _rows(
        supabase.table("phlebotomist_roster")
        .select("id")
        .eq("phlebotomist_user_id", user_id)
        .eq("roster_date", body.date)
        .limit(1)
        .execute()
    )

    if existing:
        supabase.table("phlebotomist_roster").update(
            {"status": body.status}
        ).eq("id", existing[0]["id"]).execute()
    else:
        supabase.table("phlebotomist_roster").insert({
            "phlebotomist_user_id": user_id,
            "processing_center_id": centre_id,
            "roster_date": body.date,
            "status": body.status,
        }).execute()

    # ── Auto-reassign when phlebo marks leave within 2 days ─────────────
    # The MOU requires 2 days' notice. If the phlebo sets leave for today
    # or tomorrow, their advance-scheduled jobs are reassigned immediately
    # to the next-nearest available phlebo of the same centre.
    reassigned: list[dict] = []
    unassigned: list[dict] = []
    if body.status in ("leave", "unavailable"):
        days_until = (target_date - today).days
        if days_until <= 1:  # today or tomorrow
            try:
                # Find all advance dispatch requests assigned to this phlebo
                adv_dispatch = _rows(
                    supabase.table("dispatch_requests")
                    .select("id, booking_id")
                    .eq("assigned_provider_id", user_id)
                    .eq("assignment_mode", "advance")
                    .eq("scheduled_for", body.date)
                    .execute()
                )
                for dr in adv_dispatch:
                    try:
                        result = decline_job(dr["id"], user_id)
                        if result:
                            reassigned.append(result)
                        else:
                            unassigned.append(dr)
                    except (ValueError, PermissionError) as e:
                        logger.warning(f"Could not decline dispatch {dr['id']}: {e}")
                        unassigned.append(dr)
            except Exception as e:
                logger.warning(f"Auto-reassignment failed: {e}")

    return {
        "ok": True,
        "date": body.date,
        "status": body.status,
        "reassigned": reassigned,
        "unassigned": unassigned,
        "warning": (
            f"You have assigned bookings on {body.date} — they have been "
            f"reassigned to another phlebotomist."
            if reassigned
            else (
                f"Some bookings could not be auto-reassigned and need "
                f"manual assignment by the processing centre."
                if unassigned
                else None
            )
        ),
    }


@router.get("/roster")
async def get_roster(
    user: dict = Depends(get_current_user),
    from_date: str = Query("", alias="from"),
    to_date: str = Query("", alias="to"),
):
    """Fetch the caller's own roster rows for a date window.

    Both *from* and *to* are required (YYYY-MM-DD).  Returns a list of
    ``{roster_date, status}`` dicts.  Days without a row are treated as
    Available by the frontend.
    """
    if user.get("role") != "phlebotomist":
        raise HTTPException(status_code=403, detail="Phlebotomists only.")
    if not from_date or not to_date:
        raise HTTPException(status_code=400, detail="from and to query params are required (YYYY-MM-DD).")

    user_id = user.get("sub")
    rows: List[dict] = []
    if supabase:
        try:
            result = (
                supabase.table("phlebotomist_roster")
                .select("roster_date, status")
                .eq("phlebotomist_user_id", user_id)
                .gte("roster_date", from_date)
                .lte("roster_date", to_date)
                .execute()
            )
            rows = _rows(result)
        except Exception as e:
            logger.error(f"roster fetch failed: {e}")

    return {"roster": rows}