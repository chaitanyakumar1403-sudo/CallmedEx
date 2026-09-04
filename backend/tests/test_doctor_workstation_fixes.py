"""
Tests for Doctor Workstation fixes:
- Shift schedule creation (Morning + Evening shifts, 10-min slot durations, custom days)
- 1-Click CallMedex standard tariff application
- e-Prescription email dispatch
- Bookings provider today with patient email and mobile
"""
import uuid
import pytest
from fastapi import HTTPException

import app.routers.provider_management as pm
from app.routers.provider_management import (
    ShiftScheduleCreate,
    create_shift_availability,
    apply_standard_tariffs,
)
import app.routers.telemedicine as tm
from app.routers.telemedicine import SendRxEmailRequest, send_rx_email
from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(pm, "supabase", fake)
    monkeypatch.setattr(tm, "supabase", fake)
    return fake


DOCTOR_ID = str(uuid.uuid4())
DOCTOR_USER = {"sub": DOCTOR_ID, "role": "doctor", "name": "Dr. Latchireddi Sa Naidu"}


@pytest.mark.asyncio
async def test_shift_availability_creates_morning_and_evening(fake_db):
    payload = ShiftScheduleCreate(
        consultation_mode="in_person",
        slot_duration_minutes=10,  # 10 minute minimum slots!
        selected_days=[1, 2, 3, 4, 5, 6],  # Mon-Sat
        morning_shift_enabled=True,
        morning_start="09:00",
        morning_end="12:00",  # 3 hours = 18 slots (at 10 min/slot)
        evening_shift_enabled=True,
        evening_start="17:00",
        evening_end="19:00",  # 2 hours = 12 slots
        location_name="Visakha Multispeciality Clinics",
        location_address="Madhurawada, Visakhapatnam",
        replace_existing=True,
    )

    result = await create_shift_availability(payload, DOCTOR_USER)

    assert result["success"] is True
    assert result["days_count"] == 6
    assert result["shifts_per_day"] == 2
    # 6 days * 2 shifts = 12 records
    assert result["created_records_count"] == 12
    # Total daily slots: (180 + 120) / 10 = 30 slots/day
    assert result["slots_per_day"] == 30
    assert result["total_slots_week"] == 180

    rows = fake_db.db.get("doctor_availability", [])
    assert len(rows) == 12
    assert {r["slot_duration_minutes"] for r in rows} == {10}
    assert {r["location_name"] for r in rows} == {"Visakha Multispeciality Clinics"}


@pytest.mark.asyncio
async def test_shift_availability_rejects_invalid_times(fake_db):
    payload = ShiftScheduleCreate(
        morning_start="12:00",
        morning_end="09:00",  # start after end
        selected_days=[1],
    )
    with pytest.raises(HTTPException) as exc:
        await create_shift_availability(payload, DOCTOR_USER)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_apply_standard_mou_tariffs(fake_db):
    result = await apply_standard_tariffs(DOCTOR_USER)

    assert result["success"] is True
    fees = fake_db.db.get("consultation_fees", [])
    assert len(fees) == 3

    fee_map = {f["fee_type"]: f["amount"] for f in fees}
    assert fee_map["in_person"] == 500
    assert fee_map["online"] == 400
    assert fee_map["home_visit"] == 800


@pytest.mark.asyncio
async def test_send_rx_email_dispatches_successfully():
    req = SendRxEmailRequest(
        patient_email="patient@example.com",
        patient_name="Priya Sharma",
        doctor_name="Dr. Latchireddi Sa Naidu",
        diagnosis="Acute Viral Pharyngitis",
        medicines=[
            {"name": "Paracetamol 650mg", "dose": "1 tab", "freq": "TID", "days": "3 days", "notes": "After food"}
        ],
        clinical_notes="Maintain hydration and vocal rest.",
    )

    result = await send_rx_email(req, DOCTOR_USER)
    assert result["success"] is True
    assert "patient@example.com" in result["message"]


@pytest.mark.asyncio
async def test_send_rx_email_requires_valid_email():
    req = SendRxEmailRequest(
        patient_email="invalid-email-address",
        patient_name="Priya Sharma",
        diagnosis="Test",
        medicines=[],
    )

    with pytest.raises(HTTPException) as exc:
        await send_rx_email(req, DOCTOR_USER)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_get_booking_details_includes_patient_email(fake_db, monkeypatch):
    import app.routers.bookings as bk
    monkeypatch.setattr(bk, "supabase", fake_db)

    patient_id = str(uuid.uuid4())
    booking_id = str(uuid.uuid4())

    fake_db.db.setdefault("users", []).append({
        "id": patient_id,
        "full_name": "Suresh Patel",
        "email": "suresh.patel@example.com",
        "phone": "+919876543210",
        "age": 45,
        "gender": "male",
    })
    fake_db.db.setdefault("bookings", []).append({
        "id": booking_id,
        "patient_id": patient_id,
        "provider_id": DOCTOR_ID,
        "status": "confirmed",
        "service_type": "video_consult",
    })

    res = await bk.get_booking_details(booking_id, DOCTOR_USER)
    assert res.success is True
    assert res.data["id"] == booking_id
    assert res.data["patient_name"] == "Suresh Patel"
    assert res.data["patient_email"] == "suresh.patel@example.com"
    assert res.data["patient_mobile"] == "+919876543210"
    assert res.data["patient_age"] == 45

