"""
Universal Dispatch Engine — Next-Gen CallMedex
Uber/Swiggy-style real-time dispatch for ALL field providers:
  nurses, phlebotomists, home-visit doctors, ambulances, pharmacy delivery.

Uses the universal provider_locations + dispatch_requests + dispatch_offers tables.
Supports: provider matching, offer rotation, live tracking, and ETA calculation.
"""
import uuid
import math
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from app.database import supabase
import logging
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

OFFER_EXPIRY_SECONDS = 30  # Each provider has 30 seconds to accept
MAX_SEARCH_ROUNDS = 3      # Number of rounds to search for providers


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
        limit: int = 5,
        exclude_ids: List[str] = None,
    ) -> list:
        """
        Find online providers of the specified type within radius.
        Ranked by: distance → (future: rating → acceptance_rate → load).
        
        Uses provider_locations table for a unified provider location store.
        Falls back to legacy role-specific tables if provider_locations is empty.
        """
        if provider_type not in VALID_PROVIDER_TYPES:
            logger.warning(f"Invalid provider type: {provider_type}")
            return []

        if not supabase:
            return []

        exclude_ids = exclude_ids or []

        # Try universal provider_locations table first
        try:
            query = (
                supabase.table("provider_locations")
                .select("*, users!inner(id, full_name, mobile, email)")
                .eq("provider_type", provider_type)
                .eq("is_online", True)
                .not_.is_("current_lat", "null")
                .not_.is_("current_lng", "null")
            )
            result = query.execute()
            providers = result.data or []
        except Exception:
            providers = []

        # Fallback to legacy tables if provider_locations is empty
        if not providers:
            providers = await UniversalDispatchEngine._fallback_find(
                provider_type, patient_lat, patient_lng
            )

        # Calculate distances and filter
        candidates = []
        for p in providers:
            user_id = p.get("user_id") or p.get("users", {}).get("id", "")
            if user_id in exclude_ids:
                continue

            p_lat = p.get("current_lat")
            p_lng = p.get("current_lng")
            if p_lat is None or p_lng is None:
                continue

            dist = UniversalDispatchEngine.haversine_km(
                patient_lat, patient_lng, float(p_lat), float(p_lng)
            )
            if dist <= radius_km:
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
                    .select("*, users!inner(id, full_name, mobile, email)")
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
    ) -> dict:
        """
        Create a universal dispatch request and attempt auto-assignment.
        1. Find nearest providers
        2. Create dispatch_offers for top candidates
        3. Auto-assign closest if available, or queue for acceptance
        """
        dispatch_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # Find candidates
        candidates = await UniversalDispatchEngine.find_nearby_providers(
            patient_lat, patient_lng, provider_type, radius_km=search_radius_km
        )

        assigned_provider = None
        status = "searching"

        # We no longer auto-assign the closest provider.
        # Instead, we send magic emails to all candidates and let them accept.

        dispatch_data = {
            "id": dispatch_id,
            "patient_id": patient_id,
            "booking_id": booking_id,
            "provider_type": provider_type,
            "service_subtype": service_subtype,
            "status": status,
            "patient_lat": patient_lat,
            "patient_lng": patient_lng,
            "patient_address": patient_address,
            "patient_address_details": address_details or {},
            "assigned_provider_id": assigned_provider["user_id"] if assigned_provider else None,
            "search_radius_km": search_radius_km,
            "notes": notes,
            "estimated_distance_km": assigned_provider["distance_km"] if assigned_provider else None,
            "estimated_eta_minutes": assigned_provider["eta_minutes"] if assigned_provider else None,
            "assigned_at": now if assigned_provider else None,
            "created_at": now,
            "updated_at": now,
        }

        if supabase:
            try:
                supabase.table("dispatch_requests").insert(dispatch_data).execute()

                # Create dispatch offers for all candidates
                for i, candidate in enumerate(candidates):
                    offer = {
                        "id": str(uuid.uuid4()),
                        "dispatch_request_id": dispatch_id,
                        "provider_id": candidate["user_id"],
                        "status": "pending",
                        "distance_km": candidate["distance_km"],
                        "offered_at": now,
                        "responded_at": None,
                        "expires_at": (
                            datetime.now(timezone.utc) + timedelta(seconds=OFFER_EXPIRY_SECONDS)
                        ).isoformat(),
                    }
                    supabase.table("dispatch_offers").insert(offer).execute()

                    # Send Magic Email Alert
                    provider_email = candidate.get("email")
                    if provider_email:
                        EmailService.send_magic_dispatch_email(
                            to_email=provider_email,
                            provider_name=candidate.get("name"),
                            task_details={
                                "service_subtype": service_subtype,
                                "patient_address": patient_address,
                                "distance_km": candidate["distance_km"],
                                "notes": notes
                            },
                            offer_id=offer["id"],
                            provider_id=candidate["user_id"]
                        )

            except Exception as e:
                logger.error(f"Failed to create dispatch: {e}")

        return {
            "dispatch_id": dispatch_id,
            "status": status,
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

        if accepted:
            # Accept this offer
            supabase.table("dispatch_offers").update({
                "status": "accepted",
                "responded_at": now,
            }).eq("id", offer_id).execute()

            # Update the dispatch request
            supabase.table("dispatch_requests").update({
                "status": "provider_accepted",
                "assigned_provider_id": provider_id,
                "assigned_at": now,
                "estimated_distance_km": offer.get("distance_km"),
                "updated_at": now,
            }).eq("id", dispatch_id).execute()

            # Expire all other pending offers for this dispatch
            supabase.table("dispatch_offers").update({
                "status": "expired",
            }).eq("dispatch_request_id", dispatch_id).neq("id", offer_id).eq("status", "pending").execute()

            # Send tracking email to patient
            try:
                # Fetch provider name
                provider_name = "Provider"
                prov_res = supabase.table("users").select("full_name").eq("id", provider_id).execute()
                if prov_res.data:
                    provider_name = prov_res.data[0]["full_name"]
                
                # Fetch patient info and dispatch data
                dispatch_res = supabase.table("dispatch_requests").select("patient_id, provider_type").eq("id", dispatch_id).execute()
                if dispatch_res.data:
                    d_req = dispatch_res.data[0]
                    patient_res = supabase.table("users").select("full_name, email").eq("id", d_req["patient_id"]).execute()
                    if patient_res.data:
                        patient_email = patient_res.data[0].get("email")
                        if patient_email:
                            tracking_url = f"{settings.FRONTEND_URL}/tracking/{dispatch_id}"
                            from app.services.email import EmailService
                            EmailService.send_tracking_link_email(
                                to_email=patient_email,
                                patient_name=patient_res.data[0].get("full_name", "Patient"),
                                tracking_url=tracking_url,
                                provider_name=provider_name,
                                provider_type=d_req["provider_type"]
                            )
            except Exception as e:
                logger.error(f"Failed to send tracking email: {e}")

            return {"success": True, "message": "Offer accepted. Navigate to patient."}
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

        if not supabase:
            return {"success": True, "message": f"Status updated to {new_status}"}

        result = (
            supabase.table("dispatch_requests")
            .update(update_data)
            .eq("id", dispatch_id)
            .execute()
        )
        if not result.data:
            return {"success": False, "message": "Dispatch not found"}

        # Generate OTP if arrived
        if new_status == "arrived":
            OTPService.generate_otp(dispatch_id)

        return {"success": True, "dispatch": result.data[0]}

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
        if not supabase:
            return {"dispatch_id": dispatch_id, "status": "unknown"}

        result = (
            supabase.table("dispatch_requests")
            .select("*")
            .eq("id", dispatch_id)
            .execute()
        )
        if not result.data:
            return {"dispatch_id": dispatch_id, "status": "not_found"}

        dispatch = result.data[0]
        provider_location = None

        if dispatch.get("assigned_provider_id"):
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
