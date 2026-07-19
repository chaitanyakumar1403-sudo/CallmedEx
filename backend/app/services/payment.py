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

        if client:
            try:
                # Verify signature
                body = f"{razorpay_order_id}|{razorpay_payment_id}"
                expected_signature = hmac.new(
                    settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
                    body.encode("utf-8"),
                    hashlib.sha256,
                ).hexdigest()

                if expected_signature != razorpay_signature:
                    logger.warning(f"Payment signature mismatch for order {razorpay_order_id}")
                    return {"verified": False, "error": "Invalid payment signature"}
            except Exception as e:
                logger.error(f"Signature verification error: {e}")
                # Don't fail — continue with db update
        else:
            logger.warning("Razorpay not configured — skipping signature verification")

        # Update payment status in DB
        now = datetime.now(timezone.utc).isoformat()
        if supabase:
            try:
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
                    .execute()
                )

                if result.data:
                    payment = result.data[0]

                    # Also update booking status to confirmed
                    if payment.get("booking_id"):
                        try:
                            supabase.table("bookings").update({
                                "status": "confirmed",
                                "payment_status": "paid",
                                "updated_at": now,
                            }).eq("id", payment["booking_id"]).execute()
                        except Exception:
                            pass

                    return {
                        "verified": True,
                        "payment_id": payment["id"],
                        "booking_id": payment.get("booking_id"),
                        "amount": payment["amount"],
                        "status": "captured",
                    }
            except Exception as e:
                logger.error(f"DB update after payment verification failed: {e}")

        return {"verified": True, "status": "captured", "razorpay_order_id": razorpay_order_id}

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
