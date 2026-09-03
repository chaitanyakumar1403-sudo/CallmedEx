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
from app.utils.db_helpers import _rows

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
async def get_users(role: Optional[str] = None, q: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """List users, filtered by city for Supervisors. Accepts optional q search
    param that filters by email (case-insensitive)."""
    admin_data = check_admin_access(current_user)
    city = admin_data.get("managed_city")

    if not supabase:
        return {"success": True, "users": []}

    query = supabase.table("users").select("id, full_name, email, role, city, is_active, created_at, managed_city").order("created_at", desc=True)

    if city:
        query = query.eq("city", city)
    if role:
        query = query.eq("role", role)
    if q:
        q_escaped = q.replace("%", "\\%").replace("_", "\\_")
        # Filter by email (case-insensitive contains) — primary use case: staff lookup
        query = query.ilike("email", f"%{q_escaped}%")

    result = query.execute()
    return {"success": True, "city_scope": city or "Global", "users": result.data or []}





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

import logging

logger = logging.getLogger(__name__)


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Super Admin only: Delete user with cascade cleanup of dependent records."""
    admin_data = check_admin_access(current_user)
    if admin_data.get("managed_city") is not None:
        raise HTTPException(status_code=403, detail="Only Super Admins can delete users")

    if not supabase:
        return {"success": True, "message": "Simulated user deletion"}

    try:
        # Step 1: Clean up child records referencing user_id using verified schema columns

        # 1a. Dispatch offers linked to dispatch requests for this user
        try:
            dr_res = supabase.table("dispatch_requests").select("id").or_(f"patient_id.eq.{user_id},assigned_provider_id.eq.{user_id}").execute()
            if dr_res.data:
                dr_ids = [r["id"] for r in dr_res.data if r.get("id")]
                if dr_ids:
                    supabase.table("dispatch_offers").delete().in_("dispatch_request_id", dr_ids).execute()
        except Exception as e:
            logger.warning(f"Cleanup dispatch_offers via requests error: {e}")

        try:
            supabase.table("dispatch_offers").delete().eq("provider_id", user_id).execute()
        except Exception:
            pass

        # 1b. Dispatch requests (patient or provider)
        try:
            supabase.table("dispatch_requests").delete().eq("patient_id", user_id).execute()
        except Exception as e:
            logger.warning(f"Cleanup dispatch_requests patient_id error: {e}")
        try:
            supabase.table("dispatch_requests").delete().eq("assigned_provider_id", user_id).execute()
        except Exception as e:
            logger.warning(f"Cleanup dispatch_requests assigned_provider_id error: {e}")

        # 1c. Bookings (patient_id or provider_id)
        try:
            supabase.table("bookings").delete().eq("patient_id", user_id).execute()
        except Exception as e:
            logger.warning(f"Cleanup bookings patient_id error: {e}")
        try:
            supabase.table("bookings").delete().eq("provider_id", user_id).execute()
        except Exception as e:
            logger.warning(f"Cleanup bookings provider_id error: {e}")

        # 1d. Provider profiles
        for table in ["doctors", "nurses", "pharmacies", "organizations"]:
            try:
                supabase.table(table).delete().eq("user_id", user_id).execute()
            except Exception:
                pass

        try:
            supabase.table("phlebotomists").delete().eq("user_id", user_id).execute()
        except Exception:
            pass
        try:
            supabase.table("phlebotomists").delete().eq("home_lab_org_user_id", user_id).execute()
        except Exception:
            pass

        try:
            supabase.table("organization_doctors").delete().eq("doctor_user_id", user_id).execute()
        except Exception:
            pass

        try:
            supabase.table("provider_locations").delete().eq("user_id", user_id).execute()
        except Exception:
            pass

        # 1e. Auxiliary records (verified columns)
        try:
            supabase.table("documents").delete().eq("user_id", user_id).execute()
        except Exception:
            pass
        try:
            supabase.table("audit_log").delete().eq("actor_id", user_id).execute()
        except Exception:
            pass
        try:
            supabase.table("ai_report_analyses").delete().eq("patient_id", user_id).execute()
        except Exception:
            pass

        # Step 2: Delete from Supabase Auth admin
        try:
            supabase.auth.admin.delete_user(user_id)
        except Exception as e:
            logger.info(f"Auth delete user {user_id}: {e}")

        # Step 3: Delete from public.users table
        supabase.table("users").delete().eq("id", user_id).execute()

        return {"success": True, "message": "User deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")


# ─── P2.6: Cross-Centre Roster Visibility ────────────────────────────────────

@router.get("/roster")
async def admin_get_roster(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Get cross-centre roster for the admin dashboard.

    Returns all phlebotomist roster entries with their processing centre names,
    across all centres. Gated by admin role.
    """
    check_admin_access(current_user)

    if not supabase:
        return {"success": True, "roster": []}

    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    try:
        from app.utils.db_helpers import _rows

        # Get all roster entries for the date
        roster_rows = _rows(
            supabase.table("phlebotomist_roster")
            .select("*")
            .eq("roster_date", target_date)
            .execute()
        )

        if not roster_rows:
            return {"success": True, "roster": [], "date": target_date}

        # Enrich with phlebo names and centre names
        phlebo_ids = list({r["phlebotomist_user_id"] for r in roster_rows})
        centre_ids = list({r["processing_center_id"] for r in roster_rows})

        users = {}
        if phlebo_ids:
            user_rows = _rows(
                supabase.table("users")
                .select("id, full_name, mobile")
                .in_("id", phlebo_ids)
                .execute()
            )
            users = {u["id"]: u for u in user_rows}

        centres = {}
        if centre_ids:
            centre_rows = _rows(
                supabase.table("processing_centers")
                .select("id, name, city")
                .in_("id", centre_ids)
                .execute()
            )
            centres = {c["id"]: c for c in centre_rows}

        enriched = []
        for r in roster_rows:
            user = users.get(r["phlebotomist_user_id"], {})
            centre = centres.get(r["processing_center_id"], {})
            enriched.append({
                "phlebotomist_user_id": r["phlebotomist_user_id"],
                "phlebotomist_name": user.get("full_name", "Unknown"),
                "mobile": user.get("mobile", ""),
                "processing_center_id": r["processing_center_id"],
                "centre_name": centre.get("name", "Unknown"),
                "centre_city": centre.get("city", ""),
                "status": r.get("status", "unknown"),
                "max_jobs": r.get("max_jobs"),
                "roster_date": r.get("roster_date"),
            })

        return {"success": True, "roster": enriched, "date": target_date}
    except Exception as e:
        logger.error(f"Admin roster fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── P1.1: Ops Alerts Dashboard ─────────────────────────────────────────────

@router.get("/ops-alerts")
async def admin_get_ops_alerts(
    limit: int = 50,
    alert_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Get pending operational alerts for the admin dashboard."""
    check_admin_access(current_user)

    from app.services.ops_alerts import OpsAlertService
    alerts = OpsAlertService.get_pending_alerts(limit=limit, alert_type=alert_type)
    counts = OpsAlertService.get_alert_counts()

    return {"success": True, "alerts": alerts, "counts": counts}


@router.post("/ops-alerts/{alert_id}/resolve")
async def admin_resolve_ops_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Resolve an ops alert."""
    check_admin_access(current_user)

    from app.services.ops_alerts import OpsAlertService
    success = OpsAlertService.resolve_alert(alert_id, resolved_by=current_user.get("sub"))

    if not success:
        raise HTTPException(status_code=404, detail="Alert not found or already resolved.")

    return {"success": True, "message": "Alert resolved."}


# ─── ReportJob Retry Management ───────────────────────────────────────────

@router.post("/report-jobs/{report_job_id}/retry")
async def admin_retry_report_job(
    report_job_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Manually retry a failed or dead-letter ReportJob."""
    check_admin_access(current_user)

    if not supabase:
        raise HTTPException(status_code=500, detail="Database uninitialized.")

    rows = _rows(
        supabase.table("report_jobs").select("*").eq("id", report_job_id).limit(1).execute()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="ReportJob not found.")

    job = rows[0]

    # Reset retry state
    now_str = datetime.now(timezone.utc).isoformat()
    supabase.table("report_jobs").update({
        "status": "queued",
        "dead_letter": False,
        "last_error": None,
        "next_retry_at": None,
        "updated_at": now_str,
    }).eq("id", report_job_id).execute()

    from app.services.report_submission import submit_report_job_to_mediassist
    try:
        res = await submit_report_job_to_mediassist(
            report_job_id=job["id"],
            patient_id=job.get("patient_id") or "",
            booking_id=job.get("booking_id"),
            sample_id=job.get("sample_id"),
            processing_center_id=job.get("processing_center_id"),
            barcode=job.get("barcode"),
            connector_type=job.get("connector_type") or "mocdoc",
            idempotency_key=job.get("idempotency_key"),
            correlation_id=job.get("correlation_id"),
            db=supabase,
        )
        return {"success": True, "message": f"ReportJob {report_job_id} retried successfully.", "result": res}
    except Exception as exc:
        logger.error(f"Manual retry for ReportJob {report_job_id} failed: {exc}")
        return {"success": False, "message": f"Retry failed: {exc}", "report_job_id": report_job_id}


@router.post("/report-jobs/retry-failed")
async def admin_batch_retry_failed_report_jobs(
    current_user: dict = Depends(get_current_user),
):
    """Batch retry all failed/retryable ReportJobs past their next_retry_at."""
    check_admin_access(current_user)

    if not supabase:
        raise HTTPException(status_code=500, detail="Database uninitialized.")

    now_str = datetime.now(timezone.utc).isoformat()
    rows = _rows(
        supabase.table("report_jobs")
        .select("*")
        .in_("status", ["failed", "retry"])
        .eq("dead_letter", False)
        .lte("next_retry_at", now_str)
        .execute()
    )

    retried_count = 0
    errors = []

    from app.services.report_submission import submit_report_job_to_mediassist
    for job in rows:
        try:
            await submit_report_job_to_mediassist(
                report_job_id=job["id"],
                patient_id=job.get("patient_id") or "",
                booking_id=job.get("booking_id"),
                sample_id=job.get("sample_id"),
                processing_center_id=job.get("processing_center_id"),
                barcode=job.get("barcode"),
                connector_type=job.get("connector_type") or "mocdoc",
                idempotency_key=job.get("idempotency_key"),
                correlation_id=job.get("correlation_id"),
                db=supabase,
            )
            retried_count += 1
        except Exception as e:
            errors.append({"report_job_id": job["id"], "error": str(e)})

    return {
        "success": True,
        "scanned_count": len(rows),
        "retried_count": retried_count,
        "failed_count": len(errors),
        "errors": errors,
    }


