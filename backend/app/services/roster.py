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


def _without_test_personas(people: List[dict]) -> List[dict]:
    """Keep only real collector accounts: users.role 'phlebotomist' and not a
    test persona. An internal dashboard-check login (@callmedex.internal) was
    being handed real patients' collections — and an admin account with a
    phlebotomist profile attached was a candidate too. Every roster path
    (booking-time pick, evening pass, decline, manual list) goes through this."""
    uids = [p.get("user_id") for p in people if p.get("user_id")]
    if not uids:
        return people
    from app.utils.personas import is_test_persona
    # Allowlist, fail-closed: an account is a candidate only if it is
    # positively confirmed as a real collector. A failed lookup or a missing
    # role excludes it — never sends an unknown account to a patient's door.
    real_ids = {
        u["id"] for u in _rows(
            supabase.table("users").select("id, email, role, registrant_role")
            .in_("id", uids).execute()
        ) if (u.get("role") or "") == "phlebotomist" and not is_test_persona(u)
    }
    return [p for p in people if p.get("user_id") in real_ids]


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
    return _without_test_personas(candidates)


def _unassigned_bookings(processing_center_id: str, roster_date: str) -> List[dict]:
    bookings = _rows(
        supabase.table("bookings")
        .select("*")
        .eq("processing_center_id", processing_center_id)
        .eq("collection_date", roster_date)
        .eq("booking_kind", "home_collection")
        # A cancelled booking must not be handed to a collector overnight.
        .not_.in_("status", ["cancelled", "completed", "no_show", "slot_rejected"])
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


# Same figure the live dispatch path uses (dispatch_engine.FULL_TIME_PHLEBO_RADIUS_KM).
FULL_TIME_RADIUS_KM = 20.0


def _pick(candidates: List[dict], booking: dict, load: dict,
          exclude: Optional[set] = None) -> Optional[dict]:
    """Least-loaded, then nearest, collector within their radius of the booking.

    - Full-time phlebotomists: 20 km service radius from their base.
    - Part-time phlebotomists: 15 km local radius.
    - Pass 1: prefers full-time phlebotomists within 20 km.
    - Pass 2: falls back to part-time phlebotomists within 15 km.
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
        is_full_time = (person.get("phleb_type") or "full_time").lower() in ("full_time", "full-time", "ft")
        max_dist = FULL_TIME_RADIUS_KM if is_full_time else ADVANCE_RADIUS_KM
        if dist <= max_dist:
            viable.append((load.get(uid, 0), dist, uid, person, is_full_time))
    if not viable:
        return None

    # Pass 1: prefer full-time candidates (within 25 km)
    full_time = [v for v in viable if v[4]]
    if full_time:
        full_time.sort(key=lambda v: (v[0], v[1], v[2]))
        return full_time[0][3]

    # Pass 2: fall back to all candidates (part-time included within 15 km)
    viable.sort(key=lambda v: (v[0], v[1], v[2]))
    return viable[0][3]


# Dispatch states that no longer hold the collector's time on that day.
_RELEASED = {"cancelled", "completed", "no_provider", "needs_manual_assignment", "expired"}


def _slot_hhmm(booking: dict) -> str:
    """The booking's collection time, HH:MM IST ('' if it has none)."""
    parts = (booking.get("slot_id") or "").split("|")
    if len(parts) == 3 and ":" in parts[2]:
        return parts[2][:5]
    start = booking.get("slot_start") or ""
    return start.split("T")[1][:5] if "T" in start else ""


def _roster_state(roster_date: str):
    """(jobs per collector, slot times each collector already holds) on that date."""
    jobs = [
        j for j in _rows(
            supabase.table("dispatch_requests")
            .select("assigned_provider_id, booking_id, status")
            .eq("scheduled_for", roster_date)
            .execute()
        )
        if j.get("assigned_provider_id") and j.get("status") not in _RELEASED
    ]
    times = {}
    booking_ids = [j["booking_id"] for j in jobs if j.get("booking_id")]
    if booking_ids:
        for b in _rows(
            supabase.table("bookings").select("id, slot_id, slot_start")
            .in_("id", booking_ids).execute()
        ):
            times[b["id"]] = _slot_hhmm(b)
    load: dict = {}
    busy: dict = {}
    for j in jobs:
        uid = j["assigned_provider_id"]
        load[uid] = load.get(uid, 0) + 1
        t = times.get(j.get("booking_id"))
        if t:
            busy.setdefault(uid, set()).add(t)
    return load, busy


def _city_phlebos(city: str, roster_date: str) -> List[dict]:
    """Collectors in the patient's city, for bookings with no processing centre."""
    uids = [
        u["id"] for u in _rows(
            supabase.table("users").select("id")
            .eq("role", "phlebotomist").ilike("city", f"%{city}%").execute()
        )
    ]
    if not uids:
        return []
    on_leave = {
        r["phlebotomist_user_id"] for r in _rows(
            supabase.table("phlebotomist_roster")
            .select("phlebotomist_user_id, status")
            .eq("roster_date", roster_date)
            .in_("status", ["unavailable", "leave"])
            .execute()
        )
    }
    out = []
    for p in _rows(
        supabase.table("phlebotomists")
        .select("user_id, processing_center_id, base_lat, base_lng, current_lat, current_lng, phleb_type")
        .in_("user_id", uids).execute()
    ):
        if p.get("user_id") in on_leave:
            continue
        lat, lng = p.get("base_lat"), p.get("base_lng")
        if lat is None or lng is None:
            lat, lng = p.get("current_lat"), p.get("current_lng")
        if lat is None or lng is None:
            continue
        out.append({**p, "base_lat": lat, "base_lng": lng})
    return _without_test_personas(out)


def pick_advance_collector(booking: dict, roster_date: str,
                           city: Optional[str] = None) -> Optional[dict]:
    """The collector a scheduled home collection is pre-assigned to, or None.

    Full-time collectors first (25 km), then part-time (15 km); nearest, then
    least loaded that day. Nobody on leave, and nobody already holding a job
    at the same slot time — assigning one collector two 07:00 doorsteps in
    different areas guarantees one patient is missed.

    None is a real answer: the booking then stays unassigned and the
    same-day trigger (scheduled_dispatch) offers it live before the slot,
    instead of a placeholder row blocking that fallback forever.
    """
    if booking.get("collection_lat") is None or booking.get("collection_lng") is None:
        return None
    pc_id = booking.get("processing_center_id")
    candidates = _available_phlebos(pc_id, roster_date) if pc_id else []
    if not candidates and city:
        candidates = _city_phlebos(city, roster_date)
    if not candidates:
        return None
    load, busy = _roster_state(roster_date)
    slot = _slot_hhmm(booking)
    exclude = {uid for uid, held in busy.items() if slot and slot in held}
    return _pick(candidates, booking, load, exclude)


def run_roster_pass(processing_center_id: str, roster_date: str) -> List[dict]:
    """Assign every unassigned next-day booking of this centre.

    Idempotent — a booking that already has a dispatch request for that date is
    skipped, so running the pass twice does not double-assign.
    """
    candidates = _available_phlebos(processing_center_id, roster_date)
    bookings = _unassigned_bookings(processing_center_id, roster_date)
    if not candidates or not bookings:
        return []

    # Seeded from jobs already assigned that day (at booking time or by an
    # earlier pass), so this pass never double-books a collector's slot.
    load, busy = _roster_state(roster_date)
    assigned: List[dict] = []

    for booking in bookings:
        slot = _slot_hhmm(booking)
        exclude = {uid for uid, held in busy.items() if slot and slot in held}
        person = _pick(candidates, booking, load, exclude)
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
            "service_subtype": "home_collection",
        }).execute()

        load[uid] = load.get(uid, 0) + 1
        if slot:
            busy.setdefault(uid, set()).add(slot)
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

    # Same candidate pool the booking was first assigned from: the centre's
    # collectors, else the city's (a booking with no centre got its first
    # collector from the city pool, so a decline must look there too).
    candidates = []
    if booking.get("processing_center_id"):
        candidates = _available_phlebos(
            booking["processing_center_id"], request.get("scheduled_for"))
    if not candidates and booking.get("collection_city"):
        candidates = _city_phlebos(booking["collection_city"], request.get("scheduled_for"))
    load, busy = _roster_state(request.get("scheduled_for"))
    slot = _slot_hhmm(booking)
    exclude = set(declined) | {uid for uid, held in busy.items() if slot and slot in held}
    replacement = _pick(candidates, booking, load, exclude=exclude)

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

    # The booking still named the collector who declined, and the new one was
    # never told — they found the job only if they happened to open Schedule.
    try:
        supabase.table("bookings").update({
            "provider_id": replacement["user_id"],
        }).eq("id", booking["id"]).execute()
    except Exception as e:
        logger.warning(f"decline_job: booking {booking['id']} provider re-point failed: {e}")
    slot = slot or "the scheduled time"
    _notify_in_app(
        replacement["user_id"],
        "Home collection assigned to you",
        f"A doorstep collection on {request.get('scheduled_for')} at {slot} "
        "was reassigned to you. Open Schedule for the address.",
        {"type": "roster_assignment", "booking_id": booking["id"],
         "dispatch_id": dispatch_request_id,
         "roster_date": request.get("scheduled_for")},
    )

    return {
        "dispatch_request_id": dispatch_request_id,
        "booking_id": booking["id"],
        "phlebotomist_user_id": replacement["user_id"],
    }


# ─── Manual assignment (processing-centre fallback) ─────────────────────────
#
# Collectors are assigned automatically from the patient's location — at
# booking time, by the evening roster pass, or by the same-day live offer.
# This is only for what those could not place: everyone declined, nobody in
# range accepted, or the centre wants to place a booking before the pass runs.
# Suggestions are ranked by the same rule the automatic pass uses, nearest to
# the PATIENT first, so the centre is choosing among sensible options.

# Auto-dispatch states meaning "nobody holds this job and nothing is still
# trying". searching/provider_notified are excluded on purpose: a live offer
# is out, and assigning over it would let two collectors arrive.
_FAILED_AUTO = {"needs_manual_assignment", "no_provider", "expired"}
_LIVE_BOOKING = ["confirmed", "provider_accepted", "pending"]


def _blocks_manual(dispatch: dict) -> bool:
    """True when this dispatch row still holds (or is still offering) the job."""
    return dispatch.get("status") not in _FAILED_AUTO and dispatch.get("status") != "cancelled"


def _centre_collectors(processing_center_id: str, roster_date: str) -> List[dict]:
    """Every verified collector of the centre with a usable location, leave flagged."""
    people = _rows(
        supabase.table("phlebotomists")
        .select("user_id, base_lat, base_lng, current_lat, current_lng, phleb_type, verification_status")
        .eq("processing_center_id", processing_center_id)
        .execute()
    )
    on_leave = {
        r["phlebotomist_user_id"] for r in _rows(
            supabase.table("phlebotomist_roster")
            .select("phlebotomist_user_id, status")
            .eq("processing_center_id", processing_center_id)
            .eq("roster_date", roster_date)
            .execute()
        ) if r.get("status") in ("unavailable", "leave")
    }
    uids = [p["user_id"] for p in people if p.get("user_id")]
    names: dict = {}
    if uids:
        names = {u["id"]: u for u in _rows(
            supabase.table("users").select("id, full_name, mobile").in_("id", uids).execute()
        )}
    out = []
    for p in people:
        if (p.get("verification_status") or "") != "verified":
            continue
        lat, lng = p.get("base_lat"), p.get("base_lng")
        if lat is None or lng is None:
            lat, lng = p.get("current_lat"), p.get("current_lng")
        u = names.get(p["user_id"], {})
        out.append({
            **p, "base_lat": lat, "base_lng": lng,
            "full_name": u.get("full_name") or "", "mobile": u.get("mobile") or "",
            "on_leave": p["user_id"] in on_leave,
        })
    return _without_test_personas(out)


def _collection_area(booking: dict) -> str:
    notes = booking.get("notes") or ""
    if "Collection address:" in notes:
        return notes.split("Collection address:")[-1].strip().splitlines()[0]
    return booking.get("collection_city") or booking.get("collection_district") or ""


def manual_assignment_queue(processing_center_id: str, roster_date: str) -> List[dict]:
    """This centre's home collections on `roster_date` that no collector holds."""
    bookings = _rows(
        supabase.table("bookings")
        .select("id, patient_id, status, slot_id, slot_start, notes, selected_tests, "
                "collection_lat, collection_lng, collection_city, collection_district")
        .eq("processing_center_id", processing_center_id)
        .eq("collection_date", roster_date)
        .eq("booking_kind", "home_collection")
        .in_("status", _LIVE_BOOKING)
        .execute()
    )
    if not bookings:
        return []
    by_booking: dict = {}
    for d in _rows(
        supabase.table("dispatch_requests")
        .select("booking_id, status, assigned_provider_id")
        .in_("booking_id", [b["id"] for b in bookings])
        .execute()
    ):
        by_booking.setdefault(d.get("booking_id"), []).append(d)

    collectors = _centre_collectors(processing_center_id, roster_date)
    load, busy = _roster_state(roster_date)
    queue = []
    for b in bookings:
        rows = by_booking.get(b["id"], [])
        if any(_blocks_manual(d) for d in rows):
            continue  # held by a collector, or a live offer is still out
        slot = _slot_hhmm(b)
        has_location = b.get("collection_lat") is not None and b.get("collection_lng") is not None
        suggestions = []
        for c in collectors:
            dist = None
            if has_location and c.get("base_lat") is not None and c.get("base_lng") is not None:
                dist = round(haversine_km(
                    float(b["collection_lat"]), float(b["collection_lng"]),
                    float(c["base_lat"]), float(c["base_lng"]),
                ), 1)
            full_time = (c.get("phleb_type") or "full_time").lower() in ("full_time", "full-time", "ft")
            radius = FULL_TIME_RADIUS_KM if full_time else ADVANCE_RADIUS_KM
            suggestions.append({
                "user_id": c["user_id"], "full_name": c["full_name"], "mobile": c["mobile"],
                "phleb_type": "full_time" if full_time else "part_time",
                "distance_km": dist,
                "within_radius": dist is not None and dist <= radius,
                "busy_at_slot": bool(slot and slot in busy.get(c["user_id"], set())),
                "on_leave": c["on_leave"],
                "jobs_that_day": load.get(c["user_id"], 0),
            })
        # Same preference as the automatic pass: free, in range, nearest.
        suggestions.sort(key=lambda s: (
            s["on_leave"], s["busy_at_slot"], not s["within_radius"],
            s["distance_km"] if s["distance_km"] is not None else 1e9,
        ))
        queue.append({
            "booking_id": b["id"],
            "slot_time": slot,
            "area": _collection_area(b),
            "tests": b.get("selected_tests") or [],
            "has_location": has_location,
            "reason": "auto_assignment_failed" if rows else "awaiting_auto_assignment",
            "suggestions": suggestions,
        })
    queue.sort(key=lambda q: q["slot_time"] or "99:99")
    return queue


async def manual_assign(processing_center_id: str, booking_id: str,
                        phlebotomist_user_id: str, actor_user_id: str) -> dict:
    """Assign a centre collector to an unplaced home collection.

    Raises LookupError (not found), PermissionError (other centre) or
    ValueError (cannot be assigned as asked) with a message fit for staff.
    """
    rows = _rows(
        supabase.table("bookings").select("*").eq("id", booking_id).limit(1).execute()
    )
    if not rows:
        raise LookupError("Booking not found.")
    booking = rows[0]
    if booking.get("processing_center_id") != processing_center_id:
        raise PermissionError("This booking belongs to another processing centre.")
    if booking.get("booking_kind") != "home_collection" or booking.get("status") not in _LIVE_BOOKING:
        raise ValueError(f"This booking cannot be assigned (status: {booking.get('status')}).")
    if booking.get("collection_lat") is None or booking.get("collection_lng") is None:
        raise ValueError("This booking has no collection location yet, so it cannot be dispatched.")

    roster_date = booking.get("collection_date") or (booking.get("slot_start") or "")[:10]
    collector = next(
        (c for c in _centre_collectors(processing_center_id, roster_date)
         if c["user_id"] == phlebotomist_user_id), None)
    if not collector:
        raise ValueError("That phlebotomist is not a verified collector of this centre.")

    existing = _rows(
        supabase.table("dispatch_requests").select("id, status, assigned_provider_id")
        .eq("booking_id", booking_id).execute()
    )
    if any(_blocks_manual(d) for d in existing):
        raise ValueError("This booking is already assigned, or a live offer is still out.")

    _, busy = _roster_state(roster_date)
    slot = _slot_hhmm(booking)
    if slot and slot in busy.get(phlebotomist_user_id, set()):
        raise ValueError(f"{collector['full_name'] or 'This phlebotomist'} already has a collection at {slot}.")

    # Reuse the failed auto row if there is one, so the booking keeps a single
    # dispatch. 'advance' (the schema allows advance/realtime/urgent) makes it
    # behave like a rostered job: on the collector's schedule, and declinable
    # through the normal reassign path.
    payload = {
        "assigned_provider_id": phlebotomist_user_id,
        "assignment_mode": "advance",
        "scheduled_for": roster_date,
        "status": "provider_accepted",
    }
    failed = next((d for d in existing if d.get("status") in _FAILED_AUTO), None)
    if failed:
        dispatch_id = failed["id"]
        supabase.table("dispatch_requests").update(payload).eq("id", dispatch_id).execute()
    else:
        dispatch_id = str(uuid.uuid4())
        supabase.table("dispatch_requests").insert({
            **payload,
            "id": dispatch_id,
            "booking_id": booking_id,
            "patient_id": booking.get("patient_id"),
            "provider_type": "phlebotomist",
            "service_subtype": "home_collection",
            "priority": booking.get("priority") or "normal",
            "declined_by": [],
            "patient_lat": booking["collection_lat"],
            "patient_lng": booking["collection_lng"],
            "patient_address": _collection_area(booking),
            "notes": f"Manually assigned by processing centre ({slot or 'scheduled'})",
        }).execute()

    supabase.table("bookings").update({
        "provider_id": phlebotomist_user_id, "provider_type": "phlebotomist",
    }).eq("id", booking_id).execute()

    when = f"{roster_date} at {slot or 'the scheduled time'}"
    try:
        from app.services.notification_engine import NotificationEngine
        await NotificationEngine.send_multi(
            user_id=phlebotomist_user_id, channels=["in_app", "push"],
            title="Home collection assigned to you",
            body=f"Doorstep collection on {when} ({_collection_area(booking) or 'see Schedule'}).",
            data={"type": "roster_assignment", "booking_id": booking_id,
                  "dispatch_id": dispatch_id, "roster_date": roster_date},
        )
        if booking.get("patient_id"):
            await NotificationEngine.send_multi(
                user_id=booking["patient_id"], channels=["in_app"],
                title="Phlebotomist Assigned",
                body=f"{collector['full_name'] or 'A phlebotomist'} has been assigned for your home collection on {when}.",
                data={"booking_id": booking_id, "phlebotomist_id": phlebotomist_user_id},
            )
    except Exception as e:
        logger.warning(f"manual_assign notifications failed for booking {booking_id}: {e}")

    logger.info(f"Booking {booking_id} manually assigned to {phlebotomist_user_id} by {actor_user_id}")
    return {"booking_id": booking_id, "dispatch_id": dispatch_id,
            "phlebotomist_user_id": phlebotomist_user_id, "full_name": collector["full_name"]}
