"""
Admin Router — Hierarchy support for Super Admins and City Supervisors.
Provides aggregated stats, user management, and verification queues.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import json
from app.middleware.auth import get_current_user
from app.database import supabase
from app.services.fraud_detection import FraudDetectionService

router = APIRouter(prefix="/api/admin", tags=["Admin"])


class SupervisorCreate(BaseModel):
    full_name: str
    email: str
    mobile: str
    password: str
    managed_city: str


def check_admin_access(current_user: dict) -> dict:
    """Verify user is an admin and return their managed_city if any."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Fetch fresh user data to get managed_city
    if supabase:
        result = supabase.table("users").select("managed_city").eq("id", current_user["sub"]).execute()
        if result.data:
            return result.data[0]
    
    return {"managed_city": None}


@router.get("/metrics")
async def get_metrics(current_user: dict = Depends(get_current_user)):
    """Get high-level dashboard metrics (filtered by city if Supervisor)."""
    admin_data = check_admin_access(current_user)
    city = admin_data.get("managed_city")

    if not supabase:
        return {"success": True, "metrics": {"users": 0, "bookings": 0, "pending_verifications": 0}}

    metrics = {}
    
    # User query
    user_query = supabase.table("users").select("id", count="exact")
    if city:
        user_query = user_query.eq("city", city)
    user_res = user_query.execute()
    metrics["total_users"] = user_res.count if user_res.count else len(user_res.data)

    # Bookings query
    # Since bookings don't have a direct city, we join or assume for simplicity we fetch all for SuperAdmin
    # For City Supervisor, this requires a join with the provider's org city, which we'll simplify here.
    if not city:
        booking_res = supabase.table("bookings").select("id", count="exact").execute()
        metrics["total_bookings"] = booking_res.count if booking_res.count else len(booking_res.data)
    else:
        # Simplify: just return N/A for now if city bound, or fetch locally
        metrics["total_bookings"] = "N/A (City filter applied)"

    return {"success": True, "city_scope": city or "Global", "metrics": metrics}


@router.get("/users")
async def get_users(role: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """List users, filtered by city for Supervisors."""
    admin_data = check_admin_access(current_user)
    city = admin_data.get("managed_city")

    if not supabase:
        return {"success": True, "users": []}

    query = supabase.table("users").select("id, full_name, email, role, city, is_active, created_at, managed_city").order("created_at", desc=True)
    
    if city:
        query = query.eq("city", city)
    if role:
        query = query.eq("role", role)

    result = query.execute()
    return {"success": True, "city_scope": city or "Global", "users": result.data or []}


@router.get("/verifications")
async def get_pending_verifications(current_user: dict = Depends(get_current_user)):
    """List pending provider verifications. City Supervisors only see their city's providers."""
    admin_data = check_admin_access(current_user)
    city = admin_data.get("managed_city")

    if not supabase:
        return {"success": True, "verifications": []}

    # Fetch users first to filter by city
    user_query = supabase.table("users").select("id, full_name, city, role").in_("role", ["doctor", "pharmacy", "phlebotomist", "organization"])
    if city:
        user_query = user_query.eq("city", city)
    
    users = user_query.execute().data or []
    if not users:
        return {"success": True, "verifications": []}

    user_ids = [u["id"] for u in users]
    user_map = {u["id"]: u for u in users}

    # Fetch pending verifications across all role tables
    verifications = []
    
    # 1. Doctors
    docs = supabase.table("doctors").select("*").in_("user_id", user_ids).eq("verification_status", "pending").execute().data or []
    for d in docs:
        verifications.append({"role": "doctor", "user": user_map[d["user_id"]], "data": d})
        
    # 2. Pharmacies
    pharms = supabase.table("pharmacies").select("*").in_("user_id", user_ids).eq("verification_status", "pending").execute().data or []
    for p in pharms:
        verifications.append({"role": "pharmacy", "user": user_map[p["user_id"]], "data": p})

    # 3. Phlebotomists
    phlebs = supabase.table("phlebotomists").select("*").in_("user_id", user_ids).eq("verification_status", "pending").execute().data or []
    for ph in phlebs:
        verifications.append({"role": "phlebotomist", "user": user_map[ph["user_id"]], "data": ph})
        
    # 4. Organizations
    orgs = supabase.table("organizations").select("*").in_("user_id", user_ids).eq("verification_status", "pending").execute().data or []
    for o in orgs:
        verifications.append({"role": "organization", "user": user_map[o["user_id"]], "data": o})

    return {"success": True, "city_scope": city or "Global", "verifications": verifications}


@router.get("/fraud/anomalies")
async def get_fraud_anomalies(current_user: dict = Depends(get_current_user)):
    """Super Admin only: Run AI Fraud Detection scan."""
    admin_data = check_admin_access(current_user)
    if admin_data.get("managed_city") is not None:
        raise HTTPException(status_code=403, detail="Only Super Admins can run global fraud scans")
        
    # In a real scenario, we would aggregate the last 30 days of bookings from Supabase here.
    # For demonstration, we construct a representative JSON payload to feed to Gemini.
    mock_billing_data = [
        {"id": "1", "name": "Dr. Ramesh Kumar", "type": "doctor", "total_bookings": 145, "no_shows": 2, "complaints": 1},
        {"id": "2", "name": "Apollo Pharmacy (Madhurawada)", "type": "pharmacy", "total_bookings": 320, "no_shows": 12, "complaints": 8},
        {"id": "3", "name": "Suresh (Phlebotomist)", "type": "phlebotomist", "total_bookings": 89, "no_shows": 0, "complaints": 0},
        {"id": "4", "name": "Dr. Anjali Gupta", "type": "doctor", "total_bookings": 45, "no_shows": 5, "complaints": 3},
        {"id": "5", "name": "City Health Clinic", "type": "organization", "total_bookings": 850, "no_shows": 150, "complaints": 45}
    ]
    
    anomalies = FraudDetectionService.scan_for_anomalies(json.dumps(mock_billing_data))
    
    return {
        "success": True,
        "anomalies": anomalies
    }


@router.post("/supervisors")
async def create_supervisor(data: SupervisorCreate, current_user: dict = Depends(get_current_user)):
    """Super Admin only: Create a City Supervisor."""
    admin_data = check_admin_access(current_user)
    if admin_data.get("managed_city") is not None:
        raise HTTPException(status_code=403, detail="Only Super Admins can create City Supervisors")

    from app.utils.security import hash_password
    import uuid

    if not supabase:
        return {"success": True, "message": "Simulated supervisor creation"}

    # Check if email exists
    existing = supabase.table("users").select("id").eq("email", data.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already exists")

    new_user = {
        "id": str(uuid.uuid4()),
        "full_name": data.full_name,
        "email": data.email,
        "mobile": data.mobile,
        "password_hash": hash_password(data.password),
        "role": "admin",
        "managed_city": data.managed_city,
        "city": data.managed_city, # So they exist in their own city theoretically
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    supabase.table("users").insert(new_user).execute()

    return {"success": True, "message": f"Supervisor created for {data.managed_city}"}


class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None

@router.patch("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Super Admin only: Update user role or status."""
    admin_data = check_admin_access(current_user)
    if admin_data.get("managed_city") is not None:
        raise HTTPException(status_code=403, detail="Only Super Admins can modify users")

    if not supabase:
        return {"success": True, "message": "Simulated user update"}

    update_dict = {}
    if data.role is not None:
        update_dict["role"] = data.role
    if data.is_active is not None:
        update_dict["is_active"] = data.is_active

    if not update_dict:
        return {"success": False, "detail": "No data provided"}

    supabase.table("users").update(update_dict).eq("id", user_id).execute()
    return {"success": True, "message": "User updated successfully"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Super Admin only: Delete user."""
    admin_data = check_admin_access(current_user)
    if admin_data.get("managed_city") is not None:
        raise HTTPException(status_code=403, detail="Only Super Admins can delete users")

    if not supabase:
        return {"success": True, "message": "Simulated user deletion"}

    supabase.table("users").delete().eq("id", user_id).execute()
    return {"success": True, "message": "User deleted successfully"}

