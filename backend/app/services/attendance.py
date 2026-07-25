"""
Attendance Service — CallMedex

The partner MOUs require a live selfie with the collection kit before field duty
begins, by 05:15 IST for phlebotomists.

Enforcement is a PAYMENT hold, not a dispatch block. Both MOUs permit either
("suspension of bookings or payment hold"), but suspending dispatch penalises
the patient who already booked, and the platform's duty runs to the patient
first. Money is the correct lever against a provider; service availability is
not. Earnings therefore keep accruing to the ledger while the transfer freezes,
which is also what the MOU describes: deductions and disputes are "reflected
before monthly settlement", not deducted from service delivery.
"""
import logging
import uuid
from datetime import datetime, time, timedelta, timezone
from typing import List, Optional

from app.database import supabase
from app.services.wallet import WalletService

logger = logging.getLogger(__name__)

# IST. Chosen over a tz database lookup so the deadline is stable regardless of
# where the server runs; India has no daylight saving.
IST = timezone(timedelta(hours=5, minutes=30))

DEFAULT_DEADLINE = "05:15"
HOLD_REASON = "Daily attendance selfie not submitted"


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _first(result) -> dict:
    rows = _rows(result)
    return rows[0] if rows else {}


class AttendanceService:
    """Daily selfie-with-kit gate and the payment hold it drives."""

    # ── Config ────────────────────────────────────────────────────────────

    @staticmethod
    def deadline() -> str:
        """The configured cut-off, e.g. '05:15'. Admin-tunable, not hardcoded."""
        if not supabase:
            return DEFAULT_DEADLINE
        try:
            row = _first(
                supabase.table("platform_settings")
                .select("value")
                .eq("key", "phlebo_attendance_deadline")
                .limit(1)
                .execute()
            )
            value = row.get("value") or {}
            return str(value.get("time") or DEFAULT_DEADLINE)
        except Exception:
            return DEFAULT_DEADLINE

    @staticmethod
    def _today_ist() -> str:
        return datetime.now(IST).date().isoformat()

    @staticmethod
    def _is_late(now_ist: datetime, deadline_str: str) -> bool:
        try:
            hh, mm = (int(x) for x in deadline_str.split(":", 1))
        except (ValueError, TypeError):
            hh, mm = 5, 15
        return now_ist.timetz() > time(hh, mm, tzinfo=IST)

    # ── Submission ────────────────────────────────────────────────────────

    @staticmethod
    def submit(
        provider_user_id: str,
        selfie_url: str,
        provider_role: str = "phlebotomist",
        lat: Optional[float] = None,
        lng: Optional[float] = None,
    ) -> dict:
        """
        Record today's selfie.

        Submitting on time lifts any hold that a missed selfie had placed, so a
        collector who fixes it mid-morning is not stuck waiting for a human.
        A late submission is recorded and accepted but leaves the hold in place
        for review — the MOU makes lateness a compliance matter, not an
        automatic forfeit.
        """
        if not supabase:
            return {"success": False, "message": "Database not configured"}
        if not selfie_url.strip():
            return {"success": False, "message": "A selfie is required."}

        now_ist = datetime.now(IST)
        today = now_ist.date().isoformat()
        deadline_str = AttendanceService.deadline()
        late = AttendanceService._is_late(now_ist, deadline_str)

        existing = _first(
            supabase.table("attendance_logs")
            .select("*")
            .eq("provider_user_id", provider_user_id)
            .eq("log_date", today)
            .limit(1)
            .execute()
        )

        payload = {
            "provider_user_id": provider_user_id,
            "log_date": today,
            "selfie_url": selfie_url.strip(),
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "is_late": late,
            "lat": lat,
            "lng": lng,
            "status": "submitted",
            "provider_role": provider_role,
            "deadline_local": deadline_str,
        }

        try:
            if existing:
                supabase.table("attendance_logs").update(payload).eq(
                    "id", existing["id"]
                ).execute()
            else:
                payload["id"] = str(uuid.uuid4())
                supabase.table("attendance_logs").insert(payload).execute()
        except Exception as e:
            logger.error(f"attendance submit failed for {provider_user_id}: {e}")
            return {"success": False, "message": f"Could not record attendance: {e}"}

        released = False
        if not late:
            released = AttendanceService._release_hold(provider_user_id)

        return {
            "success": True,
            "is_late": late,
            "deadline": deadline_str,
            "hold_released": released,
            "message": (
                f"Attendance recorded after the {deadline_str} cut-off. "
                "Your payout stays on hold pending review."
                if late
                else "Attendance recorded. You're clear for field duty."
            ),
        }

    # ── Holds ─────────────────────────────────────────────────────────────

    @staticmethod
    def _release_hold(provider_user_id: str) -> bool:
        """Lift a hold only if attendance is what caused it."""
        wallet = WalletService.ensure_wallet(provider_user_id)
        if wallet.get("on_hold") and wallet.get("hold_reason") == HOLD_REASON:
            WalletService.set_hold(provider_user_id, False)
            return True
        return False

    @staticmethod
    def sweep_missed(for_date: Optional[str] = None) -> dict:
        """
        After the cut-off, mark non-submitters absent and hold their payouts.

        Runs from Celery Beat. Only collectors who are actually engaged today are
        considered — holding the wallet of someone who is off-duty or unverified
        would be punishing them for not working when they were not rostered.
        """
        if not supabase:
            return {"held": 0, "checked": 0}

        day = for_date or AttendanceService._today_ist()

        try:
            collectors = _rows(
                supabase.table("phlebotomists")
                .select("user_id, phleb_type, verification_status")
                .eq("verification_status", "verified")
                .execute()
            )
        except Exception as e:
            logger.error(f"sweep_missed roster read failed: {e}")
            return {"held": 0, "checked": 0, "error": str(e)}

        try:
            submitted = {
                r["provider_user_id"]
                for r in _rows(
                    supabase.table("attendance_logs")
                    .select("provider_user_id, status")
                    .eq("log_date", day)
                    .execute()
                )
            }
        except Exception as e:
            logger.error(f"sweep_missed attendance read failed: {e}")
            return {"held": 0, "checked": 0, "error": str(e)}

        held = 0
        for c in collectors:
            uid = c.get("user_id")
            if not uid or uid in submitted:
                continue
            try:
                supabase.table("attendance_logs").insert({
                    "id": str(uuid.uuid4()),
                    "provider_user_id": uid,
                    "log_date": day,
                    "status": "missed",
                    "is_late": True,
                    "hold_applied": True,
                    "deadline_local": AttendanceService.deadline(),
                    "provider_role": "phlebotomist",
                }).execute()
            except Exception as e:
                # A unique (provider, date) collision means someone submitted
                # between the two reads. That is a pass, not a failure.
                if "23505" in str(e) or "duplicate key" in str(e).lower():
                    continue
                logger.error(f"sweep_missed insert failed for {uid}: {e}")
                continue

            WalletService.set_hold(uid, True, HOLD_REASON)
            held += 1

        logger.info(f"Attendance sweep {day}: {held} held of {len(collectors)} verified")
        return {"held": held, "checked": len(collectors), "date": day}

    # ── Reads ─────────────────────────────────────────────────────────────

    @staticmethod
    def today(provider_user_id: str) -> dict:
        """Today's attendance card for the provider dashboard."""
        deadline_str = AttendanceService.deadline()
        today = AttendanceService._today_ist()

        if not supabase:
            return {"submitted": False, "deadline": deadline_str, "date": today}

        log = _first(
            supabase.table("attendance_logs")
            .select("*")
            .eq("provider_user_id", provider_user_id)
            .eq("log_date", today)
            .limit(1)
            .execute()
        )
        wallet = WalletService.ensure_wallet(provider_user_id)

        return {
            "date": today,
            "deadline": deadline_str,
            "submitted": bool(log) and log.get("status") != "missed",
            "status": log.get("status") if log else "not_submitted",
            "is_late": bool(log.get("is_late")) if log else False,
            "selfie_url": log.get("selfie_url", "") if log else "",
            "on_hold": bool(wallet.get("on_hold")),
            "hold_reason": wallet.get("hold_reason") or "",
        }

    @staticmethod
    def history(provider_user_id: str, limit: int = 30) -> list:
        if not supabase:
            return []
        try:
            return _rows(
                supabase.table("attendance_logs")
                .select("*")
                .eq("provider_user_id", provider_user_id)
                .order("log_date", desc=True)
                .limit(limit)
                .execute()
            )
        except Exception as e:
            logger.error(f"attendance history failed for {provider_user_id}: {e}")
            return []
