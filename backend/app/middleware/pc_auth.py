"""
Processing Center auth.

A centre id is NEVER taken from a request path or body. It is resolved from the
authenticated user's staff row, so a technician at HYD-01 cannot read or write
VSP-01's samples by editing a URL.
"""
import logging

from fastapi import Depends, HTTPException

from app.database import supabase
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)

DENIED = "Not an active Processing Center staff account."


async def get_current_pc_staff(user: dict = Depends(get_current_user)) -> dict:
    """Resolve the caller to their active processing centre staff row."""
    if user.get("role") != "processing_center":
        raise HTTPException(status_code=403, detail=DENIED)

    user_id = user.get("sub") or user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=403, detail=DENIED)

    result = (
        supabase.table("processing_center_staff")
        .select("processing_center_id, pc_role, is_active")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    rows = getattr(result, "data", None) or []
    row = rows[0] if rows else None
    if not row:
        logger.warning("Unassigned or inactive processing center user attempted access: %s", user_id)
        raise HTTPException(status_code=403, detail=DENIED)

    return {
        "user_id": user_id,
        "role": "processing_center",
        "processing_center_id": row["processing_center_id"],
        "pc_role": row["pc_role"],
    }


async def require_pc_admin(staff: dict = Depends(get_current_pc_staff)) -> dict:
    """Catalog and roster writes are centre-admin only; technicians scan and verify."""
    if staff.get("pc_role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="This action requires a Processing Center administrator.",
        )
    return staff
