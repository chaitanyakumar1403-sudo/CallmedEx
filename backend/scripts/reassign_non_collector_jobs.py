"""
One-off repair: move live collection jobs off accounts that are not real collectors.

Before 2026-10-07 the advance roster could assign a patient's home collection
to an internal test persona (an @callmedex.internal dashboard-check login) or to
an admin account that has a phlebotomist profile attached. Nobody would ever
turn up. The candidate pools now exclude both; this script fixes jobs already
assigned that way.

    python backend/scripts/reassign_non_collector_jobs.py            # dry run
    python backend/scripts/reassign_non_collector_jobs.py --apply    # write

Each affected job goes to the nearest free real collector (same rules as the
automatic pass). If none is free it is parked as needs_manual_assignment, so it
shows in the processing centre's "Needs a phlebotomist" list and is offered
live on the day.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.database import supabase  # noqa: E402
from app.services import roster  # noqa: E402

LIVE = ["provider_accepted", "provider_notified", "searching", "en_route"]


def main(apply: bool) -> None:
    if not supabase:
        sys.exit("Database not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY).")
    everyone = supabase.table("phlebotomists").select("user_id").execute().data or []
    real = {p["user_id"] for p in roster._without_test_personas(everyone)}
    jobs = [
        j for j in (supabase.table("dispatch_requests")
                    .select("id, booking_id, status, assigned_provider_id, scheduled_for")
                    .in_("status", LIVE).execute().data or [])
        if j.get("assigned_provider_id") and j["assigned_provider_id"] not in real
    ]
    print(f"{len(jobs)} live job(s) held by non-collector accounts.")
    for j in jobs:
        rows = supabase.table("bookings").select("*").eq("id", j["booking_id"]).limit(1).execute().data or []
        if not rows:
            print(f"SKIP   job {j['id'][:8]}: booking missing")
            continue
        b = rows[0]
        date = j.get("scheduled_for") or b.get("collection_date") or ""
        pick = roster.pick_advance_collector(b, date, city=b.get("collection_city"))
        target = pick["user_id"] if pick else None
        print(f"{'FIX ' if apply else 'WOULD'}  booking {b['id'][:8]} ({date} {roster._slot_hhmm(b)}) -> "
              f"{target[:8] + '…' if target else 'needs_manual_assignment'}")
        if not apply:
            continue
        if target:
            supabase.table("dispatch_requests").update({
                "assigned_provider_id": target, "status": "provider_accepted",
                "assignment_mode": "advance", "scheduled_for": date,
            }).eq("id", j["id"]).execute()
            supabase.table("bookings").update({
                "provider_id": target, "provider_type": "phlebotomist",
            }).eq("id", b["id"]).execute()
            roster._notify_in_app(
                target, "Home collection assigned to you",
                f"Doorstep collection on {date} at {roster._slot_hhmm(b) or 'the scheduled time'}. Open Schedule for the address.",
                {"type": "roster_assignment", "booking_id": b["id"], "dispatch_id": j["id"], "roster_date": date},
            )
        else:
            supabase.table("dispatch_requests").update({
                "assigned_provider_id": None, "status": "needs_manual_assignment",
            }).eq("id", j["id"]).execute()
    if not apply:
        print("Dry run — re-run with --apply to write.")


if __name__ == "__main__":
    main("--apply" in sys.argv)
