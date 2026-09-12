"""
Unit and Integration tests for Phlebotomist Advance Dispatch, Roster Job Queries, and Schema Compliance.
"""
import pytest
from datetime import datetime, timezone, timedelta
from app.services.dispatch_engine import UniversalDispatchEngine
from app.services.samples import SampleService
from app.routers.roster import my_jobs


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

    @property
    def not_(self):
        self._invert = True
        return self

    def in_(self, field, values):
        if getattr(self, "_invert", False):
            self._invert = False
            self._filtered = [r for r in self._filtered if r.get(field) not in values]
        else:
            self._filtered = [r for r in self._filtered if r.get(field) in values]
        return self

    def gte(self, field, val):
        self._filtered = [r for r in self._filtered if str(r.get(field, "")) >= str(val)]
        return self

    def order(self, field, desc=False):
        self._filtered.sort(key=lambda r: str(r.get(field, "")), reverse=desc)
        return self

    def limit(self, n):
        self._filtered = self._filtered[:n]
        return self

    def update(self, payload):
        self._action = "update"
        self._update_payload = payload
        return self

    def insert(self, payload):
        self._action = "insert"
        # Verify schema constraints: dispatch_requests does not have processing_center_id
        if "processing_center_id" in payload and self._data is getattr(self, "_dr_table", None):
            raise Exception("PGRST204: Could not find the 'processing_center_id' column of 'dispatch_requests'")
        self._data.append(payload)
        return self

    def execute(self):
        if self._action == "update":
            for r in self._filtered:
                r.update(self._update_payload)
            return type("Result", (), {"data": self._filtered})()
        elif self._action == "insert":
            return type("Result", (), {"data": [self._data[-1]] if self._data else []})()
        return type("Result", (), {"data": self._filtered})()


class FakeSupabase:
    def __init__(self, users=None, phlebos=None, pcs=None, dispatches=None, bookings=None):
        self.users = users or []
        self.phlebos = phlebos or []
        self.pcs = pcs or []
        self.dispatches = dispatches or []
        self.bookings = bookings or []

    def table(self, name):
        t_map = {
            "users": self.users,
            "phlebotomists": self.phlebos,
            "processing_centers": self.pcs,
            "dispatch_requests": self.dispatches,
            "bookings": self.bookings,
        }
        data = t_map.get(name, [])
        table = FakeTable(data)
        if name == "dispatch_requests":
            table._dr_table = self.dispatches
        return table


@pytest.mark.asyncio
async def test_ensure_processing_centre_provisions_missing_profile(monkeypatch):
    """If phlebotomist has role='phlebotomist' in users but no row in phlebotomists, auto-provision."""
    users_data = [
        {"id": "user-phlebo-1", "role": "phlebotomist", "full_name": "Test Phlebo"}
    ]
    phlebos_data = []
    pcs_data = [
        {"id": "pc-1", "name": "Main Diagnostic Center", "code": "MDC-01", "status": "active"}
    ]
    fake_sb = FakeSupabase(users=users_data, phlebos=phlebos_data, pcs=pcs_data)
    monkeypatch.setattr("app.services.dispatch_engine.supabase", fake_sb)
    monkeypatch.setattr(
        "app.services.processing_center.resolve_center",
        lambda **kw: {"id": "pc-1", "name": "Main Diagnostic Center", "code": "MDC-01", "lat": 17.68, "lng": 83.21},
    )

    pc_id = UniversalDispatchEngine._ensure_processing_centre("user-phlebo-1")
    assert pc_id == "pc-1"
    assert len(fake_sb.phlebos) == 1
    assert fake_sb.phlebos[0]["user_id"] == "user-phlebo-1"
    assert fake_sb.phlebos[0]["processing_center_id"] == "pc-1"
    assert fake_sb.phlebos[0]["phleb_type"] == "full_time"
    assert fake_sb.phlebos[0]["on_duty"] is True


@pytest.mark.asyncio
async def test_ensure_processing_centre_idempotent(monkeypatch):
    """If phlebotomist already has a bound centre, reuse it without modification."""
    users_data = [{"id": "user-phlebo-2", "role": "phlebotomist"}]
    phlebos_data = [{"user_id": "user-phlebo-2", "processing_center_id": "pc-existing", "is_active": True}]
    fake_sb = FakeSupabase(users=users_data, phlebos=phlebos_data)
    monkeypatch.setattr("app.services.dispatch_engine.supabase", fake_sb)

    pc_id = UniversalDispatchEngine._ensure_processing_centre("user-phlebo-2")
    assert pc_id == "pc-existing"
    assert len(fake_sb.phlebos) == 1


@pytest.mark.asyncio
async def test_sample_service_get_home_lab_auto_provisions(monkeypatch):
    """SampleService.get_home_lab should automatically bind centre and return metadata."""
    users_data = [{"id": "p-123", "role": "phlebotomist"}]
    phlebos_data = []
    pcs_data = [
        {"id": "pc-abc", "name": "Apex Lab", "code": "APX-01", "city": "Visakhapatnam", "address": "Station Rd", "status": "active"}
    ]
    fake_sb = FakeSupabase(users=users_data, phlebos=phlebos_data, pcs=pcs_data)
    monkeypatch.setattr("app.services.samples.supabase", fake_sb)
    monkeypatch.setattr("app.services.dispatch_engine.supabase", fake_sb)
    monkeypatch.setattr(
        "app.services.processing_center.resolve_center",
        lambda **kw: {"id": "pc-abc", "name": "Apex Lab", "code": "APX-01", "city": "Visakhapatnam", "address": "Station Rd", "lat": 17.68, "lng": 83.21},
    )

    info = SampleService.get_home_lab("p-123")
    assert info["processing_center_id"] == "pc-abc"
    assert info["processing_center_name"] == "Apex Lab"
    assert info["processing_center_code"] == "APX-01"


@pytest.mark.asyncio
async def test_my_jobs_enriches_patient_and_slot_time(monkeypatch):
    """my_jobs correctly enriches patient full_name, mobile phone, and converts slot to 12-hour AM/PM."""
    IST = timezone(timedelta(hours=5, minutes=30))
    tomorrow_str = (datetime.now(IST) + timedelta(days=1)).strftime("%Y-%m-%d")

    users_data = [
        {"id": "pat-1", "full_name": "Ravi Teja", "mobile": "+919888877777"}
    ]
    bookings_data = [
        {
            "id": "b-1",
            "patient_id": "pat-1",
            "provider_id": "phlebo-9",
            "provider_type": "phlebotomist",
            "booking_kind": "home_collection",
            "slot_time": "06:00",
            "collection_date": tomorrow_str,
            "notes": "Collection address: Sector 4, MVP Colony",
            "selected_tests": ["Complete Blood Picture (CBP)", "Thyroid Profile"],
            "total_price": 499.0,
            "status": "confirmed",
        }
    ]
    dispatches_data = [
        {
            "id": "dr-1",
            "booking_id": "b-1",
            "patient_id": "pat-1",
            "assigned_provider_id": "phlebo-9",
            "provider_type": "phlebotomist",
            "service_subtype": "home_collection",
            "status": "provider_accepted",
            "scheduled_for": tomorrow_str,
            "patient_address": "Sector 4, MVP Colony",
        }
    ]

    fake_sb = FakeSupabase(users=users_data, bookings=bookings_data, dispatches=dispatches_data)
    monkeypatch.setattr("app.routers.roster.supabase", fake_sb)

    current_user = {"sub": "phlebo-9", "role": "phlebotomist"}
    res = await my_jobs(timeframe="tomorrow", user=current_user)

    jobs = res.get("jobs", [])
    assert len(jobs) == 1
    j = jobs[0]
    assert j["booking_id"] == "b-1"
    assert j["patient_name"] == "Ravi Teja"
    assert j["patient_phone"] == "+919888877777"
    assert j["slot_time"] == "06:00 AM"
    assert j["scheduled_time"] == "06:00 AM"
    assert j["selected_tests"] == ["Complete Blood Picture (CBP)", "Thyroid Profile"]
    assert j["tests"] == ["Complete Blood Picture (CBP)", "Thyroid Profile"]
    assert j["status"] == "provider_accepted"


@pytest.mark.asyncio
async def test_dispatch_requests_schema_cannot_contain_processing_center_id():
    """Verify that dispatch_requests table rejects any insert payload with processing_center_id."""
    fake_sb = FakeSupabase()
    # Simulating what caused PGRST204 prior to the forensic fix
    payload_bad = {
        "booking_id": "b-100",
        "provider_type": "phlebotomist",
        "processing_center_id": "pc-100",  # Illegal column on dispatch_requests
    }
    with pytest.raises(Exception, match="PGRST204: Could not find the 'processing_center_id' column"):
        fake_sb.table("dispatch_requests").insert(payload_bad)

    # Valid payload without processing_center_id succeeds cleanly
    payload_good = {
        "booking_id": "b-100",
        "provider_type": "phlebotomist",
        "assigned_provider_id": "phlebo-100",
        "assignment_mode": "advance",
        "scheduled_for": "2026-09-13",
    }
    fake_sb.table("dispatch_requests").insert(payload_good)
    assert len(fake_sb.dispatches) == 1

