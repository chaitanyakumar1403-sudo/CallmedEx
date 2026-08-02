"""
Payment Service — Phase 6D
Razorpay integration for creating orders, verifying payments,
and initiating settlements to providers.
"""
import uuid
import hmac
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from app.config import settings
from app.database import supabase

logger = logging.getLogger(__name__)

# Platform commission rate (15% as per MOU)
PLATFORM_COMMISSION_RATE = 0.15


def _get_razorpay_client():
    """Lazy-load the Razorpay client."""
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        return None
    try:
        import razorpay
        return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    except ImportError:
        logger.error("razorpay package not installed. Run: pip install razorpay")
        return None


class PaymentService:

    @staticmethod
    def signature_is_valid(order_id, payment_id, signature, secret) -> bool:
        if not (order_id and payment_id and signature and secret):
            return False
        expected = hmac.new(
            secret.encode("utf-8"),
            f"{order_id}|{payment_id}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    @staticmethod
    def amounts_match(order_amount, paid_amount) -> bool:
        try:
            return abs(float(order_amount) - float(paid_amount)) < 0.01
        except (TypeError, ValueError):
            return False

    @staticmethod
    def create_order(
        amount: float,
        booking_id: str,
        patient_id: str,
        provider_id: str = None,
        description: str = "",
    ) -> Dict[str, Any]:
        """
        Create a Razorpay order for a booking.
        Amount should be in INR (e.g., 500.00).
        Returns: { order_id, razorpay_order_id, amount, key_id }
        """
        payment_id = str(uuid.uuid4())
        amount_paise = int(amount * 100)  # Razorpay uses paise

        platform_fee = round(amount * PLATFORM_COMMISSION_RATE, 2)
        provider_payout = round(amount - platform_fee, 2)

        receipt = f"rcpt_{payment_id[:8]}"

        client = _get_razorpay_client()
        razorpay_order_id = None

        if client:
            try:
                rz_order = client.order.create({
                    "amount": amount_paise,
                    "currency": "INR",
                    "receipt": receipt,
                    "notes": {
                        "booking_id": booking_id,
                        "patient_id": patient_id,
                        "platform": "CallMedex",
                    },
                })
                razorpay_order_id = rz_order["id"]
                logger.info(f"Razorpay order created: {razorpay_order_id}")
            except Exception as e:
                logger.error(f"Razorpay order creation failed: {e}")
                raise ValueError(f"Payment gateway error: {str(e)}")
        else:
            # Simulate for development
            razorpay_order_id = f"order_dev_{uuid.uuid4().hex[:12]}"
            logger.warning("Razorpay not configured — using simulated order ID")

        # Store in database
        payment_record = {
            "id": payment_id,
            "booking_id": booking_id,
            "patient_id": patient_id,
            "provider_id": provider_id,
            "amount": amount,
            "platform_fee": platform_fee,
            "provider_payout": provider_payout,
            "currency": "INR",
            "razorpay_order_id": razorpay_order_id,
            "status": "created",
            "description": description,
            "receipt_number": receipt,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if supabase:
            try:
                supabase.table("payments").insert(payment_record).execute()
            except Exception as e:
                logger.warning(f"Could not save payment to DB: {e}")

        return {
            "payment_id": payment_id,
            "razorpay_order_id": razorpay_order_id,
            "amount": amount,
            "amount_paise": amount_paise,
            "key_id": settings.RAZORPAY_KEY_ID or "rzp_test_DEMO",
            "currency": "INR",
            "receipt": receipt,
            "description": description,
        }

    @staticmethod
    def verify_payment(
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> Dict[str, Any]:
        """
        Verify payment signature from Razorpay callback.
        Returns: { verified: bool, payment_id, status }
        """
        client = _get_razorpay_client()

        # Fail closed: no configured secret or an invalid signature means unverified.
        if not settings.RAZORPAY_KEY_SECRET or not PaymentService.signature_is_valid(
            razorpay_order_id, razorpay_payment_id, razorpay_signature, settings.RAZORPAY_KEY_SECRET
        ):
            logger.warning(f"Payment signature invalid/missing for {razorpay_order_id}")
            return {"verified": False, "error": "Invalid payment signature"}

        # Amount check: stored order amount (rupees) vs Razorpay-captured amount (paise -> rupees)
        stored_amount = None
        if supabase:
            row = supabase.table("payments").select("amount").eq("razorpay_order_id", razorpay_order_id).execute()
            if row.data:
                stored_amount = row.data[0]["amount"]

        try:
            captured = client.payment.fetch(razorpay_payment_id)
            captured_rupees = float(captured.get("amount", 0)) / 100.0
        except Exception as e:
            logger.error(f"Could not fetch payment for amount check: {e}")
            return {"verified": False, "error": "Could not confirm payment amount"}

        if stored_amount is None or not PaymentService.amounts_match(stored_amount, captured_rupees):
            logger.warning(f"Amount check failed on {razorpay_order_id}: stored={stored_amount} captured={captured_rupees}")
            return {"verified": False, "error": "Amount could not be confirmed"}

        # Update payment status in DB — with race-condition protection
        # Only update if the payment is still in "created" status (idempotent guard).
        # If it's already "captured", this is a duplicate callback and we return
        # the existing record without re-confirming the booking.
        now = datetime.now(timezone.utc).isoformat()
        if supabase:
            try:
                # First check current status to prevent double-processing
                current = (
                    supabase.table("payments")
                    .select("id, status, booking_id, amount")
                    .eq("razorpay_order_id", razorpay_order_id)
                    .limit(1)
                    .execute()
                )

                if not current.data:
                    return {"verified": False, "error": "Payment record not found"}

                existing = current.data[0]

                # Idempotent: if already captured, return the existing record
                if existing.get("status") == "captured":
                    logger.info(
                        f"Payment {razorpay_order_id} already captured — "
                        "duplicate callback ignored."
                    )
                    return {
                        "verified": True,
                        "payment_id": existing["id"],
                        "booking_id": existing.get("booking_id"),
                        "amount": existing["amount"],
                        "status": "captured",
                        "duplicate": True,
                    }

                # Only transition from "created" to "captured"
                if existing.get("status") != "created":
                    logger.warning(
                        f"Payment {razorpay_order_id} has unexpected status "
                        f"'{existing.get('status')}' — cannot capture."
                    )
                    return {"verified": False, "error": f"Payment is in '{existing.get('status')}' state, not 'created'"}

                # Atomic update — only capture if still "created"
                result = (
                    supabase.table("payments")
                    .update({
                        "razorpay_payment_id": razorpay_payment_id,
                        "razorpay_signature": razorpay_signature,
                        "status": "captured",
                        "captured_at": now,
                        "updated_at": now,
                    })
                    .eq("razorpay_order_id", razorpay_order_id)
                    .eq("status", "created")  # ← optimistic lock: only update if still "created"
                    .execute()
                )

                if result.data:
                    payment = result.data[0]

                    # Also update booking status to confirmed, but ONLY if
                    # the booking is in a pre-confirmation state (not cancelled/completed)
                    booking_id = payment.get("booking_id")
                    if booking_id:
                        try:
                            # Only confirm bookings that are awaiting payment
                            confirmable_statuses = [
                                "pending", "pending_review", "slot_allotted",
                                "slot_accepted", "pending_payment",
                            ]
                            supabase.table("bookings").update({
                                "status": "confirmed",
                                "payment_status": "paid",
                                "updated_at": now,
                            }).eq("id", booking_id).in_("status", confirmable_statuses).execute()
                        except Exception as e:
                            logger.error(f"Failed to update booking {booking_id}: {e}")

                    PaymentService._notify_payment_receipt(payment)

                    return {
                        "verified": True,
                        "payment_id": payment["id"],
                        "booking_id": booking_id,
                        "amount": payment["amount"],
                        "status": "captured",
                    }

                # If the update returned 0 rows, another callback already captured it
                return {"verified": False, "error": "Payment was already processed"}

            except Exception as e:
                logger.error(f"DB update after payment verification failed: {e}")
                return {"verified": False, "error": "Could not record payment"}

        return {"verified": False, "error": "Payment record not found"}

    @staticmethod
    def _notify_payment_receipt(payment: Dict[str, Any]) -> None:
        """Best-effort WhatsApp receipt via MediAssist AI. Never raises —
        a notification failure must never affect a payment that already
        captured successfully."""
        if not supabase:
            return
        try:
            patient_id = payment.get("patient_id")
            if not patient_id:
                return
            patient_res = (
                supabase.table("users").select("full_name, mobile")
                .eq("id", patient_id).limit(1).execute()
            )
            if not patient_res.data or not patient_res.data[0].get("mobile"):
                return
            patient = patient_res.data[0]

            from app.workers.tasks.payments import send_payment_receipt
            send_payment_receipt.delay(
                patient_mobile=patient["mobile"],
                patient_name=patient.get("full_name", "Patient"),
                amount=payment["amount"],
                booking_id=payment.get("booking_id", ""),
                payment_id=payment["id"],
            )
        except Exception as e:
            logger.warning(f"Payment receipt notification enqueue failed for {payment.get('id')}: {e}")

    @staticmethod
    def get_patient_transactions(patient_id: str, limit: int = 20) -> list:
        """Get payment history for a patient."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("payments")
                .select("id, amount, status, description, created_at, razorpay_payment_id, payment_method")
                .eq("patient_id", patient_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.warning(f"Could not fetch transactions: {e}")
            return []

    @staticmethod
    def get_provider_earnings(provider_id: str, limit: int = 20) -> Dict[str, Any]:
        """Get earnings summary and recent transactions for a provider."""
        if not supabase:
            return {"total_earned": 0, "pending_settlement": 0, "transactions": []}

        try:
            # Get all captured payments for this provider
            result = (
                supabase.table("payments")
                .select("id, amount, provider_payout, platform_fee, status, description, created_at")
                .eq("provider_id", provider_id)
                .in_("status", ["captured", "settled"])
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )

            transactions = result.data or []
            total_earned = sum(t.get("provider_payout", 0) for t in transactions)
            settled = sum(t.get("provider_payout", 0) for t in transactions if t["status"] == "settled")

            return {
                "total_earned": round(total_earned, 2),
                "settled": round(settled, 2),
                "pending_settlement": round(total_earned - settled, 2),
                "transactions": transactions,
            }
        except Exception as e:
            logger.warning(f"Could not fetch earnings: {e}")
            return {"total_earned": 0, "pending_settlement": 0, "transactions": []}
