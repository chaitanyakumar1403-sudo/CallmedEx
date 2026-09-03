"""
Device Tokens Router — FCM & APNs Device Push Token Management
Allows native iOS/Android mobile clients to register and unregister push notification tokens.
"""
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import (
    DeviceTokenRegisterRequest,
    DeviceTokenUnregisterRequest,
    APIResponse,
)
from app.middleware.auth import get_current_user
from app.database import supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["Device Notifications"])

# In-memory store fallback when Supabase is not connected
_local_device_tokens = {}  # push_token -> dict


@router.post("/register-device", response_model=APIResponse)
async def register_device_token(
    body: DeviceTokenRegisterRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Register or update an FCM / APNs device push token for the authenticated user.
    """
    user_id = current_user["sub"]
    now = datetime.now(timezone.utc).isoformat()

    token_data = {
        "user_id": user_id,
        "platform": body.platform.lower(),
        "push_token": body.push_token.strip(),
        "device_name": body.device_name or "",
        "app_version": body.app_version or "1.0.0",
        "is_active": True,
        "updated_at": now,
    }

    # Maintain local cache in all environments
    token_data["id"] = str(uuid.uuid4())
    token_data["created_at"] = now
    _local_device_tokens[body.push_token] = token_data

    if supabase:
        try:
            # Check if token already exists for this user
            existing = (
                supabase.table("device_tokens")
                .select("id")
                .eq("user_id", user_id)
                .eq("push_token", body.push_token)
                .execute()
            )
            if existing.data:
                supabase.table("device_tokens").update({
                    "is_active": True,
                    "platform": body.platform.lower(),
                    "device_name": body.device_name or "",
                    "app_version": body.app_version or "1.0.0",
                    "updated_at": now,
                }).eq("id", existing.data[0]["id"]).execute()
            else:
                supabase.table("device_tokens").insert(token_data).execute()
        except Exception as e:
            logger.error(f"Error registering device token in database: {e}")

    logger.info(f"Registered {body.platform} push token for user {user_id}")
    return APIResponse(
        success=True,
        message=f"Device push token registered successfully for {body.platform}",
        data={"push_token": body.push_token, "platform": body.platform},
    )


@router.delete("/unregister-device", response_model=APIResponse)
async def unregister_device_token(
    body: DeviceTokenUnregisterRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Unregister a push token (e.g. on logout or app uninstall).
    """
    user_id = current_user["sub"]
    token = body.push_token.strip()

    _local_device_tokens.pop(token, None)

    if supabase:
        try:
            supabase.table("device_tokens").update({
                "is_active": False,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("user_id", user_id).eq("push_token", token).execute()
        except Exception as e:
            logger.error(f"Error deactivating device token: {e}")

    return APIResponse(
        success=True,
        message="Device push token unregistered successfully",
        data={"push_token": token},
    )


@router.get("/devices", response_model=APIResponse)
async def list_user_devices(current_user: dict = Depends(get_current_user)):
    """
    List all active registered devices for the current user.
    """
    user_id = current_user["sub"]
    devices = []

    if supabase:
        try:
            res = (
                supabase.table("device_tokens")
                .select("id, platform, device_name, app_version, is_active, created_at, updated_at")
                .eq("user_id", user_id)
                .eq("is_active", True)
                .execute()
            )
            devices = res.data or []
        except Exception as e:
            logger.error(f"Error fetching user device tokens: {e}")

    if not devices:
        devices = [d for d in _local_device_tokens.values() if d.get("user_id") == user_id and d.get("is_active")]

    return APIResponse(
        success=True,
        message="User devices retrieved successfully",
        data={"devices": devices, "total": len(devices)},
    )
