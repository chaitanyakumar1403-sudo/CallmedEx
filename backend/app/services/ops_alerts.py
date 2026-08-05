"""
Ops Alerts Service — Production monitoring for CallMedex.

Provides a shared alerting mechanism used by:
  - P1.2: Booking/dispatch creation failures
  - P1.5: Re-fan-out exhaustion (no provider found)
  - P1.6: Email send failures
  - P2.7: MediAssist fallback events

Alerts are stored in the ops_alerts table and surfaced in the admin dashboard.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from app.database import supabase
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)


class OpsAlertService:
    """Lightweight operational alerting for production monitoring."""

    @staticmethod
    def create_alert(
        alert_type: str,
        entity_type: str,
        entity_id: str,
        details: Optional[Dict[str, Any]] = None,
        severity: str = "warning",
    ) -> Optional[str]:
        """Create an ops alert record.

        Args:
            alert_type: Category key, e.g. 'dispatch_creation_failed',
                        'dispatch_no_provider', 'email_send_failed'.
            entity_type: What the alert is about, e.g. 'booking', 'dispatch_offer'.
            entity_id: UUID of the affected entity.
            details: Arbitrary JSON metadata for debugging.
            severity: 'info' | 'warning' | 'critical'. Defaults to 'warning'.

        Returns:
            The alert UUID if created, or None if DB is unavailable.
        """
        if not supabase:
            logger.warning(f"OpsAlert({alert_type}) for {entity_type}:{entity_id} — DB unavailable")
            return None

        alert_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        try:
            supabase.table("ops_alerts").insert({
                "id": alert_id,
                "alert_type": alert_type,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "severity": severity,
                "details": details or {},
                "status": "open",
                "created_at": now,
            }).execute()

            logger.warning(
                f"OpsAlert CREATED: [{severity.upper()}] {alert_type} "
                f"for {entity_type}:{entity_id}"
            )
            return alert_id
        except Exception as e:
            # Ops alerts must never crash the calling code
            logger.error(f"Failed to persist ops alert: {e}")
            return None

    @staticmethod
    def get_pending_alerts(
        limit: int = 50,
        alert_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve open alerts for the admin dashboard.

        Args:
            limit: Max number of alerts to return.
            alert_type: Optional filter by alert_type.

        Returns:
            List of alert dicts, newest first.
        """
        if not supabase:
            return []

        try:
            query = (
                supabase.table("ops_alerts")
                .select("*")
                .eq("status", "open")
                .order("created_at", desc=True)
                .limit(limit)
            )
            if alert_type:
                query = query.eq("alert_type", alert_type)

            return _rows(query.execute())
        except Exception as e:
            logger.error(f"Failed to fetch ops alerts: {e}")
            return []

    @staticmethod
    def resolve_alert(
        alert_id: str,
        resolved_by: Optional[str] = None,
    ) -> bool:
        """Mark an alert as resolved.

        Args:
            alert_id: UUID of the alert to resolve.
            resolved_by: UUID of the admin user who resolved it.

        Returns:
            True if updated, False otherwise.
        """
        if not supabase:
            return False

        now = datetime.now(timezone.utc).isoformat()
        try:
            supabase.table("ops_alerts").update({
                "status": "resolved",
                "resolved_at": now,
                "resolved_by": resolved_by,
            }).eq("id", alert_id).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to resolve ops alert {alert_id}: {e}")
            return False

    @staticmethod
    def get_alert_counts() -> Dict[str, int]:
        """Return a summary of open alerts by type for the admin dashboard header."""
        if not supabase:
            return {}

        try:
            alerts = _rows(
                supabase.table("ops_alerts")
                .select("alert_type")
                .eq("status", "open")
                .execute()
            )
            counts: Dict[str, int] = {}
            for alert in alerts:
                t = alert.get("alert_type", "unknown")
                counts[t] = counts.get(t, 0) + 1
            return counts
        except Exception as e:
            logger.error(f"Failed to get alert counts: {e}")
            return {}
