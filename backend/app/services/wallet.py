"""
Provider Wallet Service — CallMedex

Implements the wallet settlement model from the partner MOUs:
  - Phlebotomist (part time): Rs150 per verified collection, monthly settlement.
  - Phlebotomist (full time): salaried, so no per-collection accrual.
  - Doctors / physio / nursing / dental: platform deducts its fee and credits
    the remainder to the provider wallet (MOU "Method 1 - Wallet Settlement").

The wallet is a LEDGER, not a mutable counter. `provider_wallets.balance` is a
cached projection that is always recomputed from `wallet_transactions`, so a
disputed collection is undone with a compensating entry rather than by editing
a balance. That keeps the audit trail intact, which the MOUs require before
monthly settlement ("penalties, deductions, disputes or adjustments will be
reflected before monthly settlement").
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from app.database import supabase

logger = logging.getLogger(__name__)

VALID_REASONS = {
    "collection_payout", "service_payout", "incentive",
    "penalty", "adjustment", "settlement", "reversal",
}


def _rows(result) -> List[dict]:
    """Coerce a Supabase response into a plain list of dicts.

    The client returns loosely-typed JSON, so normalising once here keeps every
    caller free of defensive `or []` / index guards.
    """
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _first(result) -> dict:
    """First row of a Supabase response, or {} when empty."""
    rows = _rows(result)
    return rows[0] if rows else {}


def _num(value) -> float:
    """Best-effort numeric coercion for ledger amounts."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


class WalletService:
    """Ledger-backed provider wallet."""

    # ── Wallet lifecycle ──────────────────────────────────────────────────

    @staticmethod
    def ensure_wallet(provider_user_id: str) -> dict:
        """Return the provider's wallet, creating it on first use."""
        if not supabase:
            return {"provider_user_id": provider_user_id, "balance": 0.0}

        try:
            existing = (
                supabase.table("provider_wallets")
                .select("*")
                .eq("provider_user_id", provider_user_id)
                .execute()
            )
            if existing.data:
                return _first(existing)

            supabase.table("provider_wallets").insert({
                "provider_user_id": provider_user_id,
                "balance": 0.00,
                "lifetime_earned": 0.00,
                "lifetime_paid": 0.00,
            }).execute()
            return {"provider_user_id": provider_user_id, "balance": 0.0}
        except Exception as e:
            logger.error(f"ensure_wallet failed for {provider_user_id}: {e}")
            return {"provider_user_id": provider_user_id, "balance": 0.0}

    # ── Ledger writes ─────────────────────────────────────────────────────

    @staticmethod
    def credit(
        provider_user_id: str,
        amount: float,
        reason: str,
        sample_id: Optional[str] = None,
        booking_id: Optional[str] = None,
        notes: str = "",
        created_by: Optional[str] = None,
    ) -> dict:
        """
        Credit the provider's wallet.

        Idempotent for sample-linked credits: the database carries a partial
        unique index on (sample_id, reason) for credits, so a retried handover
        acceptance raises a duplicate-key error instead of paying twice. That is
        treated as success, because the money is already there.
        """
        return WalletService._write(
            provider_user_id, "credit", amount, reason,
            sample_id=sample_id, booking_id=booking_id,
            notes=notes, created_by=created_by,
        )

    @staticmethod
    def debit(
        provider_user_id: str,
        amount: float,
        reason: str,
        sample_id: Optional[str] = None,
        booking_id: Optional[str] = None,
        notes: str = "",
        created_by: Optional[str] = None,
    ) -> dict:
        """Debit the wallet (penalty, settlement payout, reversal)."""
        return WalletService._write(
            provider_user_id, "debit", amount, reason,
            sample_id=sample_id, booking_id=booking_id,
            notes=notes, created_by=created_by,
        )

    @staticmethod
    def _write(
        provider_user_id: str,
        direction: str,
        amount: float,
        reason: str,
        sample_id: Optional[str] = None,
        booking_id: Optional[str] = None,
        notes: str = "",
        created_by: Optional[str] = None,
    ) -> dict:
        if reason not in VALID_REASONS:
            return {"success": False, "message": f"Invalid wallet reason: {reason}"}
        if amount is None or float(amount) < 0:
            return {"success": False, "message": "Amount must be non-negative"}

        amount = round(float(amount), 2)
        if amount == 0:
            # Full-time phlebotomists are salaried, so their per-collection rate
            # is 0. Skip silently rather than writing noise into the ledger.
            return {"success": True, "skipped": True, "message": "Zero-value entry skipped"}

        if not supabase:
            return {"success": True, "simulated": True, "amount": amount}

        WalletService.ensure_wallet(provider_user_id)

        tx_id = str(uuid.uuid4())
        record = {
            "id": tx_id,
            "provider_user_id": provider_user_id,
            "direction": direction,
            "amount": amount,
            "reason": reason,
            "sample_id": sample_id,
            "booking_id": booking_id,
            "notes": notes,
            "created_by": created_by,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            supabase.table("wallet_transactions").insert(record).execute()
        except Exception as e:
            # 23505 = unique_violation on (sample_id, reason). Already paid.
            if "23505" in str(e) or "duplicate key" in str(e).lower():
                logger.info(
                    f"Wallet {direction} already recorded for sample={sample_id} "
                    f"reason={reason}; treating as success"
                )
                return {
                    "success": True,
                    "duplicate": True,
                    "message": "Already credited for this sample",
                }
            logger.error(f"Wallet {direction} failed for {provider_user_id}: {e}")
            return {"success": False, "message": str(e)}

        balance = WalletService.recompute_balance(provider_user_id)

        # Record the resulting balance on the row for statement rendering.
        try:
            supabase.table("wallet_transactions").update(
                {"balance_after": balance}
            ).eq("id", tx_id).execute()
        except Exception:
            pass

        return {
            "success": True,
            "transaction_id": tx_id,
            "amount": amount,
            "direction": direction,
            "balance": balance,
        }

    # ── Projection ────────────────────────────────────────────────────────

    @staticmethod
    def recompute_balance(provider_user_id: str) -> float:
        """
        Recompute the cached balance from the ledger and persist it.

        Deriving rather than incrementing means a partially-failed write can
        never leave the wallet permanently wrong: the next entry self-heals it.
        """
        if not supabase:
            return 0.0

        try:
            rows = _rows(
                supabase.table("wallet_transactions")
                .select("direction, amount")
                .eq("provider_user_id", provider_user_id)
                .execute()
            )
        except Exception as e:
            logger.error(f"recompute_balance read failed for {provider_user_id}: {e}")
            return 0.0

        earned = sum(_num(r.get("amount")) for r in rows if r.get("direction") == "credit")
        paid = sum(_num(r.get("amount")) for r in rows if r.get("direction") == "debit")
        balance = round(earned - paid, 2)

        try:
            supabase.table("provider_wallets").update({
                "balance": balance,
                "lifetime_earned": round(earned, 2),
                "lifetime_paid": round(paid, 2),
            }).eq("provider_user_id", provider_user_id).execute()
        except Exception as e:
            logger.error(f"recompute_balance write failed for {provider_user_id}: {e}")

        return balance

    # ── Reads ─────────────────────────────────────────────────────────────

    @staticmethod
    def get_summary(provider_user_id: str, limit: int = 50) -> dict:
        """Wallet balance plus recent ledger entries, for the provider dashboard."""
        wallet = WalletService.ensure_wallet(provider_user_id)

        transactions = []
        if supabase:
            try:
                transactions = _rows(
                    supabase.table("wallet_transactions")
                    .select("*")
                    .eq("provider_user_id", provider_user_id)
                    .order("created_at", desc=True)
                    .limit(limit)
                    .execute()
                )
            except Exception as e:
                logger.error(f"get_summary failed for {provider_user_id}: {e}")

        return {
            "balance": _num(wallet.get("balance")),
            "lifetime_earned": _num(wallet.get("lifetime_earned")),
            "lifetime_paid": _num(wallet.get("lifetime_paid")),
            "on_hold": bool(wallet.get("on_hold")),
            "hold_reason": wallet.get("hold_reason") or "",
            "last_settled_at": wallet.get("last_settled_at"),
            "transactions": transactions,
        }

    @staticmethod
    def set_hold(provider_user_id: str, on_hold: bool, reason: str = "") -> dict:
        """
        Place or lift a payment hold.

        The phlebotomist MOUs make payment conditional on the 05:15 selfie and
        on clean collection records, so earnings still accrue to the ledger while
        the payout is withheld. Holding blocks settlement, not accrual.
        """
        if not supabase:
            return {"success": True, "simulated": True}

        WalletService.ensure_wallet(provider_user_id)
        try:
            supabase.table("provider_wallets").update({
                "on_hold": on_hold,
                "hold_reason": reason if on_hold else "",
            }).eq("provider_user_id", provider_user_id).execute()
            return {"success": True, "on_hold": on_hold, "reason": reason}
        except Exception as e:
            logger.error(f"set_hold failed for {provider_user_id}: {e}")
            return {"success": False, "message": str(e)}
