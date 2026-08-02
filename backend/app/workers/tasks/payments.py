"""
Payment background tasks.
Processes pending provider settlements and requests payment-receipt
WhatsApp notifications from MediAssist AI — CallMedex never sends WhatsApp
messages itself (see docs/integrations/mediassist-ai/).
"""
import asyncio
import logging
from datetime import datetime, timezone
from app.workers.celery_app import celery_app
from app.database import supabase
from app.integrations.mediassist_client import mediassist_client, MediAssistError

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Bridge a Celery task's sync context to the async MediAssist client."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.workers.tasks.payments.process_pending_settlements", bind=True)
def process_pending_settlements(self):
    """
    Daily 2AM IST: Move captured payments to settled status for providers.
    In production: triggers Razorpay Route transfers to provider bank accounts.
    """
    if not supabase:
        return {"settled": 0}

    try:
        # Find all captured (but not yet settled) payments
        result = (
            supabase.table("payments")
            .select("id, provider_id, provider_payout, razorpay_payment_id")
            .eq("status", "captured")
            .execute()
        )

        payments = result.data or []
        settled_count = 0
        now = datetime.now(timezone.utc).isoformat()

        for payment in payments:
            try:
                if not payment.get("provider_id"):
                    continue

                # In production: initiate Razorpay Route transfer here
                # client.transfer.create({...})

                # Update payment to settled
                supabase.table("payments").update({
                    "status": "settled",
                    "settled_at": now,
                    "updated_at": now,
                }).eq("id", payment["id"]).execute()

                # Create settlement record
                supabase.table("settlements").insert({
                    "provider_id": payment["provider_id"],
                    "payment_id": payment["id"],
                    "amount": payment.get("provider_payout", 0),
                    "status": "completed",
                    "settlement_date": datetime.now(timezone.utc).date().isoformat(),
                    "completed_at": now,
                }).execute()

                settled_count += 1
            except Exception as pay_err:
                logger.error(f"Settlement failed for payment {payment['id']}: {pay_err}")

        logger.info(f"Settled {settled_count}/{len(payments)} payments")
        return {"settled": settled_count, "total": len(payments)}

    except Exception as e:
        logger.error(f"process_pending_settlements failed: {e}")
        raise self.retry(exc=e, countdown=300)  # Retry in 5 minutes


@celery_app.task(name="app.workers.tasks.payments.send_payment_receipt")
def send_payment_receipt(patient_mobile: str, patient_name: str, amount: float, booking_id: str, payment_id: str):
    """
    Async task: Send payment receipt via WhatsApp after successful payment.
    """
    try:
        _run_async(mediassist_client.send_notification(
            channel="whatsapp",
            recipient={"phone": patient_mobile},
            template="payment_receipt",
            template_data={
                "patient_name": patient_name,
                "amount_inr": amount,
                "booking_reference": booking_id,
                "payment_reference": payment_id,
            },
        ))
    except MediAssistError as e:
        logger.error(f"Payment receipt notification failed: {e}")
