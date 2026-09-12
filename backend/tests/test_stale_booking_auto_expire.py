"""
Test Stale Booking Auto-Refutation / Cancellation
Verifies that bookings with dates in the past (yesterday or older) that remain unserviced
are automatically cancelled and refunded/refuted in the database.
"""
import pytest
from datetime import datetime, timezone, timedelta
from app.routers.bookings import auto_expire_stale_bookings


class FakeSupabaseTable:
    def __init__(self, data):
        self._data = data
        self._filtered = list(data)
        self._action = "select"
        self._update_payload = None

    def select(self, *args, **kwargs):
        self._action = "select"
        return self

    def in_(self, field, values):
        self._filtered = [r for r in self._filtered if r.get(field) in values]
        return self

    def eq(self, field, val):
        self._filtered = [r for r in self._filtered if r.get(field) == val]
        return self

    def limit(self, n):
        self._filtered = self._filtered[:n]
        return self

    def update(self, payload):
        self._action = "update"
        # Schema guard: Ensure no non-existent columns like cancellation_reason are sent to bookings
        if "cancellation_reason" in payload:
            raise Exception("PGRST204: Could not find the 'cancellation_reason' column of 'bookings' in the schema cache")
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


class FakeSupabaseClient:
    def __init__(self, bookings_data, samples_data=None, dispatches_data=None):
        self.bookings_data = bookings_data
        self.samples_data = samples_data or []
        self.dispatches_data = dispatches_data or []
        self.history_data = []
        self.notifications_data = []

    def table(self, name):
        if name == "bookings":
            return FakeSupabaseTable(self.bookings_data)
        elif name == "patient_samples":
            return FakeSupabaseTable(self.samples_data)
        elif name == "dispatch_requests":
            return FakeSupabaseTable(self.dispatches_data)
        elif name == "booking_history":
            return FakeSupabaseTable(self.history_data)
        elif name == "notifications":
            return FakeSupabaseTable(self.notifications_data)
        return FakeSupabaseTable([])


def test_auto_expire_yesterday_booking(monkeypatch):
    """A booking scheduled for yesterday with no provider fulfillment is cancelled."""
    yesterday_ist = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30) - timedelta(days=1)).strftime("%Y-%m-%d")
    
    stale_booking = {
        "id": "b-yesterday-1",
        "patient_id": "p-123",
        "service_type": "doctor_consultation",
        "slot_start": f"{yesterday_ist}T10:00:00+05:30",
        "status": "confirmed",
        "notes": "Consultation with Cardiologist",
    }
    future_booking = {
        "id": "b-future-1",
        "patient_id": "p-123",
        "service_type": "lab_test",
        "slot_start": "2030-01-01T10:00:00+05:30",
        "status": "confirmed",
        "notes": "Future Lipid Profile",
    }

    fake_client = FakeSupabaseClient([stale_booking, future_booking])
    monkeypatch.setattr("app.routers.bookings.supabase", fake_client)

    expired = auto_expire_stale_bookings("p-123")
    assert expired == 1
    assert stale_booking["status"] == "cancelled"
    assert "Auto-Refuted" in stale_booking["notes"]
    assert future_booking["status"] == "confirmed"
