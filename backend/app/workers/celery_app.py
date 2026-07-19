"""
Celery Worker Configuration — Phase 7B
Background task processing for CallMedex.
Uses Redis as broker and result backend.

Start worker: celery -A app.workers.celery_app worker --loglevel=info
Start beat scheduler: celery -A app.workers.celery_app beat --loglevel=info
"""
import os
import logging
from celery import Celery
from celery.schedules import crontab

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ─── Celery App ────────────────────────────────────────────────────────────
celery_app = Celery(
    "callmedex",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "app.workers.tasks.notifications",
        "app.workers.tasks.dispatch",
        "app.workers.tasks.payments",
        "app.workers.tasks.cleanup",
    ],
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Timezone
    timezone="Asia/Kolkata",
    enable_utc=True,

    # Performance
    worker_prefetch_multiplier=1,      # Fair task distribution
    task_acks_late=True,               # Re-queue if worker crashes
    task_reject_on_worker_lost=True,   # Safety net for crashes
    worker_max_tasks_per_child=200,    # Prevent memory leaks

    # Results
    result_expires=3600,               # Results kept for 1 hour
    task_always_eager=False,           # Always use real async workers

    # Retry
    task_default_retry_delay=30,       # 30s default retry delay
    task_max_retries=3,                # Max 3 retries per task

    # Beat: scheduled periodic tasks
    beat_schedule={
        # Expire pending dispatches that haven't been accepted in 5 minutes
        "expire-stale-dispatches": {
            "task": "app.workers.tasks.dispatch.expire_stale_dispatches",
            "schedule": crontab(minute="*/5"),  # Every 5 minutes
        },
        # Send appointment reminder 30 minutes before
        "send-appointment-reminders": {
            "task": "app.workers.tasks.notifications.send_appointment_reminders",
            "schedule": crontab(minute="*/10"),  # Every 10 minutes
        },
        # Process pending settlements once a day
        "process-settlements": {
            "task": "app.workers.tasks.payments.process_pending_settlements",
            "schedule": crontab(hour=2, minute=0),  # 2:00 AM IST daily
        },
        # Cleanup expired MOU tokens
        "cleanup-expired-tokens": {
            "task": "app.workers.tasks.cleanup.cleanup_expired_mou_tokens",
            "schedule": crontab(hour=3, minute=0),  # 3:00 AM IST daily
        },
    },
)
