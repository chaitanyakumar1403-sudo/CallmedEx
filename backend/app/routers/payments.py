"""
Payments Router — Phase 6D
Patient payment flow: create order → Razorpay checkout → verify → confirm booking.
Provider earnings dashboard endpoint.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from app.middleware.auth import get_current_user
from app.services.payment import PaymentService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payments", tags=["Payments"])


class CreateOrderRequest(BaseModel):
    booking_id: str
    # The caller may still send what it believes the price to be, but it is
    # only ever cross-checked against the server's own figure — never charged.
    # Existing mobile clients send it; new ones can omit it entirely.
    amount: Optional[float] = Field(default=None, gt=0, description="Amount in INR (cross-check only)")
    provider_id: Optional[str] = None
    description: Optional[str] = "CallMedex Booking Payment"


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/create-order")
async def create_order(
    body: CreateOrderRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Patient creates a payment order for a booking.
    Returns Razorpay order_id and key_id for the frontend checkout widget.
    """
    # The amount is resolved from the booking, never taken from the request.
    # Billing the client's own figure meant a patient could open an order for
    # any rupee value they liked — and verify_payment, which compares the
    # captured amount against that stored order, would then confirm it.
    try:
        amount = PaymentService.resolve_booking_amount(
            booking_id=body.booking_id, patient_id=current_user["sub"]
        )
    except PermissionError:
        raise HTTPException(status_code=403, detail="This booking is not yours.")
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if amount <= 0:
        raise HTTPException(
            status_code=409,
            detail="This booking has no payable amount on record. Please contact support.",
        )

    # A client figure that disagrees with ours means the two are out of sync
    # (stale cart, changed catalog price). Refuse rather than silently charging
    # a different number than the patient was shown.
    if body.amount is not None and abs(float(body.amount) - amount) >= 0.01:
        raise HTTPException(
            status_code=409,
            detail=f"Amount mismatch. The amount payable for this booking is Rs {amount:.2f}.",
        )

    try:
        result = PaymentService.create_order(
            amount=amount,
            booking_id=body.booking_id,
            patient_id=current_user["sub"],
            provider_id=body.provider_id,
            description=body.description or "CallMedex Booking Payment",
        )
        return {"success": True, "order": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Create order error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment order")


@router.post("/verify")
async def verify_payment(
    body: VerifyPaymentRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Frontend sends Razorpay callback data after successful checkout.
    Verifies the signature and updates the payment + booking status.
    """
    try:
        result = PaymentService.verify_payment(
            razorpay_order_id=body.razorpay_order_id,
            razorpay_payment_id=body.razorpay_payment_id,
            razorpay_signature=body.razorpay_signature,
        )

        if result.get("verified"):
            return {
                "success": True,
                "message": "Payment verified and booking confirmed!",
                "data": result,
            }
        else:
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Payment verification failed"),
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verify payment error: {e}")
        raise HTTPException(status_code=500, detail="Payment verification failed")


@router.get("/my-transactions")
async def my_transactions(
    current_user: dict = Depends(get_current_user),
):
    """Patient views their payment history."""
    transactions = PaymentService.get_patient_transactions(current_user["sub"])
    return {"success": True, "transactions": transactions}


@router.get("/my-earnings")
async def my_earnings(
    current_user: dict = Depends(get_current_user),
):
    """Provider views their earnings and settlement summary."""
    earnings = PaymentService.get_provider_earnings(current_user["sub"])
    return {"success": True, "earnings": earnings}
