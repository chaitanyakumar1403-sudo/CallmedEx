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

# Every partner MOU fixes the same split — 20% platform fee, 80% to the
# provider (doctor, dental, dietitian, nursing, physiotherapy, diagnostic,
# ECG/X-ray). Phlebotomists are the one exception: they are engaged salaried
# or per verified collection, not on a percentage.
#
# The live figure comes from PricingService.platform_fee_pct() so operations
# can move it from platform_settings without a deploy. This constant is the
# fallback that function itself falls back to, kept only so the module reads
# without a lookup; never compute a split from it directly.
PLATFORM_COMMISSION_RATE = 0.20


def _platform_fee_rate() -> float:
    """The platform's share as a fraction, from the one place that defines it."""
    from app.services.marketplace import PricingService

    return PricingService.platform_fee_pct() / 100.0


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
    def resolve_booking_payee(booking_id: str) -> Optional[str]:
        """The users.id whose payout ledger this booking's payment belongs to.

        create_order took provider_id straight from the request body, optional
        and unchecked. Two ways that went wrong:

          * a client that simply omitted it (the schema allows it) wrote a
            payment with no provider at all, so get_provider_earnings — which
            filters on payments.provider_id — reported zero to a provider who
            had been paid;
          * anyone could name somebody else's id and credit their ledger.

        bookings.provider_id is the server's own record of who is owed. For
        diagnostics it holds organizations.id rather than a users.id (see the
        allocation in routers/bookings.create_booking), so resolve that through
        to the organisation's login user — otherwise the centre's earnings page
        is empty for the same reason.

        Returns None only when the booking or provider cannot be read; the
        caller keeps its existing behaviour in that case.
        """
        if not supabase:
            return None
        try:
            rows = (
                supabase.table("bookings")
                .select("provider_id, provider_type")
                .eq("id", booking_id)
                .limit(1)
                .execute()
            ).data or []
            if not rows:
                return None
            provider_id = rows[0].get("provider_id")
            if not provider_id:
                return None

            user_rows = (
                supabase.table("users").select("id")
                .eq("id", provider_id).limit(1).execute()
            ).data or []
            if user_rows:
                return provider_id

            org_rows = (
                supabase.table("organizations").select("user_id")
                .eq("id", provider_id).limit(1).execute()
            ).data or []
            if org_rows and org_rows[0].get("user_id"):
                return org_rows[0]["user_id"]
            return None
        except Exception as e:
            logger.warning(
                f"Could not resolve the payee for booking {booking_id}: {e}"
            )
            return None

    @staticmethod
    def resolve_booking_amount(booking_id: str, patient_id: str) -> float:
        """The rupee amount this patient actually owes for this booking, read
        from the server's own records.

        create_order used to bill whatever figure the caller put in the request
        body, so a 4,000 rupee collection could be settled with 1 rupee and
        verify_payment would still confirm it — the signature and amount checks
        there both compare against that same client-supplied number, so nothing
        downstream could catch it.

        Preference order matters. booking_tests.price_charged is written by the
        server from the catalog at booking time, so it is the one figure no
        client has ever touched. bookings.total_price / final_amount is the
        client's own number and is used only where there are no priced test rows
        (consultations, home visits), because it is still the best record we hold.

        Raises PermissionError when the booking is not this patient's, and
        LookupError when it does not exist — a payment must never be attachable
        to somebody else's booking.
        """
        if not supabase:
            raise LookupError("Booking records are unavailable.")

        rows = (
            supabase.table("bookings")
            .select("id, patient_id, total_price, final_amount")
            .eq("id", booking_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise LookupError("Booking not found.")

        booking = rows[0]
        if str(booking.get("patient_id")) != str(patient_id):
            raise PermissionError("This booking belongs to another patient.")

        priced = (
            supabase.table("booking_tests")
            .select("price_charged")
            .eq("booking_id", booking_id)
            .execute()
        ).data or []
        tests_total = sum(float(r.get("price_charged") or 0) for r in priced)
        if tests_total > 0:
            return round(tests_total, 2)

        fallback = booking.get("final_amount")
        if fallback is None:
            fallback = booking.get("total_price")
        try:
            return round(float(fallback or 0), 2)
        except (TypeError, ValueError):
            return 0.0

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

        platform_fee = round(amount * _platform_fee_rate(), 2)
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
            if settings.APP_ENV == "development" and settings.ENABLE_DEV_MOCK_PAYMENT:
                # Simulate strictly for local development
                razorpay_order_id = f"order_dev_{uuid.uuid4().hex[:12]}"
                logger.warning("Razorpay not configured — using simulated order ID in local development mode")
            else:
                logger.error("Razorpay payment gateway credentials not configured on backend.")
                raise ValueError("Online payment is currently unavailable. Payment gateway is not configured.")

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
