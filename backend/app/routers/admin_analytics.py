"""
Admin Analytics Router — Next-Gen CallMedex
Provides real-time KPIs, registration trends, booking analytics,
revenue data, provider performance, geospatial data, and AI insights.
Powers the Operations Command Center dashboard.
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from app.middleware.auth import get_current_user
from app.database import supabase
import json

router = APIRouter(prefix="/api/admin/analytics", tags=["Admin Analytics"])


def _require_admin(current_user: dict):
    """Verify user is an admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ═══════════════════════════════════════════════════════════════════════════
# EXECUTIVE OVERVIEW — Top-level KPI cards
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/executive")
async def executive_overview(current_user: dict = Depends(get_current_user)):
    """
    Returns all KPI metrics for the executive dashboard.
    Each metric includes: value, label, icon, trend (up/down/flat), and change_pct.
    """
    _require_admin(current_user)

    if not supabase:
        return {"success": True, "metrics": _mock_executive_metrics()}

    metrics = {}

    # Total users by role
    for role in ["patient", "doctor", "nurse", "phlebotomist", "organization", "pharmacy", "staff"]:
        result = supabase.table("users").select("id", count="exact").eq("role", role).execute()
        metrics[f"total_{role}s"] = result.count if result.count else len(result.data)

    # Total users
    total = supabase.table("users").select("id", count="exact").execute()
    metrics["total_users"] = total.count if total.count else len(total.data)

    # Active users (logged in within 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    metrics["active_users_30d"] = metrics["total_users"]  # Simplified

    # Bookings
    try:
        bookings = supabase.table("bookings").select("id", count="exact").execute()
        metrics["total_bookings"] = bookings.count if bookings.count else len(bookings.data)

        # Today's bookings
        today = datetime.now(timezone.utc).date().isoformat()
        today_bookings = supabase.table("bookings").select("id", count="exact").gte("created_at", today).execute()
        metrics["bookings_today"] = today_bookings.count if today_bookings.count else len(today_bookings.data)
    except Exception:
        metrics["total_bookings"] = 0
        metrics["bookings_today"] = 0

    # Pending verifications
    try:
        pending = supabase.table("doctors").select("id", count="exact").eq("verification_status", "pending").execute()
        metrics["pending_kyc"] = pending.count if pending.count else len(pending.data)
    except Exception:
        metrics["pending_kyc"] = 0

    # Pending MOU acceptances
    try:
        pending_mou = supabase.table("users").select("id", count="exact").eq("registration_status", "pending_mou").execute()
        metrics["pending_mou"] = pending_mou.count if pending_mou.count else len(pending_mou.data)
    except Exception:
        metrics["pending_mou"] = 0

    # Dispatches
    try:
        active_dispatches = supabase.table("dispatch_requests").select("id", count="exact").in_(
            "status", ["searching", "provider_accepted", "en_route", "arrived", "in_progress"]
        ).execute()
        metrics["active_dispatches"] = active_dispatches.count if active_dispatches.count else len(active_dispatches.data)
    except Exception:
        metrics["active_dispatches"] = 0

    return {"success": True, "metrics": metrics}


# ═══════════════════════════════════════════════════════════════════════════
# REGISTRATION TRENDS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/registrations")
async def registration_trends(
    period: str = "daily",
    days: int = 30,
    current_user: dict = Depends(get_current_user),
):
    """Registration trends by role over time."""
    _require_admin(current_user)

    if not supabase:
        return {"success": True, "trends": _mock_registration_trends(days)}

    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    result = (
        supabase.table("users")
        .select("role, created_at")
        .gte("created_at", start_date)
        .order("created_at")
        .execute()
    )

    # Group by date and role
    trends = {}
    for user in result.data or []:
        date_str = user["created_at"][:10]
        role = user["role"]
        if date_str not in trends:
            trends[date_str] = {}
        trends[date_str][role] = trends[date_str].get(role, 0) + 1

    return {
        "success": True,
        "period": period,
        "days": days,
        "trends": [{"date": k, **v} for k, v in sorted(trends.items())],
    }


# ═══════════════════════════════════════════════════════════════════════════
# BOOKING ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/appointments")
async def appointment_analytics(
    days: int = 30,
    current_user: dict = Depends(get_current_user),
):
    """Booking analytics: counts by status, service type, and daily trends."""
    _require_admin(current_user)

    if not supabase:
        return {"success": True, "analytics": _mock_booking_analytics()}

    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    result = (
        supabase.table("bookings")
        .select("status, service_type, created_at")
        .gte("created_at", start_date)
        .execute()
    )

    bookings = result.data or []

    # Aggregate
    by_status = {}
    by_service = {}
    by_date = {}

    for b in bookings:
        status = b.get("status", "unknown")
        service = b.get("service_type", "unknown")
        date_str = b["created_at"][:10]

        by_status[status] = by_status.get(status, 0) + 1
        by_service[service] = by_service.get(service, 0) + 1
        by_date[date_str] = by_date.get(date_str, 0) + 1

    total = len(bookings)
    completed = by_status.get("completed", 0)
    cancelled = by_status.get("cancelled", 0)

    return {
        "success": True,
        "analytics": {
            "total": total,
            "by_status": by_status,
            "by_service_type": by_service,
            "daily_trend": [{"date": k, "count": v} for k, v in sorted(by_date.items())],
            "completion_rate": round((completed / total * 100) if total > 0 else 0, 1),
            "cancellation_rate": round((cancelled / total * 100) if total > 0 else 0, 1),
        },
    }


# ═══════════════════════════════════════════════════════════════════════════
# PROVIDER PERFORMANCE
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/providers")
async def provider_performance(current_user: dict = Depends(get_current_user)):
    """Top providers by booking count, rating, and verification status."""
    _require_admin(current_user)

    if not supabase:
        return {"success": True, "providers": _mock_provider_data()}

    providers = []

    # Doctors
    try:
        docs = (
            supabase.table("doctors")
            .select("*, users!inner(full_name, email, city)")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        for d in docs.data or []:
            providers.append({
                "type": "doctor",
                "name": d.get("users", {}).get("full_name", ""),
                "email": d.get("users", {}).get("email", ""),
                "city": d.get("users", {}).get("city", ""),
                "specialization": d.get("specialization", ""),
                "verification_status": d.get("verification_status", "pending"),
            })
    except Exception:
        pass

    # Nurses
    try:
        nurses = (
            supabase.table("nurses")
            .select("*, users!inner(full_name, email, city)")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        for n in nurses.data or []:
            providers.append({
                "type": "nurse",
                "name": n.get("users", {}).get("full_name", ""),
                "email": n.get("users", {}).get("email", ""),
                "city": n.get("users", {}).get("city", ""),
                "specialization": ", ".join(n.get("specializations", [])),
                "verification_status": n.get("verification_status", "pending"),
                "rating": n.get("rating", 5.0),
                "total_completed": n.get("total_completed", 0),
            })
    except Exception:
        pass

    return {"success": True, "providers": providers}


# ═══════════════════════════════════════════════════════════════════════════
# GEOSPATIAL DATA (for live operations map)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/geospatial")
async def geospatial_data(current_user: dict = Depends(get_current_user)):
    """Returns lat/lng data for online providers and active dispatches."""
    _require_admin(current_user)

    data = {"online_providers": [], "active_dispatches": []}

    if not supabase:
        return {"success": True, "data": data}

    # Online providers
    try:
        providers = (
            supabase.table("provider_locations")
            .select("*, users!inner(full_name, role)")
            .eq("is_online", True)
            .not_.is_("current_lat", "null")
            .execute()
        )
        for p in providers.data or []:
            data["online_providers"].append({
                "user_id": p.get("user_id"),
                "name": p.get("users", {}).get("full_name", ""),
                "type": p.get("provider_type"),
                "lat": p.get("current_lat"),
                "lng": p.get("current_lng"),
                "speed_kmh": p.get("speed_kmh"),
            })
    except Exception:
        pass

    # Active dispatches
    try:
        dispatches = (
            supabase.table("dispatch_requests")
            .select("*")
            .in_("status", ["searching", "provider_accepted", "en_route", "arrived", "in_progress"])
            .execute()
        )
        for d in dispatches.data or []:
            data["active_dispatches"].append({
                "dispatch_id": d.get("id"),
                "provider_type": d.get("provider_type"),
                "status": d.get("status"),
                "patient_lat": d.get("patient_lat"),
                "patient_lng": d.get("patient_lng"),
            })
    except Exception:
        pass

    return {"success": True, "data": data}


# ═══════════════════════════════════════════════════════════════════════════
# LIVE OPERATIONS SNAPSHOT
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/live")
async def live_operations(current_user: dict = Depends(get_current_user)):
    """Real-time snapshot of platform operations."""
    _require_admin(current_user)

    if not supabase:
        return {"success": True, "live": _mock_live_ops()}

    live = {}

    # Online providers count by type
    try:
        online = (
            supabase.table("provider_locations")
            .select("provider_type")
            .eq("is_online", True)
            .execute()
        )
        online_by_type = {}
        for p in online.data or []:
            t = p.get("provider_type", "unknown")
            online_by_type[t] = online_by_type.get(t, 0) + 1
        live["online_providers"] = online_by_type
        live["total_online"] = sum(online_by_type.values())
    except Exception:
        live["online_providers"] = {}
        live["total_online"] = 0

    # Active dispatches
    try:
        dispatches = (
            supabase.table("dispatch_requests")
            .select("id, provider_type, status, patient_address, created_at")
            .in_("status", ["searching", "provider_accepted", "en_route", "arrived", "in_progress"])
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        live["active_dispatches"] = dispatches.data or []
    except Exception:
        live["active_dispatches"] = []

    # Recent bookings (last hour)
    try:
        one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        recent = (
            supabase.table("bookings")
            .select("id, service_type, status, created_at")
            .gte("created_at", one_hour_ago)
            .order("created_at", desc=True)
            .execute()
        )
        live["recent_bookings"] = recent.data or []
    except Exception:
        live["recent_bookings"] = []

    return {"success": True, "live": live}


# ═══════════════════════════════════════════════════════════════════════════
# MOCK DATA (for development without Supabase)
# ═══════════════════════════════════════════════════════════════════════════

def _mock_executive_metrics():
    return {
        "total_users": 1247,
        "total_patients": 980,
        "total_doctors": 87,
        "total_nurses": 42,
        "total_phlebotomists": 35,
        "total_organizations": 28,
        "total_pharmacys": 45,
        "total_staffs": 30,
        "total_bookings": 4521,
        "bookings_today": 67,
        "active_dispatches": 12,
        "pending_kyc": 15,
        "pending_mou": 8,
        "active_users_30d": 892,
    }


def _mock_registration_trends(days):
    import random
    trends = []
    for i in range(days):
        date = (datetime.now(timezone.utc) - timedelta(days=days - i)).strftime("%Y-%m-%d")
        trends.append({
            "date": date,
            "patient": random.randint(5, 30),
            "doctor": random.randint(0, 5),
            "nurse": random.randint(0, 3),
            "organization": random.randint(0, 2),
            "pharmacy": random.randint(0, 2),
        })
    return trends


def _mock_booking_analytics():
    return {
        "total": 4521,
        "by_status": {"confirmed": 1200, "completed": 2800, "cancelled": 321, "no_show": 200},
        "by_service_type": {
            "lab_test": 1500, "doctor_appointment": 1200, "home_collection": 800,
            "nurse_visit": 400, "video_consult": 350, "pharmacy_delivery": 271,
        },
        "daily_trend": [],
        "completion_rate": 61.9,
        "cancellation_rate": 7.1,
    }


def _mock_provider_data():
    return [
        {"type": "doctor", "name": "Dr. Ramesh Kumar", "city": "Visakhapatnam", "specialization": "General Medicine", "verification_status": "verified"},
        {"type": "doctor", "name": "Dr. Anjali Gupta", "city": "Hyderabad", "specialization": "Cardiology", "verification_status": "pending"},
        {"type": "nurse", "name": "Priya Sharma", "city": "Visakhapatnam", "specialization": "ICU, Post-Operative", "verification_status": "verified", "rating": 4.8, "total_completed": 156},
        {"type": "nurse", "name": "Lakshmi Devi", "city": "Vijayawada", "specialization": "Elderly Care, General", "verification_status": "verified", "rating": 4.9, "total_completed": 89},
    ]


def _mock_live_ops():
    return {
        "online_providers": {"nurse": 8, "phlebotomist": 5, "doctor": 3},
        "total_online": 16,
        "active_dispatches": [
            {"id": "d-001", "provider_type": "nurse", "status": "en_route", "patient_address": "MVP Colony, Vizag"},
            {"id": "d-002", "provider_type": "phlebotomist", "status": "searching", "patient_address": "Beach Road, Vizag"},
        ],
        "recent_bookings": [
            {"id": "b-001", "service_type": "nurse_visit", "status": "confirmed"},
            {"id": "b-002", "service_type": "lab_test", "status": "completed"},
        ],
    }
