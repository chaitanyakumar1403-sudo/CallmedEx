"""
Universal Dispatch Engine — Next-Gen CallMedex
Uber/Swiggy-style real-time dispatch for ALL field providers:
  nurses, phlebotomists, home-visit doctors, ambulances, pharmacy delivery.

Uses the universal provider_locations + dispatch_requests + dispatch_offers tables.
Supports: provider matching, offer rotation, live tracking, and ETA calculation.
"""
import asyncio
import uuid
import math
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import logging
from app.config import settings
from app.database import supabase
from app.services.otp import OTPService
from app.services.email import EmailService

logger = logging.getLogger(__name__)

# ─── Status flow ──────────────────────────────────────────────────────────
# searching → provider_notified → provider_accepted → en_route →
# arrived → in_progress → completed
# At any point: → cancelled or → no_provider (timeout)
# ──────────────────────────────────────────────────────────────────────────

VALID_PROVIDER_TYPES = {
    "nurse", "phlebotomist", "doctor", "ambulance", "pharmacy_delivery",
    # Dietitians and physiotherapists are sold with a home_visit_fee and
    # available_for_home_visit (see database/mou_dietitian_physio_foundation.sql).
    # Without them here find_nearby_providers rejected the type outright, so a
    # home visit the patient had paid for could never be dispatched to anyone.
    "dietitian", "physiotherapist",
}

# The phlebotomist MOUs give a collector 10 minutes to accept or reject
# ("Accept the orders within 10 minutes"). The previous 30-second value
# contradicted that, was never enforced anywhere, and disagreed with both the
# 5-minute magic-link token and the "You have 5 minutes" line in the email.
# The contractual window is the one that governs; it is read from
# platform_settings so operations can change it without a deploy.
DEFAULT_OFFER_WINDOW_MINUTES = 10
OFFER_EXPIRY_SECONDS = DEFAULT_OFFER_WINDOW_MINUTES * 60  # kept for callers

MAX_SEARCH_ROUNDS = 3      # Number of rounds to search for providers

# The service radius the platform actually operates on. Callers used to pass an
# ad-hoc 10.0 while the operating model (and the phlebotomist MOU) is 15 km, so
# collectors 12 km from the patient were silently never offered the job.
# Read from platform_settings so ops can widen a city without a deploy.
DEFAULT_SEARCH_RADIUS_KM = 15.0

# Urgent work is sped up by casting a WIDER net, not by shortening the accept
# window. Cutting a provider's deadline below the agreed 10 minutes would
# breach the signed MOU; notifying more providers over a larger radius gets the
# patient seen sooner without changing anyone's terms.
URGENT_RADIUS_MULTIPLIER = 2.0
URGENT_MAX_OFFERS = 12
NORMAL_MAX_OFFERS = 5

_local_dispatches: List[dict] = []
_LOCAL_DISPATCH_MAX_AGE_HOURS = 24  # Clean up dispatches older than 24 hours


def _is_verified_provider(row: dict) -> bool:
    """True when this candidate row shows a verified provider.

    The two candidate sources spell it differently: the legacy role tables
    (phlebotomists/nurses) carry `verification_status` on the row itself, while
    provider_locations carries it on the embedded `users` record.
    """
    if (row.get("verification_status") or "") == "verified":
        return True
    user = row.get("users") or {}
    return (user.get("verification_status") or "") == "verified"


def _cleanup_local_dispatches():
    """Remove stale entries from the in-memory dispatch list to prevent memory leaks."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=_LOCAL_DISPATCH_MAX_AGE_HOURS)
    global _local_dispatches
    before = len(_local_dispatches)
    _local_dispatches = [
        d for d in _local_dispatches
        if d.get("created_at") and d["created_at"] > cutoff.isoformat()
    ]
    if before != len(_local_dispatches):
        logger.debug(f"Cleaned up {before - len(_local_dispatches)} stale local dispatches")


def _platform_number(key: str, field: str, default: float) -> float:
    """Read one numeric knob out of platform_settings, falling back to `default`."""
    if not supabase:
        return default
    try:
        rows = (
            supabase.table("platform_settings")
            .select("value").eq("key", key).limit(1).execute()
        ).data or []
        if rows and isinstance(rows[0], dict):
            value = rows[0].get("value")
            if isinstance(value, dict):
                num = value.get(field)
                if isinstance(num, (int, float)) and num > 0:
                    return float(num)
    except Exception:
        pass
    return default


def search_radius_km_setting() -> float:
    """Patient service radius in km, from platform_settings, defaulting to 15."""
    return _platform_number("dispatch_search_radius_km", "km", DEFAULT_SEARCH_RADIUS_KM)


def offer_window_minutes() -> int:
    """Accept/reject window, from platform_settings, defaulting to the MOU's 10."""
    if not supabase:
        return DEFAULT_OFFER_WINDOW_MINUTES
    try:
        rows = (
            supabase.table("platform_settings")
            .select("value").eq("key", "phlebo_offer_window_minutes").limit(1).execute()
        ).data or []
        if rows and isinstance(rows[0], dict):
            value = rows[0].get("value")
            if isinstance(value, dict):
                minutes = value.get("minutes")
                if isinstance(minutes, (int, float)) and minutes > 0:
                    return int(minutes)
    except Exception:
        pass
    return DEFAULT_OFFER_WINDOW_MINUTES


class UniversalDispatchEngine:
    """
    Provider-agnostic dispatch engine.
    Matches patients to the nearest available field provider
    regardless of provider type (nurse, phlebotomist, doctor, etc).
    """

    # ──────────────────────────────────────────────────────────────────
    # Distance Calculation
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two GPS coordinates in kilometers."""
        R = 6371.0  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @staticmethod
    def estimate_eta_minutes(distance_km: float, provider_type: str = "nurse") -> int:
        """Estimate ETA based on provider type and distance."""
        # Average speeds by provider type (km/h in city traffic)
        speeds = {
            "ambulance": 35,      # Faster due to sirens
            "doctor": 20,         # Two-wheeler / car in traffic
            "nurse": 20,
            "phlebotomist": 20,
            "pharmacy_delivery": 25,  # Delivery vehicle
        }
        speed = speeds.get(provider_type, 20)
        return max(1, round((distance_km / speed) * 60))

    # ──────────────────────────────────────────────────────────────────
    # Find Nearby Providers
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def find_nearby_providers(
        patient_lat: float,
        patient_lng: float,
        provider_type: str,
        radius_km: Optional[float] = None,
        limit: Optional[int] = 5,
        exclude_ids: List[str] = None,
        processing_center_id: Optional[str] = None,
        ignore_radius: bool = False,
    ) -> list:
        """
        Find online providers of the specified type within radius.
        Ranked by: distance (bucketed to the km) → rating → exact distance.

        Uses provider_locations table for a unified provider location store.
        Falls back to legacy role-specific tables if provider_locations is empty.

        `processing_center_id` and `ignore_radius` are opt-in and only meaningful
        for home collection (phlebotomist) dispatch: a phlebotomist may only be
        offered work for their own processing centre, because they physically
        could not submit the tubes anywhere else afterwards. When
        `processing_center_id` is omitted (every existing caller), behaviour is
        unchanged.

        `limit` defaults to 5 for every existing caller. Passing `limit=None`
        removes the cap entirely — used for urgent centre-wide home-collection
        fan-out, where every on-duty phlebotomist of the centre must be
        notified, not just the first N.
        """
        if provider_type not in VALID_PROVIDER_TYPES:
            logger.warning(f"Invalid provider type: {provider_type}")
            return []

        if not supabase:
            return []

        if radius_km is None:
            radius_km = search_radius_km_setting()
        exclude_ids = exclude_ids or []

        # ── MERGE candidates from both tables ─────────────────────────
        # Always query BOTH provider_locations (universal) and the legacy
        # role table (phlebotomists/nurses), then merge results. The old
        # either/or fallback was the root cause of the recurring "phlebotomist
        # never gets notified" bug — if provider_locations had even one stale
        # row, the fallback was skipped entirely. Now every online provider
        # with valid coordinates is considered regardless of which table has
        # their freshest data.
        providers = []

        # Path A: universal provider_locations table
        try:
            # verification_status is pulled through so the candidate loop below
            # can drop unverified providers. Path B (legacy tables) already
            # filters it in SQL; path A had no such filter at all, so an
            # unverified — or outright rejected — provider who merely had a
            # provider_locations row and flipped themselves online was being
            # dispatched into a patient's home.
            result_a = (
                supabase.table("provider_locations")
                .select("*, users!inner(id, full_name, mobile, email)")
                .eq("provider_type", provider_type)
                .eq("is_online", True)
                .not_.is_("current_lat", "null")
                .not_.is_("current_lng", "null")
                .execute()
            )
            providers.extend(result_a.data or [])
        except Exception:
            pass

        # Path B: legacy role-specific table (always run — never skip)
        try:
            result_b = await UniversalDispatchEngine._fallback_find(
                provider_type, patient_lat, patient_lng
            )
            # Deduplicate by user_id — prefer the provider_locations entry
            # (Path A) since it likely has fresher coordinates, but always
            # include any provider that only exists in the legacy table.
            #
            # "Prefer Path A" only holds while Path A actually has a position.
            # A provider_locations row written by the duty toggle carries
            # is_online with NULL coordinates until the first GPS ping lands;
            # keeping that row over the legacy one discarded the base location
            # that would have made the collector dispatchable.
            by_uid = {}
            for p in providers:
                uid = p.get("user_id") or p.get("users", {}).get("id")
                if uid:
                    by_uid[uid] = p
            for p in result_b:
                uid = p.get("user_id") or p.get("users", {}).get("id")
                if not uid:
                    continue
                existing = by_uid.get(uid)
                if existing is None:
                    by_uid[uid] = p
                    providers.append(p)
                elif existing.get("current_lat") is None and existing.get("current_lng") is None:
                    # Path A knows nothing about where they are; merge the
                    # legacy row's coordinates in rather than dropping them.
                    for key in ("current_lat", "current_lng", "base_lat", "base_lng"):
                        if p.get(key) is not None:
                            existing[key] = p[key]
        except Exception:
            pass

        # Home collection is centre-bound: a phlebo may only be offered work
        # they could actually submit afterwards. Other provider types are
        # unaffected — the filter only engages when a centre is supplied.
        centre_members = None
        if processing_center_id:
            binding = supabase.table("phlebotomists") \
                .select("user_id") \
                .eq("processing_center_id", processing_center_id) \
                .execute()
            centre_members = {
                r["user_id"] for r in (getattr(binding, "data", None) or [])
                if isinstance(r, dict) and r.get("user_id")
            }
            # Fallback: if no centre members are currently online/available, broadcast to all
            available_uids = {p.get("user_id") or p.get("users", {}).get("id") for p in providers}
            if not any(uid in centre_members for uid in available_uids):
                logger.warning(f"No phlebotomists from centre {processing_center_id} are online. Falling back to radius-bound, cross-centre-excluded broadcast.")
                # "Broadcast to everyone" must still stop at two boundaries:
                # (1) distance — re-engage the radius filter below, since we're
                #     no longer trusting a single centre's affiliation as a
                #     stand-in for GPS accuracy; unbounded, this silently
                #     becomes "fallback to nationwide."
                # (2) centre exclusivity — a phlebo already bound to a
                #     DIFFERENT specific centre physically cannot submit tubes
                #     to this one, however close they are. Only exclude those;
                #     phlebos with no centre binding at all remain eligible.
                ignore_radius = False
                other_binding = supabase.table("phlebotomists") \
                    .select("user_id, processing_center_id") \
                    .in_("user_id", [uid for uid in available_uids if uid]) \
                    .execute()
                bound_to_another_centre = {
                    r["user_id"] for r in (getattr(other_binding, "data", None) or [])
                    if isinstance(r, dict) and r.get("processing_center_id")
                    and r.get("processing_center_id") != processing_center_id
                }
                centre_members = available_uids - bound_to_another_centre

        # Verification is authoritative on the ROLE table
        # (phlebotomists/nurses.verification_status), not on users — the users
        # table has no such column, so the provider_locations query that tried
        # to embed it threw on every call and path A silently contributed
        # nothing at all. Resolve it once, here, for every merged candidate.
        role_table = {"phlebotomist": "phlebotomists", "nurse": "nurses"}.get(provider_type)
        verified_ids: set = set()
        if role_table:
            uids = [
                (p.get("user_id") or (p.get("users") or {}).get("id"))
                for p in providers
            ]
            uids = [u for u in dict.fromkeys(uids) if u]
            if uids:
                try:
                    rows = (
                        supabase.table(role_table)
                        .select("user_id, verification_status")
                        .in_("user_id", uids).execute()
                    ).data or []
                    verified_ids = {
                        r["user_id"] for r in rows
                        if (r.get("verification_status") or "") == "verified"
                    }
                except Exception as e:
                    logger.warning(f"verification lookup failed for {provider_type}: {e}")

        # Calculate distances and filter
        candidates = []
        for p in providers:
            user_id = p.get("user_id") or p.get("users", {}).get("id", "")
            if user_id in exclude_ids:
                continue

            if centre_members is not None and user_id not in centre_members:
                continue

            # Single verification rule for BOTH candidate paths. Path B carries
            # it on the role row (phlebotomists/nurses), path A on the embedded
            # user. Someone the platform has not verified never gets sent to a
            # patient's address, whichever table they surfaced from.
            if not (_is_verified_provider(p) or user_id in verified_ids):
                logger.warning(
                    f"Skipping unverified {provider_type} {user_id} for dispatch."
                )
                continue

            # Live GPS is the truth when we have it. When we do not — the fix
            # has not landed yet, or the device cannot produce one — the
            # provider's registered base location is used instead, so being on
            # duty is enough to be offered work. `location_source` is carried
            # through so the ETA and the patient-facing map can say which it is.
            p_lat = p.get("current_lat")
            p_lng = p.get("current_lng")
            location_source = "live"
            if p_lat is None or p_lng is None:
                p_lat = p.get("base_lat")
                p_lng = p.get("base_lng")
                location_source = "base"
            if p_lat is None or p_lng is None:
                continue

            dist = UniversalDispatchEngine.haversine_km(
                patient_lat, patient_lng, float(p_lat), float(p_lng)
            )
            if ignore_radius or dist <= radius_km:
                user_data = p.get("users", {})
                candidates.append({
                    "user_id": user_id,
                    "name": user_data.get("full_name", p.get("full_name", "Unknown")),
                    "mobile": user_data.get("mobile", ""),
                    "email": user_data.get("email", ""),
                    "distance_km": round(dist, 2),
                    "eta_minutes": UniversalDispatchEngine.estimate_eta_minutes(dist, provider_type),
                    "lat": float(p_lat),
                    "lng": float(p_lng),
                    "location_source": location_source,
                    "provider_type": provider_type,
                })

        # Rank by distance first, then by rating. Distance stays dominant —
        # a well-rated collector 9 km away is worse for the patient than a
        # decent one 2 km away — so distance is bucketed to the nearest
        # kilometre and rating only breaks ties inside a bucket.
        #
        # An unrated provider sorts as neutral (3.0), not last: a new joiner
        # must still get work, or nobody can ever earn a first rating.
        from app.services import ratings as _ratings

        summaries = _ratings.get_summaries(
            [c.get("user_id") for c in candidates if c.get("user_id")],
            db=supabase,
        )
        for c in candidates:
            summary = summaries.get(c.get("user_id") or "") or {}
            c["rating"] = summary.get("average_stars")
            c["rating_count"] = summary.get("rating_count", 0)

        candidates.sort(
            key=lambda x: (
                round(x["distance_km"]),
                -(x["rating"] if x["rating"] is not None else 3.0),
                x["distance_km"],
            )
        )
        return candidates[:limit]

    @staticmethod
    async def _fallback_find(provider_type: str, lat: float, lng: float) -> list:
        """Fallback to legacy role-specific tables for provider locations."""
        table_map = {
            "phlebotomist": "phlebotomists",
            "nurse": "nurses",
        }
        table = table_map.get(provider_type)
        if not table or not supabase:
            return []

        try:
            if provider_type == "phlebotomist":
                # Deliberately NOT filtered on a non-null current_lat: a
                # collector who is on duty but whose browser/phone has not
                # produced a GPS fix yet (permission prompt still open, indoor
                # cold start, a laptop with no GPS at all) was excluded here
                # AND from provider_locations, so they sat "on duty" all day
                # receiving nothing. base_lat/base_lng — their registered
                # working location — is the fallback the candidate loop
                # coalesces to.
                result = (
                    supabase.table(table)
                    .select(
                        "*, users!phlebotomists_user_id_fkey!inner("
                        "id, full_name, mobile, email)"
                    )
                    .eq("on_duty", True)
                    .eq("verification_status", "verified")
                    .execute()
                )
            elif provider_type == "nurse":
                result = (
                    supabase.table(table)
                    .select("*, users!inner(id, full_name, mobile, email)")
                    .eq("is_online", True)
                    .eq("verification_status", "verified")
                    .not_.is_("current_lat", "null")
                    .not_.is_("current_lng", "null")
                    .execute()
                )
            else:
                return []

            return result.data or []
        except Exception as e:
            logger.warning(f"Fallback find failed for {provider_type}: {e}")
            return []

    # ──────────────────────────────────────────────────────────────────
    # Direct Dispatch (patient chose this specific provider)
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def create_direct_dispatch(
        *,
        patient_id: str,
        provider_id: str,
        provider_type: str,
        patient_lat: float,
        patient_lng: float,
        patient_address: str,
        booking_id: Optional[str] = None,
        service_subtype: Optional[str] = None,
        notes: str = "",
        scheduled_for: Optional[str] = None,
    ) -> dict:
        """Offer a home visit to the ONE provider the patient picked.

        create_dispatch fans a job out to whoever is nearest, which is right for
        "send me any phlebotomist" but wrong when the patient has chosen a named
        physiotherapist and is paying that person's rate. This creates the same
        dispatch_requests + dispatch_offers pair so everything downstream — the
        provider's task list, offer acceptance, live tracking, arrival OTP,
        clinical notes, ratings — works identically, but with exactly one
        candidate.

        Returns a dict with `dispatch_id`, or `{"success": False}` when the
        dispatch could not be created (the caller decides what to tell the
        patient; it must never claim a visit is booked when it is not).
        """
        if not supabase:
            return {"success": False, "message": "Dispatch is unavailable right now."}

        dispatch_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        expires_at = (now + timedelta(minutes=offer_window_minutes())).isoformat()

        def _valid_uuid(value):
            try:
                uuid.UUID(str(value))
                return str(value)
            except (ValueError, TypeError):
                return None

        dispatch_row = {
            "id": dispatch_id,
            "patient_id": _valid_uuid(patient_id),
            "booking_id": _valid_uuid(booking_id),
            "provider_type": provider_type,
            "service_subtype": service_subtype,
            # Not yet accepted: the provider still has to take the job. Marking
            # it accepted here would tell the patient someone is coming before
            # anyone had agreed to.
            "status": "provider_notified",
            "assigned_provider_id": None,
            "patient_lat": patient_lat,
            "patient_lng": patient_lng,
            "patient_address": patient_address,
            "priority": "normal",
            "notes": notes,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        if scheduled_for:
            dispatch_row["scheduled_for"] = scheduled_for

        try:
            await asyncio.to_thread(
                lambda: supabase.table("dispatch_requests").insert(dispatch_row).execute()
            )
        except Exception as e:
            logger.error(f"Direct dispatch insert failed for booking {booking_id}: {e}")
            return {"success": False, "message": "Could not create the visit request."}

        offer_id = str(uuid.uuid4())
        try:
            await asyncio.to_thread(
                lambda: supabase.table("dispatch_offers").insert({
                    "id": offer_id,
                    "dispatch_request_id": dispatch_id,
                    "provider_id": provider_id,
                    "status": "pending",
                    "distance_km": None,
                    "offered_at": now_iso,
                    "responded_at": None,
                    "expires_at": expires_at,
                }).execute()
            )
        except Exception as e:
            # Without an offer row the provider has nothing to accept, so the
            # dispatch would sit until the sweep killed it. Fail loudly.
            logger.error(f"Direct dispatch offer insert failed for {dispatch_id}: {e}")
            return {"success": False, "message": "Could not notify the provider."}

        # Tell the chosen provider, by every channel we have.
        try:
            prov = await asyncio.to_thread(
                lambda: supabase.table("users").select("full_name, email")
                .eq("id", provider_id).limit(1).execute()
            )
            prov_row = (prov.data or [{}])[0]
            if prov_row.get("email"):
                asyncio.create_task(
                    asyncio.to_thread(
                        EmailService.send_magic_dispatch_email_safe,
                        to_email=prov_row["email"],
                        provider_name=prov_row.get("full_name"),
                        task_details={
                            "service_subtype": service_subtype,
                            "patient_address": patient_address,
                            "distance_km": None,
                            "notes": notes,
                            "priority": "normal",
                            "window_minutes": offer_window_minutes(),
                        },
                        offer_id=offer_id,
                        provider_id=provider_id,
                    )
                )
        except Exception as e:
            logger.warning(f"Direct dispatch email lookup failed for {provider_id}: {e}")

        asyncio.create_task(
            UniversalDispatchEngine._push_offer_to_candidate(
                provider_id=provider_id,
                service_subtype=service_subtype,
                distance_km=None,
                patient_address=patient_address,
                priority="normal",
                dispatch_id=dispatch_id,
                offer_id=offer_id,
            )
        )

        return {
            "success": True,
            "dispatch_id": dispatch_id,
            "offer_id": offer_id,
            "provider_id": provider_id,
            "status": "provider_notified",
            "message": "Request sent to your chosen provider.",
        }

    # ──────────────────────────────────────────────────────────────────
    # Create Dispatch Request
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def create_dispatch(
        patient_id: str,
        patient_lat: float,
        patient_lng: float,
        patient_address: str,
        provider_type: str,
        service_subtype: str = None,
        notes: str = "",
        booking_id: str = None,
        address_details: dict = None,
        search_radius_km: Optional[float] = None,
        processing_center_id: str = None,
        priority: str = "normal",
    ) -> dict:
        """
        Create a universal dispatch request and offer it to nearby providers.

        Urgent requests widen the search radius and notify more providers in
        parallel. They do NOT shorten the individual accept window, which is a
        contractual term in the provider MOUs.

        Home collection (phlebotomist, with a processing_center_id) is
        centre-bound, so an urgent request fans out to EVERY on-duty
        phlebotomist of that centre instead of merely doubling the radius —
        widening a radius is the wrong lever when the real constraint is the
        centre, not the distance. That fan-out is uncapped (no URGENT_MAX_OFFERS
        ceiling): during a surge, every candidate must actually be notified,
        not just the first 12.
        """
        # Clean up stale in-memory dispatches before creating a new one
        _cleanup_local_dispatches()

        dispatch_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        urgent = priority == "urgent"

        # Urgent home collection fans out to EVERY on-duty phlebo of the
        # booking's centre. Widening the radius is not enough when the
        # constraint is the centre, not the distance.
        if search_radius_km is None:
            search_radius_km = search_radius_km_setting()
        home_collection = provider_type == "phlebotomist" and processing_center_id
        urgent_home_collection = bool(urgent and home_collection)
        # Centre membership used to switch distance off for ALL home
        # collection, urgent or not, which is how a collector on the far edge
        # of a centre's district got offered a routine doorstep visit they had
        # no chance of reaching on time. Routine work now respects the service
        # radius; an URGENT centre fan-out still deliberately ignores it,
        # because reaching every on-duty collector of the centre is the whole
        # point of that escape hatch.
        ignore_radius = urgent_home_collection
        effective_radius = (
            search_radius_km * URGENT_RADIUS_MULTIPLIER
            if urgent and not home_collection
            else search_radius_km
        )
        # Urgent home collection must reach every on-duty phlebo of the centre,
        # not just the first URGENT_MAX_OFFERS of them — a surge is exactly
        # the scenario where the cap would silently drop candidates. Every
        # other path (including non-urgent home collection) keeps its cap.
        max_offers = (
            None if urgent_home_collection
            else URGENT_MAX_OFFERS if urgent
            else NORMAL_MAX_OFFERS
        )

        # Find candidates
        candidates = await UniversalDispatchEngine.find_nearby_providers(
            patient_lat, patient_lng, provider_type,
            radius_km=effective_radius, limit=max_offers,
            processing_center_id=processing_center_id,
            ignore_radius=ignore_radius,
        )

        assigned_provider = None
        status = "searching"

        # We no longer auto-assign the closest provider.
        # Instead, we send magic emails to all candidates and let them accept.

        # Ensure booking_id and patient_id are valid UUIDs for DB columns, or None
        valid_booking_id = None
        if booking_id:
            try:
                uuid.UUID(str(booking_id))
                valid_booking_id = str(booking_id)
            except (ValueError, TypeError):
                valid_booking_id = None

        valid_patient_id = None
        if patient_id:
            try:
                uuid.UUID(str(patient_id))
                valid_patient_id = str(patient_id)
            except (ValueError, TypeError):
                valid_patient_id = None

        dispatch_data = {
            "id": dispatch_id,
            "patient_id": valid_patient_id,
            "booking_id": valid_booking_id,
            "provider_type": provider_type,
            "service_subtype": service_subtype,
            "status": status,
            "patient_lat": patient_lat,
            "patient_lng": patient_lng,
            "patient_address": patient_address,
            "patient_address_details": address_details or {},
            "assigned_provider_id": assigned_provider["user_id"] if assigned_provider else None,
            "search_radius_km": effective_radius,
            "priority": priority,
            "notes": notes,
            "estimated_distance_km": assigned_provider["distance_km"] if assigned_provider else None,
            "estimated_eta_minutes": assigned_provider["eta_minutes"] if assigned_provider else None,
            "assigned_at": now if assigned_provider else None,
            "created_at": now,
            "updated_at": now,
        }

        # Store in local memory fallback list
        _local_dispatches.append(dispatch_data)

        if supabase:
            try:
                try:
                    await asyncio.to_thread(
                        lambda: supabase.table("dispatch_requests").insert(dispatch_data).execute()
                    )
                except Exception as insert_err:
                    # booking_id can point at a booking that only ever made it
                    # into the local in-memory fallback (its own Supabase
                    # insert failed, e.g. a bad provider_id sentinel like
                    # "on_demand") — the FK on dispatch_requests.booking_id
                    # then rejects this row too, and every caller funnels
                    # through this one method, so silently dropping the whole
                    # dispatch here means NO provider is ever notified. That
                    # booking record is never required to actually notify a
                    # provider (candidate search is by lat/lng, not
                    # booking_id) — drop the stale link and retry once rather
                    # than losing the notification over it.
                    if valid_booking_id and "booking_id" in str(insert_err):
                        logger.warning(
                            f"dispatch_requests insert failed on booking_id={valid_booking_id} "
                            f"(booking not found in DB), retrying without it: {insert_err}"
                        )
                        dispatch_data["booking_id"] = None
                        await asyncio.to_thread(
                            lambda: supabase.table("dispatch_requests").insert(dispatch_data).execute()
                        )
                    else:
                        raise

                # Build every offer up front, then insert them in ONE round
                # trip instead of one blocking .execute() per candidate.
                # urgent_home_collection fan-out is intentionally uncapped
                # (every on-duty phlebo of a centre during a surge), so N
                # sequential synchronous DB calls serialized on the event
                # loop would freeze it for every other request for as long
                # as the surge lasts — the same class of problem the email
                # send was already pulled off the hot path for.
                expires_at = (
                    datetime.now(timezone.utc)
                    + timedelta(minutes=offer_window_minutes())
                ).isoformat()
                offers = [
                    {
                        "id": str(uuid.uuid4()),
                        "dispatch_request_id": dispatch_id,
                        "provider_id": candidate["user_id"],
                        "status": "pending",
                        "distance_km": candidate["distance_km"],
                        "offered_at": now,
                        "responded_at": None,
                        "expires_at": expires_at,
                    }
                    for candidate in candidates
                ]

                if offers:
                    await asyncio.to_thread(
                        lambda: supabase.table("dispatch_offers").insert(offers).execute()
                    )

                # Notify every candidate — already non-blocking (fire-and-forget)
                for candidate, offer in zip(candidates, offers):
                    provider_email = candidate.get("email")
                    if provider_email:
                        asyncio.create_task(
                            asyncio.to_thread(
                                EmailService.send_magic_dispatch_email_safe,
                                to_email=provider_email,
                                provider_name=candidate.get("name"),
                                task_details={
                                    "service_subtype": service_subtype,
                                    "patient_address": patient_address,
                                    "distance_km": candidate["distance_km"],
                                    "notes": notes,
                                    "priority": priority,
                                    "window_minutes": offer_window_minutes(),
                                },
                                offer_id=offer["id"],
                                provider_id=candidate["user_id"]
                            )
                        )

                    # Push alongside the email. Email plus dashboard polling
                    # only reaches a provider who happens to be looking, and an
                    # offer expires in minutes — it has to be able to wake the
                    # phone. Fire-and-forget for the same reason the email is:
                    # a push failure must never sink the dispatch.
                    asyncio.create_task(
                        UniversalDispatchEngine._push_offer_to_candidate(
                            provider_id=candidate["user_id"],
                            service_subtype=service_subtype,
                            distance_km=candidate["distance_km"],
                            patient_address=patient_address,
                            priority=priority,
                            dispatch_id=dispatch_id,
                            offer_id=offer["id"],
                        )
                    )

                    # And an in-app row. The notification bell on every
                    # provider dashboard reads the `in_app` channel, and this
                    # path only ever wrote push + email — so a collector who
                    # was offered work saw an empty bell and reported getting
                    # "no alerts at all". Push is Android-only in practice and
                    # email lands in a spam folder; the bell is the one channel
                    # that is always there when they open the dashboard.
                    asyncio.create_task(
                        UniversalDispatchEngine._notify_offer_in_app(
                            provider_id=candidate["user_id"],
                            service_subtype=service_subtype,
                            distance_km=candidate["distance_km"],
                            priority=priority,
                            dispatch_id=dispatch_id,
                            offer_id=offer["id"],
                        )
                    )

            except Exception as e:
                # Returning the success dict here is how a patient gets told
                # "Phlebotomist X assigned, ~15 min away" while no
                # dispatch_requests/dispatch_offers row exists and no provider
                # was ever notified. Raise so the caller's retry path (see
                # bookings.py -> retry_dispatch_creation) actually fires.
                logger.error(f"Failed to create dispatch: {e}")
                raise

        return {
            "dispatch_id": dispatch_id,
            "booking_id": valid_booking_id,
            "status": status,
            "priority": priority,
            "provider_type": provider_type,
            "service_subtype": service_subtype,
            "assigned_provider": assigned_provider,
            "all_candidates": len(candidates),
            "estimated_distance_km": assigned_provider["distance_km"] if assigned_provider else None,
            "estimated_eta_minutes": assigned_provider["eta_minutes"] if assigned_provider else None,
            "message": (
                f"{provider_type.replace('_', ' ').title()} {assigned_provider['name']} assigned "
                f"({assigned_provider['distance_km']} km away, ~{assigned_provider['eta_minutes']} min)"
                if assigned_provider
                else f"No {provider_type.replace('_', ' ')}s available nearby. Your request has been queued."
            ),
        }

    @staticmethod
    async def _notify_offer_in_app(
        *,
        provider_id: str,
        service_subtype: str,
        distance_km,
        priority: str,
        dispatch_id: str,
        offer_id: str,
    ) -> None:
        """Write the offer to the provider's in-app notification centre.

        Carries no patient identity or address — same rule as the push
        preview; the provider opens the offer to see where they are going.
        Never raises: a notification failure must not sink a dispatch.
        """
        try:
            from app.services.notification_engine import NotificationEngine

            label = (service_subtype or "home visit").replace("_", " ")
            parts = [label.title()]
            if distance_km is not None:
                parts.append(f"{distance_km} km away")
            parts.append(f"respond within {offer_window_minutes()} min")
            await NotificationEngine.send(
                provider_id,
                "in_app",
                "Urgent request nearby" if priority == "urgent" else "New visit request",
                " · ".join(parts),
                {
                    "type": "dispatch_offer",
                    "dispatch_id": dispatch_id,
                    "offer_id": offer_id,
                    "priority": priority,
                },
            )
        except Exception as e:
            logger.warning(f"In-app offer alert for provider {provider_id} failed: {e}")

    @staticmethod
    async def _push_offer_to_candidate(
        *,
        provider_id: str,
        service_subtype: str,
        distance_km: float,
        patient_address: str,
        priority: str,
        dispatch_id: str,
        offer_id: str,
    ) -> None:
        """Wake a candidate's phone for a new offer. Never raises.

        Carries no patient identity and no address fragment — a push preview
        renders on a locked screen anyone nearby can read. Distance and
        urgency are enough to decide whether to tap; the address comes from
        the app once the provider opens the offer.

        (`patient_address` stays in the signature so the caller reads
        naturally and a future locality lookup has it, but it is deliberately
        not rendered: splitting an Indian address on commas yields the flat
        number, not the locality.)
        """
        from app.services import push as push_service

        urgent = priority == "urgent"
        service_label = (service_subtype or "home visit").replace("_", " ")

        title = "Urgent request nearby" if urgent else "New visit request"
        # A direct offer to a named provider has no distance (they were chosen,
        # not matched by proximity) — rendering it produced "None km away".
        parts = [service_label.title()]
        if distance_km is not None:
            parts.append(f"{distance_km} km away")
        parts.append(f"respond within {offer_window_minutes()} min")
        body = " · ".join(parts)

        try:
            await push_service.send_to_user(
                user_id=provider_id,
                title=title,
                body=body,
                data={
                    "type": "dispatch_offer",
                    "dispatch_id": dispatch_id,
                    "offer_id": offer_id,
                    "priority": priority,
                    "distance_km": distance_km,
                },
                channel_id=push_service.CHANNEL_DISPATCH,
            )
        except Exception as e:
            logger.warning(f"Offer push to provider {provider_id} failed: {e}")

    # ──────────────────────────────────────────────────────────────────
    # Provider Responds to Offer
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def respond_to_offer(
        offer_id: str,
        provider_id: str,
        accepted: bool,
    ) -> dict:
        """Provider accepts or rejects a dispatch offer."""
        now = datetime.now(timezone.utc).isoformat()

        if not supabase:
            return {"success": True, "message": f"Offer {'accepted' if accepted else 'rejected'}"}

        # Get the offer
        offer_result = (
            supabase.table("dispatch_offers")
            .select("*")
            .eq("id", offer_id)
            .eq("provider_id", provider_id)
            .execute()
        )
        if not offer_result.data:
            return {"success": False, "message": "Offer not found"}

        offer = offer_result.data[0]
        dispatch_id = offer["dispatch_request_id"]

        # expires_at was written on every offer but never checked, so a provider
        # could accept a long-dead request and be dispatched to a patient who had
        # already been served or had given up and gone elsewhere.
        if offer.get("status") != "pending":
            return {
                "success": False,
                "message": f"This request was already {offer.get('status')}.",
            }
        expires_at = offer.get("expires_at")
        if expires_at:
            try:
                deadline = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
                if deadline.tzinfo is None:
                    deadline = deadline.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) > deadline:
                    supabase.table("dispatch_offers").update(
                        {"status": "expired", "responded_at": now}
                    ).eq("id", offer_id).execute()
                    return {
                        "success": False,
                        "message": "This request has expired and is no longer available.",
                    }
            except (ValueError, TypeError):
                # An unparseable timestamp must not block a legitimate provider.
                logger.warning(f"Unparseable expires_at on offer {offer_id}: {expires_at}")

        if accepted:
            # Accept this offer — but only if the dispatch is still unassigned.
            # The .in_("status") guard prevents two providers accepting concurrently:
            # the second UPDATE matches zero rows and we bail without overwriting.
            accept_result = supabase.table("dispatch_requests").update({
                "status": "provider_accepted",
                "assigned_provider_id": provider_id,
                "assigned_at": now,
                "estimated_distance_km": offer.get("distance_km"),
                "updated_at": now,
            }).eq("id", dispatch_id).in_("status", ["searching", "provider_notified"]).execute()

            if not accept_result.data:
                # Another provider already accepted — mark this offer as expired
                # so the provider sees "expired" instead of an infinite offer loop.
                supabase.table("dispatch_offers").update({
                    "status": "expired",
                    "responded_at": now,
                }).eq("id", offer_id).execute()
                return {"success": False, "message": "Another provider already accepted this request."}

            # Mark this offer as accepted
            supabase.table("dispatch_offers").update({
                "status": "accepted",
                "responded_at": now,
            }).eq("id", offer_id).execute()

            # Expire all other pending offers for this dispatch
            supabase.table("dispatch_offers").update({
                "status": "expired",
            }).eq("dispatch_request_id", dispatch_id).neq("id", offer_id).eq("status", "pending").execute()

            # Send tracking email to patient
            try:
                # Fetch provider name and dispatch info in parallel (reduces N+1 to 2 queries)
                import asyncio as _asyncio

                async def _get_provider_name():
                    prov_res = await _asyncio.to_thread(
                        lambda: supabase.table("users").select("full_name").eq("id", provider_id).execute()
                    )
                    return prov_res.data[0]["full_name"] if prov_res.data else "Provider"

                async def _get_dispatch_info():
                    dispatch_res = await _asyncio.to_thread(
                        lambda: supabase.table("dispatch_requests").select("patient_id, provider_type").eq("id", dispatch_id).execute()
                    )
                    if dispatch_res.data:
                        d_req = dispatch_res.data[0]
                        patient_res = await _asyncio.to_thread(
                            lambda: supabase.table("users").select("full_name, email, mobile").eq("id", d_req["patient_id"]).execute()
                        )
                        return d_req, patient_res.data[0] if patient_res.data else None
                    return None, None

                provider_name, (d_req, patient_data) = await _asyncio.gather(
                    _get_provider_name(), _get_dispatch_info()
                )

                if d_req and patient_data:
                    patient_email = patient_data.get("email")
                    if patient_email:
                        tracking_url = f"{settings.FRONTEND_URL}/tracking/{dispatch_id}"
                        from app.services.email import EmailService
                        EmailService.send_tracking_link_email(
                            to_email=patient_email,
                            patient_name=patient_data.get("full_name", "Patient"),
                            tracking_url=tracking_url,
                            provider_name=provider_name,
                            provider_type=d_req["provider_type"]
                        )
                    from app.services.notification_engine import NotificationEngine
                    from app.services.push import CHANNEL_DISPATCH
                    role_label, _ = UniversalDispatchEngine._provider_labels(
                        d_req.get("provider_type")
                    )
                    await NotificationEngine.send_multi(
                        user_id=d_req["patient_id"],
                        channels=["in_app", "push"],
                        title=f"{role_label} assigned",
                        body=f"{provider_name} has been assigned to your booking and is preparing to head your way.",
                        data={
                            "dispatch_id": dispatch_id,
                            "status": "assigned",
                            "provider_name": provider_name,
                            "channel_id": CHANNEL_DISPATCH,
                        },
                    )
            except Exception as e:
                logger.error(f"Failed to send tracking email/notification: {e}")

            # Sync linked booking to in_progress and assign provider_id
            accepted_dispatch = accept_result.data[0] if accept_result.data else {}
            linked_booking_id = accepted_dispatch.get("booking_id")
            if linked_booking_id:
                try:
                    supabase.table("bookings").update({
                        "status": "in_progress",
                        "provider_id": provider_id,
                        "updated_at": now,
                    }).eq("id", linked_booking_id).execute()
                except Exception as b_err:
                    logger.warning(f"Failed to sync booking status on respond_to_offer: {b_err}")

            return {"success": True, "message": "Offer accepted. Navigate to patient.", "dispatch_id": dispatch_id}
        else:
            # Reject this offer
            supabase.table("dispatch_offers").update({
                "status": "rejected",
                "responded_at": now,
            }).eq("id", offer_id).execute()

            await UniversalDispatchEngine._handle_decline(dispatch_id, offer)

            return {"success": True, "message": "Offer rejected."}

    @staticmethod
    async def _handle_decline(dispatch_id: str, declined_offer: dict) -> None:
        """Keep a declined request moving instead of letting it quietly time out.

        Re-fan-out only ever ran off the periodic sweep, which hunts for
        *pending* offers past their expiry. An offer a provider actually
        declined is no longer pending, so the sweep never saw it: once every
        offered provider had said no, the request sat untouched for the full
        offer window and then died as "No provider available in your area" —
        while providers who were never asked stayed idle the whole time.

        Never raises. The decline itself is already recorded, and the provider
        must not be told it failed because the follow-up did.
        """
        try:
            still_pending = (
                supabase.table("dispatch_offers")
                .select("id")
                .eq("dispatch_request_id", dispatch_id)
                .eq("status", "pending")
                .limit(1)
                .execute()
            ).data or []
            if still_pending:
                # Someone else can still take it — leave it alone.
                return

            # A direct dispatch is the one provider the patient chose by name and
            # is paying that person's rate for. create_direct_dispatch is the only
            # path that offers with no distance, which is what identifies one here.
            # Re-offering that booking to a stranger would silently change the
            # deal, so tell the patient instead and let them choose again.
            if declined_offer.get("distance_km") is None:
                await UniversalDispatchEngine._cancel_declined_direct(dispatch_id)
                return

            from app.workers.tasks.dispatch import _try_re_fan_out

            # _try_re_fan_out is synchronous and drives an event loop of its
            # own, so it has to run off a thread rather than on this one.
            asyncio.create_task(asyncio.to_thread(_try_re_fan_out, dispatch_id))
        except Exception as e:
            logger.error(
                f"Post-decline handling failed for dispatch {dispatch_id}: {e}"
            )

    @staticmethod
    async def release_and_refill(dispatch_id: str, released_provider_id: str) -> None:
        """A provider who had accepted has handed the job back — find another.

        Reverting the row to `searching` used to be the whole of it, and nothing
        looks at a bare `searching` row: the sweep only re-offers where a
        *pending* offer expired, and this job's offers were all settled the
        moment it was accepted. So an abandoned visit sat untouched for the full
        offer window and then died as "No provider available in your area",
        with the rest of the roster idle throughout.

        Never raises. The release is already committed, and the provider must
        not be told it failed because the follow-up did.
        """
        try:
            # Retire their accepted offer first. Re-fan-out excludes providers
            # whose offer is rejected or expired, and an offer still marked
            # accepted would hand the job straight back to the person who just
            # dropped it.
            supabase.table("dispatch_offers").update({
                "status": "rejected",
                "responded_at": datetime.now(timezone.utc).isoformat(),
            }).eq("dispatch_request_id", dispatch_id)               .eq("provider_id", released_provider_id).execute()

            from app.workers.tasks.dispatch import _try_re_fan_out

            # Synchronous, and it drives an event loop of its own.
            asyncio.create_task(asyncio.to_thread(_try_re_fan_out, dispatch_id))
        except Exception as e:
            logger.error(
                f"Could not re-offer released dispatch {dispatch_id}: {e}"
            )

    @staticmethod
    async def _cancel_declined_direct(dispatch_id: str) -> None:
        """The named provider turned the visit down — close it and say so.

        Leaving the request open would strand the patient on a tracking screen
        waiting for someone who has already refused.
        """
        now = datetime.now(timezone.utc).isoformat()
        cancelled = (
            supabase.table("dispatch_requests")
            .update({
                "status": "cancelled",
                "cancel_reason": "The provider you chose is unavailable for this slot.",
                "updated_at": now,
            })
            .eq("id", dispatch_id)
            .in_("status", ["searching", "provider_notified"])
            .execute()
        ).data or []
        if not cancelled:
            return
        row = cancelled[0]

        booking_id = row.get("booking_id")
        if booking_id:
            try:
                supabase.table("bookings").update({
                    "status": "cancelled",
                    "updated_at": now,
                }).eq("id", booking_id).execute()
            except Exception as e:
                logger.warning(
                    f"Could not cancel booking {booking_id} after a declined "
                    f"direct dispatch: {e}"
                )

        patient_id = row.get("patient_id")
        if not patient_id:
            return

        role_label, _ = UniversalDispatchEngine._provider_labels(row.get("provider_type"))
        from app.services.notification_engine import NotificationEngine
        from app.services.push import CHANNEL_DISPATCH

        await NotificationEngine.send_multi(
            user_id=patient_id,
            channels=["in_app", "push"],
            title=f"{role_label} unavailable",
            body=(
                f"The {role_label.lower()} you chose could not take this "
                "appointment. Please pick another provider or another slot."
            ),
            data={
                "dispatch_id": dispatch_id,
                "status": "cancelled",
                "channel_id": CHANNEL_DISPATCH,
            },
        )

    # ──────────────────────────────────────────────────────────────────
    # Arrival Verification
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    def _dispatch_status(dispatch_id: str) -> Optional[str]:
        """Current status of a dispatch, or None when it cannot be read."""
        if supabase:
            try:
                res = (
                    supabase.table("dispatch_requests")
                    .select("status").eq("id", dispatch_id).limit(1).execute()
                )
                if res.data:
                    return res.data[0].get("status")
            except Exception as e:
                logger.warning(f"Could not read status for dispatch {dispatch_id}: {e}")
        for d in _local_dispatches:
            if d.get("id") == dispatch_id:
                return d.get("status")
        return None

    @staticmethod
    async def verify_otp_and_start(
        dispatch_id: str, provider_id: str, otp: str
    ) -> dict:
        """Check the patient's arrival code, then move the visit to in_progress.

        The two steps only make sense together. verify_otp marks the code spent
        permanently, and `in_progress` is reachable by no other route, so a
        failure between them stranded the visit outright: the code was used, the
        row was still `arrived`, and `completed` was refused for want of its
        prerequisite. The provider could not finish the visit at all, and both
        call sites — the logged-in /verify-otp and the emailed /magic-status —
        swallowed that failure and reported success.

        A code already verified on a dispatch still sitting at `arrived` is
        therefore treated as a retry of that half-finished transition, not as a
        replay: it re-drives the status change instead of refusing it. Anywhere
        else, an already-verified code is still rejected.
        """
        result = OTPService.verify_otp(dispatch_id, otp)
        if not result.get("success"):
            if result.get("error") != "OTP already verified":
                return {
                    "success": False,
                    "error": result.get("error", "OTP verification failed"),
                }
            if UniversalDispatchEngine._dispatch_status(dispatch_id) != "arrived":
                return {"success": False, "error": "OTP already verified"}
            logger.info(
                f"Dispatch {dispatch_id}: OTP already verified but status is still "
                "'arrived' — re-driving the interrupted transition to in_progress."
            )

        status_result = await UniversalDispatchEngine.update_status(
            dispatch_id=dispatch_id,
            new_status="in_progress",
            provider_id=provider_id,
        )
        if not status_result.get("success"):
            return {
                "success": False,
                "error": (
                    "Code accepted, but the visit could not be started. "
                    "Please try again — your code is still valid."
                ),
            }
        return {"success": True, "status": "in_progress"}

    # ──────────────────────────────────────────────────────────────────
    # Update Dispatch Status
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def update_status(
        dispatch_id: str,
        new_status: str,
        provider_id: str = None,
    ) -> dict:
        """
        Update dispatch status through the lifecycle.
        Valid: searching → provider_accepted → en_route → arrived →
               in_progress → completed  (or → cancelled at any point)
        """
        valid_statuses = [
            "searching", "provider_notified", "provider_accepted", "en_route",
            "arrived", "in_progress", "completed", "cancelled", "no_provider",
        ]
        if new_status not in valid_statuses:
            return {"success": False, "message": f"Invalid status: {new_status}"}

        now = datetime.now(timezone.utc).isoformat()
        update_data = {"status": new_status, "updated_at": now}

        # Add timestamps for key transitions
        timestamp_map = {
            "en_route": "en_route_at",
            "arrived": "arrived_at",
            "in_progress": "started_at",
            "completed": "completed_at",
        }
        if new_status in timestamp_map:
            update_data[timestamp_map[new_status]] = now

        dispatch_row = None

        if supabase:
            try:
                result = (
                    supabase.table("dispatch_requests")
                    .update(update_data)
                    .eq("id", dispatch_id)
                    .execute()
                )
                if result.data:
                    dispatch_row = result.data[0]
            except Exception as e:
                logger.warning(f"Supabase update_status failed: {e}")

        if dispatch_row is None:
            for d in _local_dispatches:
                if d.get("id") == dispatch_id:
                    d.update(update_data)
                    dispatch_row = d
                    break

        if dispatch_row is None:
            # Nothing was written anywhere. Reporting success here told every
            # caller — /status, /verify-otp, /magic-status — that the visit had
            # moved on while the row sat untouched, and the next transition was
            # then refused for want of its prerequisite. The provider could
            # neither start nor complete the visit, with no error to explain it.
            logger.error(
                f"update_status({dispatch_id} -> {new_status}) matched no row; "
                "nothing was updated."
            )
            return {
                "success": False,
                "message": "Dispatch not found or could not be updated.",
            }

        if new_status == "arrived":
            OTPService.generate_otp(dispatch_id)

        # Sync linked booking status across transitions
        booking_id = dispatch_row.get("booking_id") if isinstance(dispatch_row, dict) else None
        if booking_id and supabase:
            try:
                status_sync_map = {
                    "provider_accepted": "provider_accepted",
                    "en_route": "in_progress",
                    "arrived": "in_progress",
                    "in_progress": "in_progress",
                    "completed": "completed",
                    "cancelled": "cancelled",
                }
                if new_status in status_sync_map:
                    b_update = {"status": status_sync_map[new_status], "updated_at": now}
                    if provider_id:
                        b_update["provider_id"] = provider_id
                    supabase.table("bookings").update(b_update).eq("id", booking_id).execute()
            except Exception as b_err:
                logger.warning(f"Failed to sync booking status in update_status: {b_err}")

        if new_status in ("en_route", "arrived", "in_progress", "completed"):
            await UniversalDispatchEngine._notify_patient_of_status(dispatch_row, new_status)

        return {"success": True, "dispatch": dispatch_row}

    # Patient-facing labels per provider type. These strings used to be
    # hardcoded to "Phlebotomist" / "Sample collection", so a patient who had
    # booked a home nurse for wound dressing was told a phlebotomist had
    # started their sample collection.
    _PROVIDER_LABEL = {
        "phlebotomist": ("Phlebotomist", "Sample collection"),
        "nurse": ("Nurse", "Your home nursing visit"),
        "doctor": ("Doctor", "Your home visit"),
        "dietitian": ("Dietitian", "Your consultation"),
        "physiotherapist": ("Physiotherapist", "Your physiotherapy session"),
        "ambulance": ("Ambulance", "Your ambulance service"),
        "pharmacy_delivery": ("Delivery partner", "Your delivery"),
    }
    _DEFAULT_PROVIDER_LABEL = ("Provider", "Your visit")

    _STATUS_COPY = {
        "en_route": ("{role} on the way", "{provider} is on the way to your location."),
        "arrived": ("{role} has arrived", "{provider} has arrived. Have your OTP ready to verify them."),
        "in_progress": ("{visit} started", "{provider} has started {visit_lower}."),
        "completed": ("{visit} completed", "{visit} is complete. Updates will appear on your dashboard."),
    }

    @staticmethod
    def _provider_labels(provider_type: Optional[str]) -> tuple:
        return UniversalDispatchEngine._PROVIDER_LABEL.get(
            provider_type or "", UniversalDispatchEngine._DEFAULT_PROVIDER_LABEL
        )

    @staticmethod
    async def _notify_patient_of_status(dispatch_row: dict, new_status: str) -> None:
        """Best-effort in-app status notification, shown on the patient dashboard.

        Never raises — a notification failure must never block a dispatch
        status transition that has already been committed.
        """
        if not supabase:
            return
        try:
            patient_id = dispatch_row.get("patient_id")
            if not patient_id:
                return

            provider_name = "Your phlebotomist"
            provider_id = dispatch_row.get("assigned_provider_id")
            if provider_id:
                prov_res = (
                    supabase.table("users").select("full_name")
                    .eq("id", provider_id).limit(1).execute()
                )
                if prov_res.data and prov_res.data[0].get("full_name"):
                    provider_name = prov_res.data[0]["full_name"]

            role_label, visit_label = UniversalDispatchEngine._provider_labels(
                dispatch_row.get("provider_type")
            )
            title_template, body_template = UniversalDispatchEngine._STATUS_COPY.get(
                new_status, ("Booking update", "Your booking status changed to {status}.")
            )
            fields = {
                "provider": provider_name,
                "status": new_status,
                "role": role_label,
                "visit": visit_label,
                "visit_lower": visit_label[0].lower() + visit_label[1:],
            }
            title = title_template.format(**fields)

            from app.services.notification_engine import NotificationEngine
            from app.services.push import CHANNEL_DISPATCH
            # "Your phlebotomist has arrived" is worth a phone buzz, not just
            # an in-app row the patient sees whenever they next open the app.
            await NotificationEngine.send_multi(
                user_id=patient_id,
                channels=["in_app", "push"],
                title=title,
                body=body_template.format(**fields),
                data={
                    "dispatch_id": dispatch_row.get("id"),
                    "status": new_status,
                    "provider_name": provider_name,
                    "eta_minutes": int(dispatch_row.get("estimated_eta_minutes") or 0),
                    "channel_id": CHANNEL_DISPATCH,
                },
            )
        except Exception as e:
            logger.warning(
                f"Dispatch status notification failed for "
                f"{dispatch_row.get('id')}: {e}"
            )

    # ──────────────────────────────────────────────────────────────────
    # Location Updates
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def update_provider_location(
        user_id: str,
        provider_type: str,
        lat: float,
        lng: float,
        heading: float = None,
        speed_kmh: float = None,
    ) -> dict:
        """Update a field provider's live GPS location."""
        now = datetime.now(timezone.utc).isoformat()

        if not supabase:
            return {"success": True, "lat": lat, "lng": lng}

        # Upsert into provider_locations
        location_data = {
            "user_id": user_id,
            "provider_type": provider_type,
            "is_online": True,
            "current_lat": lat,
            "current_lng": lng,
            "last_updated": now,
        }
        if heading is not None:
            location_data["heading"] = heading
        if speed_kmh is not None:
            location_data["speed_kmh"] = speed_kmh

        try:
            # Try update first
            result = (
                supabase.table("provider_locations")
                .update(location_data)
                .eq("user_id", user_id)
                .execute()
            )
            if not result.data:
                # Insert if no existing record
                location_data["id"] = str(uuid.uuid4())
                supabase.table("provider_locations").insert(location_data).execute()
        except Exception as e:
            logger.warning(f"Location update failed: {e}")

        return {"success": True, "lat": lat, "lng": lng}

    # ──────────────────────────────────────────────────────────────────
    # Toggle Online Status
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    def _ensure_processing_centre(user_id: str) -> None:
        """Attach a phlebotomist to the centre serving their district. Never raises.

        Home collection is centre-bound in both directions: a collector may
        only be offered work for their own centre, and may only hand tubes in
        there. `phlebotomists.processing_center_id` is set by an admin — and
        for anyone the admin has not got to yet it stays NULL, which means no
        offers and no handover destination, silently. Resolve it from their
        registered district the first time they come on duty; an existing
        binding is never overwritten, so an admin's posting always wins.
        """
        try:
            rows = (
                supabase.table("phlebotomists")
                .select("processing_center_id")
                .eq("user_id", user_id).limit(1).execute()
            ).data or []
            if not rows or rows[0].get("processing_center_id"):
                return

            user_rows = (
                supabase.table("users").select("city, district, pincode")
                .eq("id", user_id).limit(1).execute()
            ).data or []
            if not user_rows:
                return
            u = user_rows[0]

            from app.services.processing_center import resolve_center
            centre = resolve_center(
                city=u.get("city") or None,
                district=u.get("district") or None,
                pincode=u.get("pincode") or None,
            )
            if not centre or not centre.get("id"):
                logger.warning(
                    f"Phlebotomist {user_id} came on duty with no processing "
                    f"centre and none serves district "
                    f"{(u.get('district') or u.get('city') or '')!r}."
                )
                return

            supabase.table("phlebotomists").update(
                {"processing_center_id": centre["id"]}
            ).eq("user_id", user_id).execute()
            logger.info(
                f"Bound phlebotomist {user_id} to processing centre "
                f"{centre.get('code') or centre['id']} from their district."
            )
        except Exception as e:
            logger.warning(f"Processing-centre binding failed for {user_id}: {e}")

    @staticmethod
    def _ensure_base_location(
        user_id: str,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
    ) -> None:
        """Give a phlebotomist a base location if they have none. Never raises.

        Order of preference: the live fix they just supplied, then their
        registered address geocoded once, then the coordinates of the
        processing centre they are attached to. Written once and left alone —
        a collector who moves house is re-based by ops, not by a stray ping.
        """
        try:
            rows = (
                supabase.table("phlebotomists")
                .select(
                    "base_lat, base_lng, current_lat, current_lng, "
                    "processing_center_id"
                )
                .eq("user_id", user_id).limit(1).execute()
            ).data or []
            if not rows:
                return
            row = rows[0]
            if row.get("base_lat") is not None and row.get("base_lng") is not None:
                return

            base_lat, base_lng = lat, lng

            # Their own last known fix, before reaching for a geocoder. A
            # collector who has been on duty already has one, and it is a more
            # accurate base than anything an address lookup returns.
            if base_lat is None or base_lng is None:
                base_lat = row.get("current_lat")
                base_lng = row.get("current_lng")

            if base_lat is None or base_lng is None:
                user_rows = (
                    supabase.table("users")
                    .select("address, city, district, state, pincode")
                    .eq("id", user_id).limit(1).execute()
                ).data or []
                if user_rows:
                    u = user_rows[0]
                    address = ", ".join(
                        str(part) for part in
                        (u.get("address"), u.get("pincode"), u.get("district"))
                        if part
                    )
                    if address or u.get("city"):
                        from app.services.geocoding import geocode_address, GeocodingError
                        try:
                            base_lat, base_lng = geocode_address(
                                address=address,
                                city=u.get("city") or "",
                                state=u.get("state") or "",
                            )
                        except GeocodingError as e:
                            logger.info(
                                f"Base location geocode failed for phlebotomist "
                                f"{user_id}: {e}"
                            )

            if (base_lat is None or base_lng is None) and row.get("processing_center_id"):
                centre = (
                    supabase.table("processing_centers")
                    .select("lat, lng, city, address, pincode")
                    .eq("id", row["processing_center_id"]).limit(1).execute()
                ).data or []
                if centre and centre[0].get("lat") is not None:
                    base_lat, base_lng = centre[0]["lat"], centre[0]["lng"]
                elif centre:
                    # The centre's own lat/lng column has never been populated
                    # in production, so this last resort always failed and the
                    # collector stayed location-unknown. Geocode the centre
                    # once from its address instead of giving up.
                    from app.services.geocoding import geocode_address, GeocodingError
                    try:
                        base_lat, base_lng = geocode_address(
                            address=(centre[0].get("address") or ""),
                            city=(centre[0].get("city") or ""),
                        )
                        supabase.table("processing_centers").update(
                            {"lat": float(base_lat), "lng": float(base_lng)}
                        ).eq("id", row["processing_center_id"]).execute()
                    except GeocodingError as e:
                        logger.info(
                            f"Processing centre {row['processing_center_id']} "
                            f"could not be geocoded: {e}"
                        )

            if base_lat is None or base_lng is None:
                logger.warning(
                    f"Phlebotomist {user_id} went on duty with no resolvable base "
                    f"location; they are reachable only once live GPS lands."
                )
                return

            supabase.table("phlebotomists").update({
                "base_lat": float(base_lat), "base_lng": float(base_lng),
            }).eq("user_id", user_id).execute()
            logger.info(
                f"Backfilled base location ({base_lat}, {base_lng}) for "
                f"phlebotomist {user_id}"
            )
        except Exception as e:
            logger.warning(f"Base location backfill failed for {user_id}: {e}")

    @staticmethod
    async def toggle_online(
        user_id: str,
        provider_type: str,
        is_online: bool,
        lat: float = None,
        lng: float = None,
    ) -> dict:
        """Toggle a provider's online/offline status."""
        now = datetime.now(timezone.utc).isoformat()

        if not supabase:
            return {"success": True, "is_online": is_online}

        # A phlebotomist's base location is what dispatch and the advance
        # roster fall back to when there is no live GPS fix — but nothing in
        # signup or centre assignment ever wrote it, so both treated every
        # collector as location-unknown. Resolve it once, here, the first time
        # they come on duty.
        if is_online and provider_type == "phlebotomist":
            # A collector with no centre can be offered nothing (dispatch is
            # centre-bound) and can hand their tubes in nowhere. Nothing in
            # signup ever set it, so it depended entirely on an admin noticing.
            # Bind them to the centre that serves their own district.
            await asyncio.to_thread(
                UniversalDispatchEngine._ensure_processing_centre, user_id
            )
            await asyncio.to_thread(
                UniversalDispatchEngine._ensure_base_location, user_id, lat, lng
            )

        location_data = {
            "user_id": user_id,
            "provider_type": provider_type,
            "is_online": is_online,
            "last_updated": now,
        }
        if lat is not None:
            location_data["current_lat"] = lat
        if lng is not None:
            location_data["current_lng"] = lng

        try:
            result = (
                supabase.table("provider_locations")
                .update({"is_online": is_online, "last_updated": now})
                .eq("user_id", user_id)
                .execute()
            )
            if not result.data:
                location_data["id"] = str(uuid.uuid4())
                supabase.table("provider_locations").insert(location_data).execute()
        except Exception:
            pass

        # Also update legacy table if applicable
        legacy_updates = {
            "phlebotomist": ("phlebotomists", "on_duty"),
            "nurse": ("nurses", "is_online"),
        }
        if provider_type in legacy_updates:
            table, field = legacy_updates[provider_type]
            try:
                supabase.table(table).update({field: is_online}).eq("user_id", user_id).execute()
            except Exception:
                pass

        return {
            "success": True,
            "is_online": is_online,
            "message": f"Status: {'Online' if is_online else 'Offline'}",
        }

    # ──────────────────────────────────────────────────────────────────
    # Live Tracking
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def get_live_tracking(dispatch_id: str) -> dict:
        """Get live tracking data for a dispatch (patient-facing)."""
        dispatch = None
        if supabase:
            try:
                result = (
                    supabase.table("dispatch_requests")
                    .select("*")
                    .eq("id", dispatch_id)
                    .execute()
                )
                if result.data:
                    dispatch = result.data[0]
            except Exception as e:
                logger.warning(f"Supabase fetch live tracking failed: {e}")

        if not dispatch:
            dispatch = next((d for d in _local_dispatches if d.get("id") == dispatch_id), None)

        if not dispatch:
            return {"dispatch_id": dispatch_id, "status": "not_found"}

        provider_location = None

        if dispatch.get("assigned_provider_id") and supabase:
            loc_result = (
                supabase.table("provider_locations")
                .select("*, users!inner(full_name, mobile)")
                .eq("user_id", dispatch["assigned_provider_id"])
                .execute()
            )
            if loc_result.data:
                loc = loc_result.data[0]
                user_data = loc.get("users", {})
                provider_location = {
                    "name": user_data.get("full_name"),
                    "mobile": user_data.get("mobile"),
                    "lat": loc.get("current_lat"),
                    "lng": loc.get("current_lng"),
                    "heading": loc.get("heading"),
                    "speed_kmh": loc.get("speed_kmh"),
                    "last_updated": loc.get("last_updated"),
                }

                # Calculate live distance and ETA
                if (
                    provider_location["lat"] and provider_location["lng"]
                    and dispatch.get("patient_lat") and dispatch.get("patient_lng")
                ):
                    dist = UniversalDispatchEngine.haversine_km(
                        float(dispatch["patient_lat"]),
                        float(dispatch["patient_lng"]),
                        float(provider_location["lat"]),
                        float(provider_location["lng"]),
                    )
                    provider_location["distance_km"] = round(dist, 2)
                    provider_location["eta_minutes"] = UniversalDispatchEngine.estimate_eta_minutes(
                        dist, dispatch.get("provider_type", "nurse")
                    )

        # While nobody has accepted yet, the patient stares at a spinner with
        # no idea whether anyone was even asked. These are the collectors who
        # actually hold a live offer for THIS job — not a fresh proximity
        # sweep — so the count and the distances are the real ones. Identity
        # is deliberately reduced to a first name: they have not accepted, and
        # a patient must not be handed the contact details of someone who may
        # decline.
        searching_candidates = []
        if dispatch["status"] in ("searching", "provider_notified") and supabase:
            try:
                offers = (
                    supabase.table("dispatch_offers")
                    .select("provider_id, distance_km, status, expires_at")
                    .eq("dispatch_request_id", dispatch_id)
                    .eq("status", "pending")
                    .execute()
                ).data or []
                names = {}
                provider_ids = [o["provider_id"] for o in offers if o.get("provider_id")]
                if provider_ids:
                    rows = (
                        supabase.table("users").select("id, full_name")
                        .in_("id", provider_ids).execute()
                    ).data or []
                    names = {r["id"]: (r.get("full_name") or "") for r in rows}
                from app.services import ratings as _ratings
                summaries = _ratings.get_summaries(provider_ids, db=supabase)
                for o in offers:
                    pid = o.get("provider_id")
                    full_name = names.get(pid, "")
                    summary = summaries.get(pid or "") or {}
                    searching_candidates.append({
                        "first_name": (full_name.split(" ")[0] if full_name else "Collector"),
                        "distance_km": o.get("distance_km"),
                        "eta_minutes": (
                            UniversalDispatchEngine.estimate_eta_minutes(
                                float(o["distance_km"]),
                                dispatch.get("provider_type", "phlebotomist"),
                            ) if o.get("distance_km") is not None else None
                        ),
                        "rating": summary.get("average_stars"),
                        "rating_count": summary.get("rating_count", 0),
                        "expires_at": o.get("expires_at"),
                    })
                searching_candidates.sort(
                    key=lambda c: (c["distance_km"] is None, c["distance_km"] or 0)
                )
            except Exception as e:
                logger.warning(f"Could not load searching candidates for {dispatch_id}: {e}")

        return {
            "dispatch_id": dispatch_id,
            "booking_id": dispatch.get("booking_id"),
            "provider_type": dispatch.get("provider_type"),
            "service_subtype": dispatch.get("service_subtype"),
            "status": dispatch["status"],
            "provider": provider_location,
            "searching_candidates": searching_candidates,
            "searching_count": len(searching_candidates),
            "patient_address": dispatch.get("patient_address"),
            "created_at": dispatch.get("created_at"),
            "assigned_at": dispatch.get("assigned_at"),
            "en_route_at": dispatch.get("en_route_at"),
            "arrived_at": dispatch.get("arrived_at"),
            "started_at": dispatch.get("started_at"),
            "completed_at": dispatch.get("completed_at"),
        }
