import uuid
import pytest
from fastapi import HTTPException

import app.routers.provider_management as pm
from app.routers.provider_management import (
    OrgDoctorScheduleUpdate,
    OrgDoctorShift,
    update_org_doctor_schedule,
    search_organizations,
    get_available_slots,
)
from tests.test_sample_lifecycle import FakeSupabase

@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(pm, "supabase", fake)
    return fake

ORG_USER_ID = str(uuid.uuid4())
ORG_ID = str(uuid.uuid4())
DOCTOR_USER_ID = str(uuid.uuid4())
DOCTOR_PROFILE_ID = str(uuid.uuid4())

ORG_USER = {"sub": ORG_USER_ID, "role": "organization"}
PATIENT_USER = {"sub": str(uuid.uuid4()), "role": "patient"}

@pytest.mark.asyncio
async def test_org_update_doctor_schedule_success(fake_db):
    fake_db.db["organizations"] = [{
        "id": ORG_ID,
        "user_id": ORG_USER_ID,
        "name": "City Polyclinic",
        "verification_status": "verified"
    }]
    fake_db.db["organization_doctors"] = [{
        "id": str(uuid.uuid4()),
        "organization_id": ORG_ID,
        "doctor_user_id": DOCTOR_USER_ID,
        "consultation_fee": 400
    }]
    fake_db.db["doctor_availability"] = []

    payload = OrgDoctorScheduleUpdate(
        slot_duration_minutes=10,
        consultation_fee=600,
        shifts=[
            OrgDoctorShift(
                start_time="09:30",
                end_time="12:30",
                days_of_week=[1, 2, 3, 4, 5, 6]
            )
        ]
    )

    res = await update_org_doctor_schedule(DOCTOR_USER_ID, payload, current_user=ORG_USER)
    assert res.success is True
    assert res.data["slot_duration_minutes"] == 10
    assert res.data["consultation_fee"] == 600

    # Verify consultation_fee updated in organization_doctors
    org_doc = fake_db.db["organization_doctors"][0]
    assert org_doc["consultation_fee"] == 600

    # Verify doctor_availability was created with 10 minute slots and facility_id
    avail = fake_db.db["doctor_availability"]
    assert len(avail) == 6
    for row in avail:
        assert row["slot_duration_minutes"] == 10
        assert row["start_time"] == "09:30"
        assert row["end_time"] == "12:30"
        assert row["facility_id"] == ORG_ID
        assert row["consultation_mode"] == "in_person"

@pytest.mark.asyncio
async def test_org_update_doctor_schedule_forbidden_for_patient(fake_db):
    payload = OrgDoctorScheduleUpdate(
        slot_duration_minutes=15,
        consultation_fee=500,
        shifts=[]
    )
    with pytest.raises(HTTPException) as exc_info:
        await update_org_doctor_schedule(DOCTOR_USER_ID, payload, current_user=PATIENT_USER)
    assert exc_info.value.status_code == 403

@pytest.mark.asyncio
async def test_org_update_doctor_schedule_unlinked_doctor_404(fake_db):
    fake_db.db["organizations"] = [{
        "id": ORG_ID,
        "user_id": ORG_USER_ID,
        "name": "City Polyclinic",
        "verification_status": "verified"
    }]
    fake_db.db["organization_doctors"] = [] # Not linked

    payload = OrgDoctorScheduleUpdate(
        slot_duration_minutes=10,
        consultation_fee=500,
        shifts=[]
    )
    with pytest.raises(HTTPException) as exc_info:
        await update_org_doctor_schedule(DOCTOR_USER_ID, payload, current_user=ORG_USER)
    assert exc_info.value.status_code == 404
