"""
Provider ratings.

The star a patient sees next to a collector's name has to come from somewhere.
Until now it came from `rating REAL DEFAULT 5.0` on the role tables — a column
nothing ever wrote — so every provider showed a flat 5.0 nobody had awarded,
and the audit had to blank those figures out rather than keep publishing them.

This is the store behind them: one row per rated visit in `provider_ratings`
(see database/provider_ratings.sql), aggregated on read.

Every reader degrades to "no rating yet" rather than raising, so the app keeps
working before the migration is applied — and shows nothing rather than
something invented.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.database import supabase

logger = logging.getLogger(__name__)

# A visit can only be rated once it has actually happened.
RATEABLE_STATUSES = ("completed", "in_progress", "arrived")


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def get_summary(provider_user_id: str, db: Optional[Any] = None) -> Dict[str, Any]:
    """Average stars and rating count for one provider.

    Returns `{"average_stars": None, "rating_count": 0}` when the provider has
    no ratings, when the table is missing, or when the read fails — callers
    render "no rating yet" from that, never a number.
    """
    empty = {"average_stars": None, "rating_count": 0}
    if db is None:
        db = supabase
    if not db or not provider_user_id:
        return empty

    try:
        rows = _rows(
            db.table("provider_ratings")
            .select("stars")
            .eq("provider_user_id", provider_user_id)
            .execute()
        )
    except Exception as e:
        # Most likely the migration has not been applied yet.
        logger.debug(f"provider_ratings unavailable for {provider_user_id}: {e}")
        return empty

    stars = [int(r["stars"]) for r in rows if r.get("stars") is not None]
    if not stars:
        return empty

    return {
        "average_stars": round(sum(stars) / len(stars), 2),
        "rating_count": len(stars),
    }


def get_summaries(provider_user_ids: List[str], db: Optional[Any] = None) -> Dict[str, Dict[str, Any]]:
    """Summaries for many providers in one round trip.

    The dispatch engine ranks a whole candidate list at once; asking per
    provider would put a query per candidate on the hot path of every booking.
    """
    if db is None:
        db = supabase
    ids = [i for i in (provider_user_ids or []) if i]
    if not db or not ids:
        return {}

    try:
        rows = _rows(
            db.table("provider_ratings")
            .select("provider_user_id, stars")
            .in_("provider_user_id", ids)
            .execute()
        )
    except Exception as e:
        logger.debug(f"provider_ratings bulk read unavailable: {e}")
        return {}

    buckets: Dict[str, List[int]] = {}
    for r in rows:
        pid = r.get("provider_user_id")
        if pid is None or r.get("stars") is None:
            continue
        buckets.setdefault(str(pid), []).append(int(r["stars"]))

    return {
        pid: {
            "average_stars": round(sum(s) / len(s), 2),
            "rating_count": len(s),
        }
        for pid, s in buckets.items() if s
    }


def completed_visit_count(provider_user_id: str, db: Optional[Any] = None) -> Optional[int]:
    """How many visits this provider has actually completed.

    None when it cannot be established — the caller shows nothing rather than
    the "120+ home visits" that used to be hardcoded.
    """
    if db is None:
        db = supabase
    if not db or not provider_user_id:
        return None
    try:
        result = (
            db.table("dispatch_requests")
            .select("id", count="exact")
            .eq("assigned_provider_id", provider_user_id)
            .eq("status", "completed")
            .execute()
        )
        count = getattr(result, "count", None)
        if count is None:
            count = len(getattr(result, "data", None) or [])
        return int(count)
    except Exception as e:
        logger.debug(f"Could not count completed visits for {provider_user_id}: {e}")
        return None


def submit_rating(
    *,
    dispatch_id: str,
    patient_user_id: str,
    stars: int,
    comment: str = "",
    db: Optional[Any] = None,
) -> Dict[str, Any]:
    """Record a patient's rating of the provider who attended their visit.

    Authorises against the dispatch itself: only the patient on the visit may
    rate it, only once it has actually happened, and only the provider who
    attended can be the subject. Returns a result dict; the caller maps it to
    a status code.
    """
    if db is None:
        db = supabase
    if not db:
        return {"success": False, "error": "Database unavailable", "status": 503}

    if not isinstance(stars, int) or not 1 <= stars <= 5:
        return {"success": False, "error": "Rating must be between 1 and 5 stars", "status": 400}

    rows = _rows(
        db.table("dispatch_requests")
        .select("id, patient_id, assigned_provider_id, status, booking_id")
        .eq("id", dispatch_id)
        .limit(1)
        .execute()
    )
    if not rows:
        return {"success": False, "error": "Visit not found", "status": 404}
    dispatch = rows[0]

    if dispatch.get("patient_id") != patient_user_id:
        return {"success": False, "error": "This visit is not yours to rate", "status": 403}

    provider_id = dispatch.get("assigned_provider_id")
    if not provider_id:
        return {"success": False, "error": "No provider attended this visit yet", "status": 409}

    if dispatch.get("status") not in RATEABLE_STATUSES:
        return {
            "success": False,
            "error": "This visit has not happened yet, so it cannot be rated",
            "status": 409,
        }

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "provider_user_id": provider_id,
        "patient_user_id": patient_user_id,
        "dispatch_request_id": dispatch_id,
        "booking_id": dispatch.get("booking_id"),
        "stars": stars,
        "comment": (comment or "")[:1000],
        "created_at": now,
    }

    try:
        existing = _rows(
            db.table("provider_ratings")
            .select("id")
            .eq("dispatch_request_id", dispatch_id)
            .eq("patient_user_id", patient_user_id)
            .limit(1)
            .execute()
        )
        if existing:
            # Changing your mind is fine; stacking ratings is not.
            db.table("provider_ratings").update({
                "stars": stars,
                "comment": record["comment"],
                "created_at": now,
            }).eq("id", existing[0]["id"]).execute()
        else:
            record["id"] = str(uuid.uuid4())
            db.table("provider_ratings").insert(record).execute()
    except Exception as e:
        logger.error(f"Could not save rating for dispatch {dispatch_id}: {e}")
        return {"success": False, "error": "Could not save your rating. Please retry.", "status": 503}

    summary = get_summary(provider_id, db=db)
    return {"success": True, "provider_user_id": provider_id, "summary": summary, "status": 200}
