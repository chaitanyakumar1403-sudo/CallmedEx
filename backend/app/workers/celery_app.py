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

# ─── SSL fix for managed Redis (Upstash, Render, etc.) ─────────────────
# Kombu (Celery's transport layer) requires explicit ssl_cert_reqs for
# rediss:// URLs. Without it, *every* .delay() call fails silently with:
#   "A rediss:// URL must have parameter ssl_cert_reqs ..."
# This breaks all background tasks: notifications, dispatch, roster.
if REDIS_URL.startswith("rediss://") and "ssl_cert_reqs" not in REDIS_URL:
    _sep = "&" if "?" in REDIS_URL else "?"
    REDIS_URL = f"{REDIS_URL}{_sep}ssl_cert_reqs=CERT_NONE"

# ─── Celery App ────────────────────────────────────────────────────────────
celery_app = Celery(
    "callmedex",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "app.workers.tasks.notifications",
        "app.workers.tasks.dispatch",
        "app.workers.tasks.dispatch_retry",
        "app.workers.tasks.payments",
        "app.workers.tasks.cleanup",
        # Both of these were scheduled below but missing from `include`,
        # which means Celery's beat scheduler would enqueue them while the
        # worker process never imported/registered the task — every firing
        # would fail with "Received unregistered task".
        "app.workers.tasks.attendance",
        "app.workers.tasks.roster",
        "app.workers.tasks.scheduled_dispatch",
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
        # Runs 15 minutes past the 05:15 IST selfie deadline, so a collector
        # submitting right on the cut-off is not swept in a race.
        "sweep-missed-attendance": {
            "task": "app.workers.tasks.attendance.sweep_missed_attendance",
            "schedule": crontab(hour=5, minute=30),
        },
        # Advance-assign tomorrow's home-collection bookings every evening.
        # Previously only reachable via a manual staff-triggered endpoint —
        # a centre that forgot to run it left every scheduled booking for
        # the next day unassigned with no automatic recovery.
        "run-advance-roster": {
            "task": "app.workers.tasks.roster.run_advance_roster_for_all_centres",
            "schedule": crontab(hour=18, minute=0),  # 6:00 PM IST daily
        },
        # Catches same-day (or "booked after today's roster pass already
        # ran") scheduled home-collection bookings that neither the
        # immediate on_demand| path nor the once-nightly advance roster pass
        # will ever dispatch otherwise.
        "trigger-upcoming-scheduled-dispatch": {
            "task": "app.workers.tasks.scheduled_dispatch.trigger_dispatch_for_upcoming_bookings",
            "schedule": crontab(minute="*/10"),  # Every 10 minutes
        },
    },
)
