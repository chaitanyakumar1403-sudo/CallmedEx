"""
Phlebotomist Dispatch Engine — Phase 2
Uber/Swiggy-style real-time dispatch for home sample collection.
Per claude.md Section 8: matching, GPS tracking, duty toggling, status flow.

Status flow: requested → assigned → en_route → sample_collected → delivered_to_lab → completed
"""
import uuid
import math
from datetime import datetime, timezone
from typing import Optional
from app.database import supabase


class DispatchService:
    """
    Real-time dispatch engine for phlebotomist matching and tracking.
    Uses haversine formula for distance calculation (PostGIS upgrade path
    available for production scale — see schema.sql line 9).
    """

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
    async def find_nearest_phlebotomists(
        patient_lat: float,
        patient_lng: float,
        radius_km: float = 10.0,
        limit: int = 5,
    ) -> list:
        """
        Find on-duty phlebotomists within radius, ranked by distance.
        Per claude.md Section 8: distance → current load → rating.
        """
        if not supabase:
            return []

        # Get all on-duty phlebotomists with GPS coordinates
        result = (
            supabase.table("phlebotomists")
            .select("*, users!inner(full_name, mobile, email)")
            .eq("on_duty", True)
            .eq("verification_status", "verified")
            .not_.is_("current_lat", "null")
            .not_.is_("current_lng", "null")
            .execute()
        )

        if not result.data:
            return []

        # Calculate distances and filter by radius
        candidates = []
        for phleb in result.data:
            dist = DispatchService.haversine_km(
                patient_lat, patient_lng,
                float(phleb["current_lat"]),
                float(phleb["current_lng"]),
            )
            if dist <= radius_km:
                candidates.append({
                    "phlebotomist_id": phleb["id"],
                    "user_id": phleb["user_id"],
                    "name": phleb.get("users", {}).get("full_name", "Unknown"),
                    "mobile": phleb.get("users", {}).get("mobile", ""),
                    "distance_km": round(dist, 2),
                    "qualification": phleb.get("qualification", ""),
                    "lat": phleb["current_lat"],
                    "lng": phleb["current_lng"],
                })

        # Sort by distance (closest first)
        candidates.sort(key=lambda x: x["distance_km"])
        return candidates[:limit]

    @staticmethod
    async def create_dispatch(
        patient_id: str,
        patient_lat: float,
        patient_lng: float,
        patient_address: str,
        service_type: str = "home_collection",
        notes: str = "",
        booking_id: Optional[str] = None,
    ) -> dict:
        """
        Create a dispatch request and auto-assign nearest phlebotomist.
        """
        dispatch_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # Find nearest available phlebotomist
        candidates = await DispatchService.find_nearest_phlebotomists(
            patient_lat, patient_lng
        )

        assigned_phleb = None
        status = "requested"

        if candidates:
            assigned_phleb = candidates[0]
            status = "assigned"

        dispatch_data = {
            "id": dispatch_id,
            "patient_id": patient_id,
            "booking_id": booking_id,
            "phlebotomist_id": assigned_phleb["phlebotomist_id"] if assigned_phleb else None,
            "service_type": service_type,
            "status": status,
            "patient_lat": patient_lat,
            "patient_lng": patient_lng,
            "patient_address": patient_address,
            "notes": notes,
            "assigned_at": now if assigned_phleb else None,
            "estimated_distance_km": assigned_phleb["distance_km"] if assigned_phleb else None,
            "created_at": now,
            "updated_at": now,
        }

        if supabase:
            supabase.table("dispatches").insert(dispatch_data).execute()

        return {
            "dispatch_id": dispatch_id,
            "status": status,
            "assigned_phlebotomist": assigned_phleb,
            "estimated_distance_km": assigned_phleb["distance_km"] if assigned_phleb else None,
            "message": (
                f"Phlebotomist {assigned_phleb['name']} assigned ({assigned_phleb['distance_km']} km away)"
                if assigned_phleb
                else "No phlebotomists available nearby. Your request has been queued."
            ),
        }

    @staticmethod
    async def update_dispatch_status(
        dispatch_id: str,
        new_status: str,
        phlebotomist_id: Optional[str] = None,
    ) -> dict:
        """
        Update dispatch status through the lifecycle.
        Valid transitions: requested → assigned → en_route → sample_collected
                          → delivered_to_lab → completed
        """
        valid_statuses = [
            "requested", "assigned", "en_route",
            "sample_collected", "delivered_to_lab", "completed", "cancelled",
        ]
        if new_status not in valid_statuses:
            return {"success": False, "message": f"Invalid status: {new_status}"}

        now = datetime.now(timezone.utc).isoformat()
        update_data = {"status": new_status, "updated_at": now}

        # Add timestamps for key transitions
        if new_status == "en_route":
            update_data["en_route_at"] = now
        elif new_status == "sample_collected":
            update_data["collected_at"] = now
        elif new_status == "delivered_to_lab":
            update_data["delivered_at"] = now
        elif new_status == "completed":
            update_data["completed_at"] = now

        if supabase:
            result = (
                supabase.table("dispatches")
                .update(update_data)
                .eq("id", dispatch_id)
                .execute()
            )
            if not result.data:
                return {"success": False, "message": "Dispatch not found"}
            return {"success": True, "dispatch": result.data[0]}

        return {"success": True, "message": f"Status updated to {new_status}"}

    @staticmethod
    async def toggle_duty(user_id: str, on_duty: bool, lat: Optional[float] = None, lng: Optional[float] = None) -> dict:
        """Toggle phlebotomist duty status and update GPS."""
        if not supabase:
            return {"success": True, "on_duty": on_duty}

        update_data = {"on_duty": on_duty}
        if lat is not None:
            update_data["current_lat"] = lat
        if lng is not None:
            update_data["current_lng"] = lng

        result = (
            supabase.table("phlebotomists")
            .update(update_data)
            .eq("user_id", user_id)
            .execute()
        )

        return {
            "success": bool(result.data),
            "on_duty": on_duty,
            "message": f"Status: {'On Duty' if on_duty else 'Off Duty'}",
        }

    @staticmethod
    async def update_location(user_id: str, lat: float, lng: float) -> dict:
        """Update phlebotomist's live GPS location (called every 10-15s while on duty)."""
        if not supabase:
            return {"success": True}

        supabase.table("phlebotomists").update({
            "current_lat": lat,
            "current_lng": lng,
        }).eq("user_id", user_id).execute()

        return {"success": True, "lat": lat, "lng": lng}

    @staticmethod
    async def get_dispatch_tracking(dispatch_id: str) -> dict:
        """Get live tracking data for a dispatch (patient-facing)."""
        if not supabase:
            return {"dispatch_id": dispatch_id, "status": "unknown"}

        result = (
            supabase.table("dispatches")
            .select("*")
            .eq("id", dispatch_id)
            .execute()
        )

        if not result.data:
            return {"dispatch_id": dispatch_id, "status": "not_found"}

        dispatch = result.data[0]
        phleb_location = None

        if dispatch.get("phlebotomist_id"):
            phleb_result = (
                supabase.table("phlebotomists")
                .select("current_lat, current_lng, users!inner(full_name, mobile)")
                .eq("id", dispatch["phlebotomist_id"])
                .execute()
            )
            if phleb_result.data:
                p = phleb_result.data[0]
                phleb_location = {
                    "name": p.get("users", {}).get("full_name"),
                    "mobile": p.get("users", {}).get("mobile"),
                    "lat": p.get("current_lat"),
                    "lng": p.get("current_lng"),
                }

                # Calculate live distance if both locations are available
                if (
                    phleb_location["lat"] and phleb_location["lng"]
                    and dispatch.get("patient_lat") and dispatch.get("patient_lng")
                ):
                    dist = DispatchService.haversine_km(
                        float(dispatch["patient_lat"]),
                        float(dispatch["patient_lng"]),
                        float(phleb_location["lat"]),
                        float(phleb_location["lng"]),
                    )
                    phleb_location["distance_km"] = round(dist, 2)
                    # Rough ETA: ~20 km/h average city speed
                    phleb_location["eta_minutes"] = round((dist / 20) * 60)

        return {
            "dispatch_id": dispatch_id,
            "status": dispatch["status"],
            "phlebotomist": phleb_location,
            "patient_address": dispatch.get("patient_address"),
            "created_at": dispatch.get("created_at"),
            "assigned_at": dispatch.get("assigned_at"),
            "en_route_at": dispatch.get("en_route_at"),
            "collected_at": dispatch.get("collected_at"),
        }
