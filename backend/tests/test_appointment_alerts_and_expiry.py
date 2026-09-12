"""
Unit & Integration Tests for AppointmentAlertService and Stale Booking Expiration.
"""
import pytest
from datetime import datetime, timezone, timedelta
from app.services.appointment_alerts import AppointmentAlertService
from app.routers.bookings import auto_expire_stale_bookings


class FakeTable:
    def __init__(self, data):
        self._data = data
        self._filtered = list(data)
        self._action = "select"
        self._update_payload = None

    def select(self, *args, **kwargs):
        self._action = "select"
        return self

    def eq(self, field, val):
        self._filtered = [r for r in self._filtered if r.get(field) == val]
        return self

    def in_(self, field, values):
        self._filtered = [r for r in self._filtered if r.get(field) in values]
        return self

    def limit(self, n):
        self._filtered = self._filtered[:n]
        return self

    def update(self, payload):
        self._action = "update"
        if "cancellation_reason" in payload:
            raise Exception("PGRST204: Column cancellation_reason does not exist")
        self._update_payload = payload
        return self

    def insert(self, payload):
        self._action = "insert"
        self._data.append(payload)
        return self

    def execute(self):
        if self._action == "update":
            for r in self._filtered:
                r.update(self._update_payload)
            return type("Result", (), {"data": self._filtered})()
        return type("Result", (), {"data": self._filtered})()


class FakeSupabase:
    def __init__(self, bookings, users=None):
        self.bookings = bookings
        self.users = users or []
        self.notifications = []
        self.history = []
        self.dispatches = []
        self.samples = []

    def table(self, name):
        if name == "bookings":
            return FakeTable(self.bookings)
        elif name == "users":
            return FakeTable(self.users)
        elif name == "notifications":
            return FakeTable(self.notifications)
        elif name == "booking_history":
            return FakeTable(self.history)
        elif name == "dispatch_requests":
            return FakeTable(self.dispatches)
        elif name == "patient_samples":
            return FakeTable(self.samples)
        elif name == "doctors":
            return FakeTable([])
        return FakeTable([])


@pytest.mark.asyncio
async def test_appointment_day_alerts_pass(monkeypatch):
    """Ensure confirmed appointments for today send alerts to patient and doctor."""
    ist_now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    today_ist = ist_now.strftime("%Y-%m-%d")

    bookings_data = [
        {
            "id": "b-today-1",
            "patient_id": "user-patient-1",
            "provider_id": "user-doc-1",
            "service_type": "doctor_appointment",
            "slot_start": f"{today_ist}T17:30:00+05:30",
            "status": "confirmed",
            "reminder_sent": False,
            "notes": "Doctor: Dr. Naidu",
        },
        {
            "id": "b-future-1",
            "patient_id": "user-patient-1",
            "provider_id": "user-doc-1",
            "service_type": "doctor_appointment",
            "slot_start": "2030-01-01T10:00:00+05:30",
            "status": "confirmed",
            "reminder_sent": False,
            "notes": "Future consult",
        }
    ]

    users_data = [
        {"id": "user-patient-1", "full_name": "Rohan Sharma", "email": "rohan@example.com"},
        {"id": "user-doc-1", "full_name": "Dr. Naidu", "email": "naidu@example.com", "role": "doctor"}
    ]

    fake_sb = FakeSupabase(bookings_data, users_data)
    monkeypatch.setattr("app.services.appointment_alerts.supabase", fake_sb)
    monkeypatch.setattr("app.services.notification_engine.supabase", fake_sb)

    res = await AppointmentAlertService.run_appointment_alerts_pass(target_date_ist=today_ist)
    assert res["status"] == "success"
    assert res["sent_count"] == 1

    # Check that booking b-today-1 marked reminded
    assert bookings_data[0]["reminder_sent"] is True
    assert bookings_data[1]["reminder_sent"] is False

    # Check notifications sent for both patient and doctor across in_app and push channels (total 4)
    notifs = fake_sb.notifications
    assert len(notifs) == 4

    patient_inapp = next((n for n in notifs if n["user_id"] == "user-patient-1" and n["channel"] == "in_app"), None)
    patient_push = next((n for n in notifs if n["user_id"] == "user-patient-1" and n["channel"] == "push"), None)
    doc_inapp = next((n for n in notifs if n["user_id"] == "user-doc-1" and n["channel"] == "in_app"), None)
    doc_push = next((n for n in notifs if n["user_id"] == "user-doc-1" and n["channel"] == "push"), None)

    assert patient_inapp is not None
    assert "Appointment Today" in patient_inapp["title"]
    assert "Dr. Naidu" in patient_inapp["title"]
    assert patient_push is not None

    assert doc_inapp is not None
    assert "Rohan Sharma" in doc_inapp["title"]
    assert doc_push is not None


@pytest.mark.asyncio
async def test_appointment_alerts_idempotent(monkeypatch):
    """Ensure running alert pass multiple times does not send duplicate notifications."""
    ist_now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    today_ist = ist_now.strftime("%Y-%m-%d")

    bookings_data = [
        {
            "id": "b-today-1",
            "patient_id": "user-patient-1",
            "provider_id": "user-doc-1",
            "service_type": "doctor_appointment",
            "slot_start": f"{today_ist}T17:30:00+05:30",
            "status": "confirmed",
            "reminder_sent": True,  # Already reminded
            "notes": "Doctor: Dr. Naidu",
        }
    ]

    fake_sb = FakeSupabase(bookings_data)
    monkeypatch.setattr("app.services.appointment_alerts.supabase", fake_sb)

    res = await AppointmentAlertService.run_appointment_alerts_pass(target_date_ist=today_ist)
    assert res["sent_count"] == 0
    assert len(fake_sb.notifications) == 0


@pytest.mark.asyncio
async def test_ready_ping_doctor_to_patient(monkeypatch):
    """Doctor pings patient when in exam room."""
    bookings_data = [
        {
            "id": "b-active-1",
            "patient_id": "user-patient-1",
            "provider_id": "user-doc-1",
            "service_type": "video_consult",
            "status": "confirmed",
        }
    ]
    users_data = [
        {"id": "user-doc-1", "full_name": "L. S. Naidu", "role": "doctor"},
        {"id": "user-patient-1", "full_name": "Rohan Sharma", "role": "patient"}
    ]
    fake_sb = FakeSupabase(bookings_data, users_data)
    monkeypatch.setattr("app.services.appointment_alerts.supabase", fake_sb)
    monkeypatch.setattr("app.services.notification_engine.supabase", fake_sb)

    ping_res = await AppointmentAlertService.send_consultation_ready_ping(
        booking_id="b-active-1",
        sender_user_id="user-doc-1",
        sender_role="doctor"
    )
    assert ping_res["success"] is True
    # Patient should have received an in-app and push ping
    assert len(fake_sb.notifications) == 2
    assert fake_sb.notifications[0]["user_id"] == "user-patient-1"
    assert "Waiting in Exam Room" in fake_sb.notifications[0]["title"]
