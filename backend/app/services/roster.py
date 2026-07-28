"""
Advance rostering — tomorrow's slots assigned this evening.

Anchors on the phlebotomist's BASE location, because their live GPS says
nothing about where they will be at 07:00 tomorrow. Assignment is direct, not
an offer: the phlebo sees the list tonight and may decline, which hands the job
to the next-nearest rather than to nobody.

Same-day and urgent bookings keep using the existing live-GPS offer flow in
dispatch_engine.
"""
import logging
import uuid
from typing import List, Optional

from app.database import supabase
from app.services.processing_center import haversine_km

logger = logging.getLogger(__name__)

ADVANCE_RADIUS_KM = 10.0


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _available_phlebos(processing_center_id: str, roster_date: str) -> List[dict]:
    """Rostered-available phlebos of this centre, with a usable base location."""
    roster = _rows(
        supabase.table("phlebotomist_roster")
        .select("phlebotomist_user_id, status, max_jobs")
        .eq("processing_center_id", processing_center_id)
        .eq("roster_date", roster_date)
        .eq("status", "available")
        .execute()
    )
    if not roster:
        return []
    wanted = {r["phlebotomist_user_id"] for r in roster}

    people = _rows(
        supabase.table("phlebotomists")
        .select("user_id, processing_center_id, base_lat, base_lng")
        .eq("processing_center_id", processing_center_id)
        .execute()
    )
    return [
        p for p in people
        if p.get("user_id") in wanted
        and p.get("base_lat") is not None
        and p.get("base_lng") is not None
    ]


def _unassigned_bookings(processing_center_id: str, roster_date: str) -> List[dict]:
    bookings = _rows(
        supabase.table("bookings")
        .select("*")
        .eq("processing_center_id", processing_center_id)
        .eq("collection_date", roster_date)
        .eq("booking_kind", "home_collection")
        .execute()
    )
    existing = {
        r.get("booking_id")
        for r in _rows(
            supabase.table("dispatch_requests")
            .select("booking_id")
            .eq("scheduled_for", roster_date)
            .execute()
        )
    }
    return [
        b for b in bookings
        if b["id"] not in existing               # idempotent
        and b.get("collection_lat") is not None
        and b.get("collection_lng") is not None
    ]


def _pick(candidates: List[dict], booking: dict, load: dict,
          exclude: Optional[set] = None) -> Optional[dict]:
    """Nearest by base location within the radius, breaking ties on load.

    Sorting on load first is what stops one phlebo absorbing a whole locality
    while a colleague two streets away sits idle.
    """
    exclude = exclude or set()
    viable = []
    for person in candidates:
        uid = person["user_id"]
        if uid in exclude:
            continue
        dist = haversine_km(
            float(booking["collection_lat"]), float(booking["collection_lng"]),
            float(person["base_lat"]), float(person["base_lng"]),
        )
        if dist <= ADVANCE_RADIUS_KM:
            viable.append((load.get(uid, 0), dist, uid, person))
    if not viable:
        return None
    viable.sort(key=lambda v: (v[0], v[1], v[2]))
    return viable[0][3]


def run_roster_pass(processing_center_id: str, roster_date: str) -> List[dict]:
    """Assign every unassigned next-day booking of this centre.

    Idempotent — a booking that already has a dispatch request for that date is
    skipped, so running the pass twice does not double-assign.
    """
    candidates = _available_phlebos(processing_center_id, roster_date)
    bookings = _unassigned_bookings(processing_center_id, roster_date)
    if not candidates or not bookings:
        return []

    load: dict = {}
    assigned: List[dict] = []

    for booking in bookings:
        person = _pick(candidates, booking, load)
        if person is None:
            # Out of radius for everyone. Left unassigned on purpose: it falls
            # back to the realtime offer flow on the collection day.
            logger.info("No advance candidate for booking %s", booking["id"])
            continue

        uid = person["user_id"]
        request_id = str(uuid.uuid4())
        supabase.table("dispatch_requests").insert({
            "id": request_id,
            "booking_id": booking["id"],
            "patient_id": booking.get("patient_id"),
            "provider_type": "phlebotomist",
            "assigned_provider_id": uid,
            "assignment_mode": "advance",
            "scheduled_for": roster_date,
            "status": "provider_accepted",
            "priority": booking.get("priority") or "normal",
            "declined_by": [],
            # patient_lat/patient_lng are DOUBLE PRECISION NOT NULL with no
            # default (database/complete_supabase_schema.sql:296-297) — every
            # roster insert without them would raise 23502 against real
            # Postgres. _unassigned_bookings already filters out bookings
            # missing either, so these are always populated here.
            "patient_lat": booking["collection_lat"],
            "patient_lng": booking["collection_lng"],
        }).execute()

        load[uid] = load.get(uid, 0) + 1
        assigned.append({
            "dispatch_request_id": request_id,
            "booking_id": booking["id"],
            "phlebotomist_user_id": uid,
        })

    return assigned


def decline_job(dispatch_request_id: str, phlebotomist_user_id: str) -> Optional[dict]:
    """Return a declined advance job to the roster queue and reassign it.

    When nobody is left, the request is surfaced for manual assignment rather
    than silently going unassigned — Spec 2 renders that queue.
    """
    rows = _rows(
        supabase.table("dispatch_requests")
        .select("*").eq("id", dispatch_request_id).limit(1).execute()
    )
    if not rows:
        return None
    request = rows[0]

    if request.get("assignment_mode") != "advance" or not request.get("scheduled_for"):
        # Realtime and urgent jobs are declined through the offer flow in
        # dispatch_engine, which has its own reassignment path. Routing one
        # here would mark it needs_manual_assignment for a reason that isn't
        # true — "every roster candidate declined" — when in fact this was
        # never a roster job in the first place.
        raise ValueError(
            f"decline_job is for advance assignments only; dispatch request "
            f"{dispatch_request_id} has assignment_mode="
            f"{request.get('assignment_mode')!r} scheduled_for="
            f"{request.get('scheduled_for')!r}"
        )

    if request.get("assigned_provider_id") != phlebotomist_user_id:
        # Ownership check lives here, not just in the router: this is the
        # single place every caller of decline_job passes through, and it
        # already has the row loaded. Without it, any phlebotomist could
        # decline any advance job by ID and reassign another centre's work.
        raise PermissionError(
            f"dispatch request {dispatch_request_id} is not assigned to "
            f"phlebotomist {phlebotomist_user_id}"
        )

    declined = list(request.get("declined_by") or [])
    if phlebotomist_user_id not in declined:
        declined.append(phlebotomist_user_id)

    booking_rows = _rows(
        supabase.table("bookings").select("*")
        .eq("id", request["booking_id"]).limit(1).execute()
    )
    if not booking_rows:
        return None
    booking = booking_rows[0]

    candidates = _available_phlebos(
        booking["processing_center_id"], request.get("scheduled_for"))
    replacement = _pick(candidates, booking, {}, exclude=set(declined))

    if replacement is None:
        supabase.table("dispatch_requests").update({
            "declined_by": declined,
            "assigned_provider_id": None,
            "status": "needs_manual_assignment",
        }).eq("id", dispatch_request_id).execute()
        return None

    supabase.table("dispatch_requests").update({
        "declined_by": declined,
        "assigned_provider_id": replacement["user_id"],
        "status": "provider_accepted",
    }).eq("id", dispatch_request_id).execute()

    return {
        "dispatch_request_id": dispatch_request_id,
        "booking_id": booking["id"],
        "phlebotomist_user_id": replacement["user_id"],
    }
