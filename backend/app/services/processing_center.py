"""
Processing Center resolution and assignment.

The patient books from CallMedex. Which centre fulfils the order is decided
here, in the backend, and never surfaces to them.

Resolution order, first match wins:
    1. an active area row with an exact pincode match
    2. an active area row whose city matches the normalised input
    3. the nearest active centre whose radius_km covers the point

Ties break on priority ascending, then distance ascending, so two centres in
one city resolve deterministically — which is what lets HYD-02 be added as a
row rather than a code change.
"""
import logging
import math
from typing import List, Optional

from app.database import supabase

logger = logging.getLogger(__name__)

EARTH_KM = 6371.0


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_KM * math.asin(math.sqrt(a))


def normalise_city(raw: Optional[str]) -> str:
    """'Vizag', 'VIZAG', ' Visakhapatnam ' -> 'visakhapatnam'.

    Without this, a patient in Vizag is told their city is unserviced.
    """
    if not raw:
        return ""
    key = raw.strip().lower()
    if not key:
        return ""
    result = (
        supabase.table("city_aliases")
        .select("canonical_city")
        .eq("alias", key)
        .limit(1)
        .execute()
    )
    rows = _rows(result)
    return rows[0]["canonical_city"] if rows else key


def _active_centres() -> dict:
    rows = _rows(
        supabase.table("processing_centers").select("*").eq("status", "active").execute()
    )
    return {r["id"]: r for r in rows}


def _active_areas() -> List[dict]:
    return _rows(
        supabase.table("processing_center_areas")
        .select("*")
        .eq("is_active", True)
        .execute()
    )


def _priority(area: dict) -> int:
    try:
        return int(area.get("priority") or 100)
    except (TypeError, ValueError):
        return 100


def resolve_center(city=None, pincode=None, lat=None, lng=None) -> Optional[dict]:
    """Return the full centre row that should fulfil this location, or None."""
    centres = _active_centres()
    if not centres:
        return None
    areas = [a for a in _active_areas() if a.get("processing_center_id") in centres]

    # 1. Exact pincode.
    if pincode:
        key = str(pincode).strip()
        matches = [a for a in areas if (a.get("pincode") or "") == key]
        if matches:
            matches.sort(key=_priority)
            return centres[matches[0]["processing_center_id"]]

    # 2. City, through the alias table.
    canonical = normalise_city(city)
    if canonical:
        matches = [a for a in areas if (a.get("city") or "") == canonical]
        if matches:
            matches.sort(key=_priority)
            return centres[matches[0]["processing_center_id"]]

    # 3. Nearest covering centre.
    if lat is not None and lng is not None:
        candidates = []
        for area in areas:
            radius = area.get("radius_km")
            if radius is None:
                continue
            centre = centres[area["processing_center_id"]]
            if centre.get("lat") is None or centre.get("lng") is None:
                continue
            dist = haversine_km(float(lat), float(lng),
                                float(centre["lat"]), float(centre["lng"]))
            if dist <= float(radius):
                candidates.append((_priority(area), dist, centre))
        if candidates:
            candidates.sort(key=lambda c: (c[0], c[1]))
            return candidates[0][2]

    return None


def check_coverage(city=None, pincode=None, lat=None, lng=None) -> dict:
    """Patient-facing. Returns a boolean and NOTHING else.

    Deliberately a separate function from resolve_center: the centre row it
    returns carries partner_lab_name, and this is the one call a patient makes.
    """
    return {"serviceable": resolve_center(city=city, pincode=pincode,
                                          lat=lat, lng=lng) is not None}


from app.services.tube_derivation import derive_tubes


def _tube_map(service_ids: List[str]) -> dict:
    """home_service_id -> [tube_type_code]. A service with no row draws no blood."""
    if not service_ids:
        return {}
    rows = _rows(
        supabase.table("home_service_tubes")
        .select("home_service_id, tube_type_code")
        .in_("home_service_id", list(set(service_ids)))
        .execute()
    )
    out: dict = {}
    for r in rows:
        out.setdefault(r["home_service_id"], []).append(r["tube_type_code"])
    return out


def assign_booking(booking_id: str) -> Optional[str]:
    """Assign a home-collection booking to a centre and register its tubes.

    Idempotent: re-running on an already-assigned booking returns the same
    centre and creates nothing, so a retried booking cannot double the tubes a
    phlebotomist is told to draw.
    """
    booking_rows = _rows(
        supabase.table("bookings").select("*").eq("id", booking_id).limit(1).execute()
    )
    if not booking_rows:
        return None
    booking = booking_rows[0]

    if booking.get("processing_center_id"):
        return booking["processing_center_id"]

    centre = resolve_center(
        city=booking.get("collection_city"),
        pincode=booking.get("collection_pincode"),
        lat=booking.get("collection_lat"),
        lng=booking.get("collection_lng"),
    )
    if centre is None:
        # Coverage is checked at the location step, long before this. Reaching
        # here means the centre was paused between search and payment.
        logger.warning("No processing centre for booking %s", booking_id)
        return None

    centre_id = centre["id"]

    supabase.table("bookings").update({
        "processing_center_id": centre_id,
        "provider_id": centre_id,          # keeps the existing NOT NULL satisfied
        "provider_type": "processing_center",
    }).eq("id", booking_id).execute()

    subjects = _rows(
        supabase.table("booking_subjects").select("*").eq("booking_id", booking_id).execute()
    )
    tests = _rows(
        supabase.table("booking_tests").select("*").eq("booking_id", booking_id).execute()
    )
    tube_map = _tube_map([t["home_service_id"] for t in tests])

    for subject in subjects:
        lines = [
            {
                "booking_test_id": t["id"],
                "home_service_id": t["home_service_id"],
                "tube_type_codes": tube_map.get(t["home_service_id"], []),
            }
            for t in tests
            if t.get("booking_subject_id") == subject["id"]
        ]

        for tube in derive_tubes(lines):
            inserted = _rows(
                supabase.table("samples").insert({
                    "barcode": None,                    # bound when the phlebo scans
                    "booking_id": booking_id,
                    "patient_id": booking.get("patient_id"),
                    "booking_subject_id": subject["id"],
                    "processing_center_id": centre_id,
                    "expected_tube_type_code": tube["tube_type_code"],
                    "status": "pending_collection",
                }).execute()
            )
            if not inserted:
                continue
            sample_id = inserted[0].get("id")

            for booking_test_id in tube["booking_test_ids"]:
                supabase.table("sample_tests").insert({
                    "sample_id": sample_id,
                    "booking_test_id": booking_test_id,
                }).execute()

            supabase.table("sample_events").insert({
                "sample_id": sample_id,
                "event": "registered",
                "actor_role": "system",
                "processing_center_id": centre_id,
                "location_label": "booking",
            }).execute()

    return centre_id
