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

# The centre's service radius for next-day assignment. When the nearest
# collector to a booking is off duty or on leave, the pass reaches this far for
# a replacement before giving up (full-time first — see _pick).
ADVANCE_RADIUS_KM = 15.0


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _available_phlebos(processing_center_id: str, roster_date: str) -> List[dict]:
    """Rostered-available phlebos of this centre, with a usable base location."""
    # Absence of a roster row means "nobody said otherwise", not "unavailable"
    # — the table's own column DEFAULT is 'available'. Requiring an explicit
    # row meant a centre that never opened the roster page had zero available
    # collectors every night, so the advance pass assigned nothing and every
    # next-day booking fell through to the same-day 90-minute trigger. Only an
    # explicit 'unavailable'/'leave' row now takes someone out.
    roster = _rows(
        supabase.table("phlebotomist_roster")
        .select("phlebotomist_user_id, status, max_jobs")
        .eq("processing_center_id", processing_center_id)
        .eq("roster_date", roster_date)
        .execute()
    )
    excluded = {
        r["phlebotomist_user_id"] for r in roster
        if r.get("status") in ("unavailable", "leave")
    }

    # P2.5: Also fetch phleb_type for full-time preference in reassignment.
    # The column is `phleb_type` (schema.sql:82, complete_supabase_schema.sql:89).
    # Selecting the misspelt `phlebo_type` made PostgREST reject the whole
    # query, so every nightly advance-roster pass raised and assigned nobody.
    people = _rows(
        supabase.table("phlebotomists")
        .select(
            "user_id, processing_center_id, base_lat, base_lng, "
            "current_lat, current_lng, phleb_type"
        )
        .eq("processing_center_id", processing_center_id)
        .execute()
    )

    # Requiring base_lat/base_lng made this return an empty list for every
    # centre in production: nothing in signup writes a base location, and the
    # one backfill that does (_ensure_base_location, on the first duty toggle)
    # ends at the processing centre's own coordinates — which were also never
    # populated. So the advance pass had no candidates, assigned nobody, and no
    # collector was ever told about a next-day booking.
    #
    # A collector's last known position is a better anchor for "where will they
    # start tomorrow" than no anchor at all, so fall back to it. `_pick` reads
    # base_lat/base_lng, so normalise onto those keys here.
    candidates = []
    for p in people:
        if p.get("user_id") in excluded:
            continue
        lat = p.get("base_lat")
        lng = p.get("base_lng")
        if lat is None or lng is None:
            lat, lng = p.get("current_lat"), p.get("current_lng")
        if lat is None or lng is None:
            logger.info(
                "Phlebotomist %s has no base or last-known location; "
                "not eligible for advance assignment.", p.get("user_id"),
            )
            continue
        candidates.append({**p, "base_lat": lat, "base_lng": lng})
    return candidates


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

    P2.5: Two-pass selection — prefers full-time phlebotomists for stability.
    Never leaves a booking unassigned when a part-time phlebo could cover it.

    Pass 1: full-time only (within radius, sorted by load then distance).
    Pass 2: all candidates including part-time (fallback).
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

    # Pass 1: prefer full-time candidates
    full_time = [
        v for v in viable
        if (v[3].get("phleb_type") or "full_time").lower() in ("full_time", "full-time", "ft")
    ]
    if full_time:
        full_time.sort(key=lambda v: (v[0], v[1], v[2]))
        return full_time[0][3]

    # Pass 2: fall back to all candidates (part-time included)
    # CONSTRAINT: Never leave a booking unassigned when a part-time phlebo could cover it.
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

    # Bug 7 fix: Notify each assigned phlebotomist about their roster.
    # Without this, the phlebo only sees jobs if they actively check
    # their dashboard — no proactive notification was ever sent.
    _notify_assigned_phlebos(assigned, roster_date)

    return assigned


def _notify_in_app(user_id: str, title: str, body: str, data: dict) -> None:
    """Write one in-app notification row. Never raises.

    run_roster_pass is synchronous (a Celery task), so NotificationEngine's
    async send is driven on a private loop rather than awaited.
    """
    try:
        import asyncio
        from app.services.notification_engine import NotificationEngine

        coro = NotificationEngine.send(user_id, "in_app", title, body, data)
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            asyncio.run(coro)
            return
        # Already inside a loop (a caller awaited us from async code):
        # schedule it instead of blocking the loop.
        asyncio.ensure_future(coro)
    except Exception as e:
        logger.warning(f"In-app roster alert for {user_id} failed: {e}")


def _notify_assigned_phlebos(assigned: List[dict], roster_date: str) -> None:
    """Send roster assignment emails to each phlebotomist.

    Best-effort: notification failures are logged but never break the roster
    assignment that already succeeded above.
    """
    if not assigned or not supabase:
        return

    # Group by phlebotomist
    by_phlebo: dict = {}
    for entry in assigned:
        uid = entry["phlebotomist_user_id"]
        by_phlebo.setdefault(uid, []).append(entry)

    for uid, jobs in by_phlebo.items():
        try:
            user_row = _rows(
                supabase.table("users").select("email, full_name")
                .eq("id", uid).limit(1).execute()
            )
            if not user_row or not user_row[0].get("email"):
                logger.warning(
                    f"Roster notification: phlebotomist {uid} has no email on file"
                )
                continue

            to_email = user_row[0]["email"]
            phlebo_name = user_row[0].get("full_name", "Collector")
            job_count = len(jobs)

            from app.services.email import EmailService
            from app.config import settings

            subject = (
                f"📋 {job_count} collection{'s' if job_count > 1 else ''} "
                f"assigned for {roster_date}"
            )
            dashboard_url = f"{settings.FRONTEND_URL}/dashboard"

            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h2 style="color: #1e293b; margin-top: 0;">📋 Roster Assignment</h2>
                    <p style="color: #374151; font-size: 16px;">Hello <strong>{phlebo_name}</strong>,</p>
                    <p style="color: #374151; font-size: 16px;">
                        You have been assigned <strong>{job_count} home collection{'s' if job_count > 1 else ''}</strong>
                        for <strong>{roster_date}</strong>.
                    </p>
                    <p style="color: #374151; font-size: 16px;">
                        Please check your dashboard to view addresses and collection details.
                        If you cannot attend, decline the job from the dashboard so it can be reassigned.
                    </p>
                    <div style="margin: 25px 0;">
                        <a href="{dashboard_url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            View My Schedule
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 13px;">
                        This is an advance assignment. You may decline individual jobs from the dashboard.
                    </p>
                </div>
            </body>
            </html>
            """
            text_content = (
                f"Hello {phlebo_name},\n\n"
                f"You have {job_count} home collection(s) assigned for {roster_date}.\n"
                f"View schedule: {dashboard_url}\n"
            )

            if not EmailService._send_real_email(to_email, subject, html_content, text_content):
                logger.warning(
                    f"Roster email delivery failed for phlebotomist {uid} "
                    f"({to_email}) — RESEND_API_KEY/SMTP not configured"
                )

            # The dashboard's notification bell reads the in_app channel, and
            # this only ever sent email — so a collector who opened their
            # dashboard the next morning saw nothing about work already
            # assigned to them. Email alone is not a notification channel we
            # control the delivery of.
            _notify_in_app(
                uid,
                subject.replace("📋 ", ""),
                (
                    f"{job_count} home collection"
                    f"{'s are' if job_count > 1 else ' is'} assigned to you for "
                    f"{roster_date}. Open Schedule to see addresses, or decline "
                    f"to have it reassigned."
                ),
                {"type": "roster_assignment", "roster_date": roster_date,
                 "job_count": job_count},
            )
        except Exception as e:
            logger.error(
                f"Roster notification failed for phlebotomist {uid}: {e}"
            )


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
