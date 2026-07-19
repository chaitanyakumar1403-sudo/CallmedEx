"""
Communications Router — Next-Gen CallMedex
Masked calling, secure in-app chat, and communication session management.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from app.middleware.auth import get_current_user
from app.database import supabase
from app.services.telephony import TelephonyService
from app.services.notification_engine import NotificationEngine
import uuid

router = APIRouter(prefix="/api/comm", tags=["Communications"])


# ─── Models ───────────────────────────────────────────────────────────────

class InitiateCallRequest(BaseModel):
    booking_id: str


class SendChatRequest(BaseModel):
    booking_id: Optional[str] = None
    dispatch_request_id: Optional[str] = None
    receiver_id: str
    message_text: str
    message_type: str = "text"


class MarkReadRequest(BaseModel):
    message_ids: List[str]


# ─── Masked Calling ──────────────────────────────────────────────────────

@router.post("/call/{booking_id}")
async def initiate_masked_call(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Initiate a masked call for a booking.
    Returns a virtual number the caller can use.
    Real phone numbers are never exposed.
    """
    if not supabase:
        return {
            "success": True,
            "virtual_number": "+91-800-CALLMDX-DEMO",
            "message": "Masked calling simulated (DB not configured)",
        }

    # Get the booking to identify the other party
    booking_result = (
        supabase.table("bookings")
        .select("*")
        .eq("id", booking_id)
        .execute()
    )
    if not booking_result.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking = booking_result.data[0]
    user_id = current_user["sub"]

    # Determine patient and provider
    if booking.get("patient_id") == user_id:
        patient_id = user_id
        provider_id = booking.get("provider_id")
    else:
        provider_id = user_id
        patient_id = booking.get("patient_id")

    if not provider_id:
        raise HTTPException(status_code=400, detail="No provider assigned to this booking")

    # Check for existing active session
    existing = (
        supabase.table("communication_sessions")
        .select("*")
        .eq("booking_id", booking_id)
        .eq("status", "active")
        .execute()
    )
    if existing.data:
        session = existing.data[0]
        return {
            "success": True,
            "virtual_number": session["virtual_number"],
            "expires_at": session["expires_at"],
            "message": "Existing masked session active. Use this number to call.",
        }

    # Provision new masked session
    result = await TelephonyService.provision_masked_session(
        booking_id=booking_id,
        patient_id=patient_id,
        provider_id=provider_id,
    )

    # Notify the other party
    other_party_id = provider_id if user_id == patient_id else patient_id
    await NotificationEngine.send(
        user_id=other_party_id,
        channel="in_app",
        title="Incoming Call",
        body=f"You have an incoming call for booking #{booking_id[:8]}",
        data={"booking_id": booking_id, "type": "call"},
    )

    return {"success": True, **result}


# ─── Secure Chat ─────────────────────────────────────────────────────────

@router.post("/chat")
async def send_chat_message(
    req: SendChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """Send a chat message in the context of a booking or dispatch."""
    message_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    message_data = {
        "id": message_id,
        "booking_id": req.booking_id,
        "dispatch_request_id": req.dispatch_request_id,
        "sender_id": current_user["sub"],
        "receiver_id": req.receiver_id,
        "message_text": req.message_text,
        "message_type": req.message_type,
        "is_read": False,
        "created_at": now,
    }

    if supabase:
        try:
            supabase.table("chat_messages").insert(message_data).execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to send message: {e}")

    # Send push notification to receiver
    await NotificationEngine.send(
        user_id=req.receiver_id,
        channel="push",
        title="New Message",
        body=req.message_text[:100],
        data={
            "booking_id": req.booking_id,
            "sender_id": current_user["sub"],
            "type": "chat",
        },
    )

    return {
        "success": True,
        "message_id": message_id,
        "sent_at": now,
    }


@router.get("/chat/{booking_id}")
async def get_chat_history(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get chat message history for a booking."""
    if not supabase:
        return {"success": True, "messages": []}

    result = (
        supabase.table("chat_messages")
        .select("*")
        .eq("booking_id", booking_id)
        .order("created_at", desc=False)
        .execute()
    )

    messages = result.data or []

    # Filter to only messages involving the current user
    user_id = current_user["sub"]
    messages = [
        m for m in messages
        if m.get("sender_id") == user_id or m.get("receiver_id") == user_id
    ]

    return {"success": True, "messages": messages}


@router.post("/chat/read")
async def mark_messages_read(
    req: MarkReadRequest,
    current_user: dict = Depends(get_current_user),
):
    """Mark chat messages as read."""
    now = datetime.now(timezone.utc).isoformat()

    if supabase:
        for msg_id in req.message_ids:
            supabase.table("chat_messages").update({
                "is_read": True,
                "read_at": now,
            }).eq("id", msg_id).eq("receiver_id", current_user["sub"]).execute()

    return {"success": True, "marked_count": len(req.message_ids)}


# ─── Notifications ───────────────────────────────────────────────────────

@router.get("/notifications")
async def get_notifications(
    limit: int = 50,
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """Get notifications for the current user."""
    notifications = await NotificationEngine.get_user_notifications(
        user_id=current_user["sub"],
        limit=limit,
        unread_only=unread_only,
    )
    return {"success": True, "notifications": notifications}


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a notification as read."""
    result = await NotificationEngine.mark_read(notification_id, current_user["sub"])
    return result


# ─── Webhook (Twilio/Exotel callback) ────────────────────────────────────

@router.post("/webhook/telephony")
async def telephony_webhook(request_data: dict):
    """
    Handle incoming call status webhooks from Twilio/Exotel.
    Logs call events and updates session status.
    """
    # Parse the webhook payload (format depends on provider)
    call_sid = request_data.get("CallSid", request_data.get("call_sid", ""))
    call_status = request_data.get("CallStatus", request_data.get("status", ""))
    duration = int(request_data.get("Duration", request_data.get("duration", 0)))

    # Log the call event
    if call_sid:
        await TelephonyService.log_call(
            session_id=call_sid,
            caller_id=request_data.get("From", ""),
            receiver_id=request_data.get("To", ""),
            direction="inbound",
            duration_seconds=duration,
            status=call_status,
        )

    return {"status": "ok"}
