"""
Audit Service — Next-Gen CallMedex
Comprehensive, immutable audit logging for compliance and analytics.
Logs all critical system actions with IP, User-Agent, and contextual metadata.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from app.database import supabase

logger = logging.getLogger(__name__)


class AuditService:
    """
    System-wide audit logging service.
    Records immutable log entries for:
      - Registration, MOU acceptance, login
      - Booking creation, status changes, cancellations
      - Dispatch creation, assignment, completion
      - Payment, settlement, refund
      - Admin actions (suspend, verify, reject)
      - Document verification
    """

    @staticmethod
    def log(
        action: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        actor_id: Optional[str] = None,
        details: dict = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """
        Record an audit log entry.
        
        Args:
            action: Action identifier (e.g. 'user.registered', 'booking.created', 'mou.accepted')
            entity_type: Type of entity affected (e.g. 'user', 'booking', 'dispatch')
            entity_id: UUID of the affected entity
            actor_id: UUID of the user performing the action (None for system actions)
            details: Arbitrary context dict (old/new values, metadata)
            ip_address: Client IP address
            user_agent: Client user agent string
        """
        record = {
            "id": str(uuid.uuid4()),
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "details": details or {},
            "ip_address": ip_address or "unknown",
            "user_agent": (user_agent or "unknown")[:500],  # Truncate UA strings
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Always persist to database
        if supabase:
            try:
                supabase.table("audit_log").insert(record).execute()
            except Exception as e:
                logger.error(f"Audit log DB insert failed: {e}")

        # Always log to console as backup
        logger.info(
            f"AUDIT | {action} | {entity_type}:{entity_id} | "
            f"actor:{actor_id} | ip:{ip_address}"
        )

    @staticmethod
    def log_from_request(
        action: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        actor_id: Optional[str] = None,
        details: dict = None,
        request=None,
    ):
        """
        Convenience method: extracts IP and User-Agent from a FastAPI Request object.
        """
        ip = "unknown"
        ua = "unknown"

        if request:
            ip = getattr(request.client, "host", "unknown") if request.client else "unknown"
            ua = request.headers.get("user-agent", "unknown")

        AuditService.log(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            actor_id=actor_id,
            details=details,
            ip_address=ip,
            user_agent=ua,
        )

    @staticmethod
    async def get_audit_log(
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        actor_id: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100,
    ) -> list:
        """
        Query audit logs with optional filters.
        Admin-only endpoint support.
        """
        if not supabase:
            return []

        query = supabase.table("audit_log").select("*")

        if entity_type:
            query = query.eq("entity_type", entity_type)
        if entity_id:
            query = query.eq("entity_id", entity_id)
        if actor_id:
            query = query.eq("actor_id", actor_id)
        if action:
            query = query.eq("action", action)

        query = query.order("created_at", desc=True).limit(limit)
        result = query.execute()
        return result.data or []


# ─── Predefined Action Constants ─────────────────────────────────────────
# Use these for consistent action naming across the codebase.

class AuditActions:
    # User lifecycle
    USER_REGISTERED = "user.registered"
    USER_SIGNUP_INITIATED = "user.signup_initiated"
    USER_LOGIN = "user.login"
    USER_LOGIN_FAILED = "user.login_failed"
    USER_SUSPENDED = "user.suspended"
    USER_ACTIVATED = "user.activated"

    # Legal / MOU
    MOU_SENT = "mou.sent"
    MOU_VIEWED = "mou.viewed"
    MOU_ACCEPTED = "mou.accepted"
    MOU_EXPIRED = "mou.expired"

    # Booking
    BOOKING_CREATED = "booking.created"
    BOOKING_CONFIRMED = "booking.confirmed"
    BOOKING_CANCELLED = "booking.cancelled"
    BOOKING_COMPLETED = "booking.completed"
    BOOKING_CHECKED_IN = "booking.checked_in"
    BOOKING_NO_SHOW = "booking.no_show"

    # Dispatch
    DISPATCH_CREATED = "dispatch.created"
    DISPATCH_ASSIGNED = "dispatch.assigned"
    DISPATCH_EN_ROUTE = "dispatch.en_route"
    DISPATCH_ARRIVED = "dispatch.arrived"
    DISPATCH_COMPLETED = "dispatch.completed"
    DISPATCH_CANCELLED = "dispatch.cancelled"
    DISPATCH_NO_PROVIDER = "dispatch.no_provider"

    # Communication
    CALL_INITIATED = "call.initiated"
    CALL_COMPLETED = "call.completed"
    CHAT_SENT = "chat.sent"

    # Verification
    KYC_SUBMITTED = "kyc.submitted"
    KYC_APPROVED = "kyc.approved"
    KYC_REJECTED = "kyc.rejected"

    # Admin
    ADMIN_USER_SUSPENDED = "admin.user_suspended"
    ADMIN_USER_ACTIVATED = "admin.user_activated"
    ADMIN_SUPERVISOR_CREATED = "admin.supervisor_created"
    ADMIN_SETTINGS_CHANGED = "admin.settings_changed"
