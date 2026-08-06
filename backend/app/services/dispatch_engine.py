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

# Urgent work is sped up by casting a WIDER net, not by shortening the accept
# window. Cutting a provider's deadline below the agreed 10 minutes would
# breach the signed MOU; notifying more providers over a larger radius gets the
# patient seen sooner without changing anyone's terms.
URGENT_RADIUS_MULTIPLIER = 2.0
URGENT_MAX_OFFERS = 12
NORMAL_MAX_OFFERS = 5

_local_dispatches: List[dict] = []
_LOCAL_DISPATCH_MAX_AGE_HOURS = 24  # Clean up dispatches older than 24 hours


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
        radius_km: float = 10.0,
        limit: Optional[int] = 5,
        exclude_ids: List[str] = None,
        processing_center_id: Optional[str] = None,
        ignore_radius: bool = False,
    ) -> list:
        """
        Find online providers of the specified type within radius.
        Ranked by: distance → (future: rating → acceptance_rate → load).

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
            seen = {p.get("user_id") or p.get("users", {}).get("id") for p in providers}
            for p in result_b:
                uid = p.get("user_id") or p.get("users", {}).get("id")
                if uid and uid not in seen:
                    providers.append(p)
                    seen.add(uid)
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

        # Calculate distances and filter
        candidates = []
        for p in providers:
            user_id = p.get("user_id") or p.get("users", {}).get("id", "")
            if user_id in exclude_ids:
                continue

            if centre_members is not None and user_id not in centre_members:
                continue

            p_lat = p.get("current_lat")
            p_lng = p.get("current_lng")
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
                    "provider_type": provider_type,
                })

        # Sort by distance (closest first)
        candidates.sort(key=lambda x: x["distance_km"])
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
                result = (
                    supabase.table(table)
                    .select("*, users!phlebotomists_user_id_fkey!inner(id, full_name, mobile, email)")
                    .eq("on_duty", True)
                    .eq("verification_status", "verified")
                    .not_.is_("current_lat", "null")
                    .not_.is_("current_lng", "null")
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
        search_radius_km: float = 10.0,
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
        home_collection = provider_type == "phlebotomist" and processing_center_id
        urgent_home_collection = bool(urgent and home_collection)
        ignore_radius = bool(home_collection)
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

            except Exception as e:
                logger.error(f"Failed to create dispatch: {e}")

        return {
            "dispatch_id": dispatch_id,
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
                    await NotificationEngine.send(
                        user_id=d_req["patient_id"],
                        channel="in_app",
                        title="Phlebotomist assigned",
                        body=f"{provider_name} has been assigned to your booking and is preparing to head your way.",
                        data={"dispatch_id": dispatch_id, "status": "assigned", "provider_name": provider_name},
                    )
            except Exception as e:
                logger.error(f"Failed to send tracking email/notification: {e}")

            return {"success": True, "message": "Offer accepted. Navigate to patient.", "dispatch_id": dispatch_id}
        else:
            # Reject this offer
            supabase.table("dispatch_offers").update({
                "status": "rejected",
                "responded_at": now,
            }).eq("id", offer_id).execute()

            return {"success": True, "message": "Offer rejected."}

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
            return {"success": True, "message": f"Status updated to {new_status}"}

        if new_status == "arrived":
            OTPService.generate_otp(dispatch_id)

        if new_status in ("en_route", "arrived", "in_progress", "completed"):
            await UniversalDispatchEngine._notify_patient_of_status(dispatch_row, new_status)

        return {"success": True, "dispatch": dispatch_row}

    _STATUS_COPY = {
        "en_route": ("Phlebotomist on the way", "{provider} is on the way to your location."),
        "arrived": ("Phlebotomist has arrived", "{provider} has arrived. Have your OTP ready to verify them."),
        "in_progress": ("Sample collection started", "{provider} has started your sample collection."),
        "completed": ("Sample collection completed", "Your sample collection is complete. Reports will appear on your dashboard once ready."),
    }

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

            title, body_template = UniversalDispatchEngine._STATUS_COPY.get(
                new_status, ("Booking update", "Your booking status changed to {status}.")
            )

            from app.services.notification_engine import NotificationEngine
            await NotificationEngine.send(
                user_id=patient_id,
                channel="in_app",
                title=title,
                body=body_template.format(provider=provider_name, status=new_status),
                data={
                    "dispatch_id": dispatch_row.get("id"),
                    "status": new_status,
                    "provider_name": provider_name,
                    "eta_minutes": int(dispatch_row.get("estimated_eta_minutes") or 0),
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

        return {
            "dispatch_id": dispatch_id,
            "booking_id": dispatch.get("booking_id"),
            "provider_type": dispatch.get("provider_type"),
            "service_subtype": dispatch.get("service_subtype"),
            "status": dispatch["status"],
            "provider": provider_location,
            "patient_address": dispatch.get("patient_address"),
            "created_at": dispatch.get("created_at"),
            "assigned_at": dispatch.get("assigned_at"),
            "en_route_at": dispatch.get("en_route_at"),
            "arrived_at": dispatch.get("arrived_at"),
            "started_at": dispatch.get("started_at"),
            "completed_at": dispatch.get("completed_at"),
        }
