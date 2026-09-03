"""Admin verification review — the authority over provider verification."""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.middleware.auth import get_current_user
from app.database import supabase
from app.services.storage import StorageService
from app.services.notification_engine import NotificationEngine
from app.services.verification import VerificationService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/verifications", tags=["Admin Verification"])

def _require_admin(user: dict):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

class DecideRequest(BaseModel):
    decision: str  # 'approve' | 'reject'
    reason: str = ""

from typing import Optional

@router.get("")
async def list_reviews(
    status: Optional[str] = "under_review",
    current_user: dict = Depends(get_current_user),
):
    """
    Unified Admin Verification Queue.
    Serves both:
    - Layer 0 KYC review queue (data.reviews)
    - City Supervisor pending provider verifications (data.verifications)
    """
    _require_admin(current_user)
    if not supabase:
        return {"success": True, "reviews": [], "verifications": [], "city_scope": "Global"}

    # Fetch admin user data to check managed_city (for City Supervisors)
    managed_city = None
    try:
        user_res = supabase.table("users").select("managed_city").eq("id", current_user["sub"]).execute()
        if user_res.data:
            managed_city = user_res.data[0].get("managed_city")
    except Exception:
        pass

    # 1. Verification Reviews (Canonical review queue)
    query = supabase.table("verification_reviews").select("*")
    if status and status != "all":
        query = query.eq("final_status", status)
    rows = (query.order("created_at", desc=True).limit(100).execute()).data or []

    out = []
    for r in rows:
        doc_url = ""
        if r.get("document_id"):
            try:
                d = supabase.table("documents").select("file_url").eq("id", r["document_id"]).execute()
                if d.data:
                    doc_url = StorageService.signed_url(d.data[0].get("file_url", ""))
            except Exception:
                pass
        out.append({**r, "document_signed_url": doc_url})

    # 2. Provider role-table verifications (for supervisor dashboard compatibility)
    verifications = []
    try:
        u_query = supabase.table("users").select("id, full_name, city, role").in_("role", ["doctor", "pharmacy", "phlebotomist", "organization"])
        if managed_city:
            u_query = u_query.eq("city", managed_city)
        users = u_query.execute().data or []
        if users:
            user_ids = [u["id"] for u in users]
            user_map = {u["id"]: u for u in users}

            role_configs = [
                ("doctors", "doctor"),
                ("pharmacies", "pharmacy"),
                ("phlebotomists", "phlebotomist"),
                ("organizations", "organization"),
            ]
            for table_name, role_name in role_configs:
                p_rows = supabase.table(table_name).select("*").in_("user_id", user_ids).eq("verification_status", "pending").execute().data or []
                for p in p_rows:
                    verifications.append({"role": role_name, "user": user_map.get(p["user_id"]), "data": p})
    except Exception as e:
        logger.warning(f"Error fetching role verifications: {e}")

    return {
        "success": True,
        "city_scope": managed_city or "Global",
        "reviews": out,
        "verifications": verifications,
        "count": len(out),
    }


@router.post("/{review_id}/decide")
async def decide_review(review_id: str, req: DecideRequest, current_user: dict = Depends(get_current_user)):
    _require_admin(current_user)
    if req.decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="decision must be 'approve' or 'reject'")
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    rev = supabase.table("verification_reviews").select("*").eq("id", review_id).execute()
    if not rev.data:
        raise HTTPException(status_code=404, detail="Review not found")
    review = rev.data[0]
    final_status = "verified" if req.decision == "approve" else "rejected"
    now = datetime.now(timezone.utc).isoformat()

    supabase.table("verification_reviews").update({
        "final_status": final_status, "reviewed_by": current_user["sub"],
        "review_reason": req.reason, "decided_at": now,
    }).eq("id", review_id).execute()

    rules = VerificationService.VERIFICATION_RULES.get(review["role"])
    if rules:
        supabase.table(rules["table"]).update(
            {"verification_status": final_status}
        ).eq("user_id", review["provider_user_id"]).execute()

    msg = ("Your account has been verified. You are now live on CallMedex."
           if final_status == "verified"
           else f"Your verification was not approved. Reason: {req.reason or 'documents did not meet requirements'}.")
    await NotificationEngine.send_multi(review["provider_user_id"], ["in_app", "email"],
                                        "Verification update", msg)
    return {"success": True, "final_status": final_status}
