"""
Attendance background tasks.

Sweeps for missed daily selfies after the cut-off and places a payment hold on
the collectors who did not submit. Enforcement is deliberately financial: a
dispatch block would penalise the patient who already booked.
"""
import logging

from app.workers.celery_app import celery_app
from app.services.attendance import AttendanceService

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.tasks.attendance.sweep_missed_attendance", bind=True)
def sweep_missed_attendance(self):
    """Run shortly after the 05:15 IST deadline, once per day."""
    try:
        result = AttendanceService.sweep_missed()
        logger.info(f"Attendance sweep complete: {result}")
        return result
    except Exception as e:
        logger.error(f"sweep_missed_attendance failed: {e}")
        return {"held": 0, "error": str(e)}
