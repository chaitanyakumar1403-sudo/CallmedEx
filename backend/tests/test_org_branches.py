import uuid
import pytest
from fastapi import HTTPException

import app.routers.provider_management as pm
from app.routers.provider_management import (
    OrgBranchCreate,
    OrgBranchUpdate,
    OrgDoctorScheduleUpdate,
    OrgDoctorShift,
    get_org_branches,
    create_org_branch,
    update_org_branch,
    delete_org_branch,
    update_org_doctor_schedule,
    get_available_slots,
    search_organizations,
)
from tests.test_sample_lifecycle import FakeSupabase

@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(pm, "supabase", fake)
    return fake

ORG_USER_ID = str(uuid.uuid4())
ORG_ID = str(uuid.uuid4())
BRANCH_ID_1 = str(uuid.uuid4())
BRANCH_ID_2 = str(uuid.uuid4())
DOCTOR_USER_ID = str(uuid.uuid4())
DOCTOR_PROFILE_ID = str(uuid.uuid4())

ORG_USER = {"sub": ORG_USER_ID, "role": "organization"}
PATIENT_USER = {"sub": str(uuid.uuid4()), "role": "patient"}

@pytest.mark.asyncio
async def test_org_branches_crud(fake_db):
    fake_db.db["organizations"] = [{
        "id": ORG_ID,
        "user_id": ORG_USER_ID,
        "name": "Visakha Multispeciality Clinics",
        "address": "Dwaraka Nagar, Visakhapatnam",
        "city": "Visakhapatnam",
        "phone": "+91 891 5556667",
        "verification_status": "verified"
    }]
    fake_db.db["provider_branches"] = []

    # 1. Create Branch 1
    b1_payload = OrgBranchCreate(
        name="MVP Colony Outpatient Clinic",
        address="Sector 4, MVP Colony",
        city="Visakhapatnam",
        phone="+91 891 2345678"
    )
    b1_res = await create_org_branch(b1_payload, current_user=ORG_USER)
    assert b1_res["success"] is True
    assert b1_res["branch"]["name"] == "MVP Colony Outpatient Clinic"
    created_id_1 = b1_res["branch"]["id"]

    # 2. Create Branch 2
    b2_payload = OrgBranchCreate(
        name="Gajuwaka Diagnostic Centre",
        address="Main Road, Old Gajuwaka",
        city="Visakhapatnam",
        phone="+91 891 9876543"
    )
    b2_res = await create_org_branch(b2_payload, current_user=ORG_USER)
    assert b2_res["success"] is True
    created_id_2 = b2_res["branch"]["id"]

    # 3. List Branches (includes main facility fallback + custom branches)
    list_res = await get_org_branches(current_user=ORG_USER)
    assert list_res["success"] is True
    assert len(list_res["custom_branches"]) == 2
    assert len(list_res["branches"]) == 3  # main + 2 custom

    # 4. Update Branch 1
    up_payload = OrgBranchUpdate(phone="+91 891 0001112")
    up_res = await update_org_branch(created_id_1, up_payload, current_user=ORG_USER)
    assert up_res["success"] is True

    # 5. Delete Branch 2
    del_res = await delete_org_branch(created_id_2, current_user=ORG_USER)
    assert del_res["success"] is True

    # 6. Verify custom_branches has 1 branch left
    list_res2 = await get_org_branches(current_user=ORG_USER)
    assert len(list_res2["custom_branches"]) == 1
    assert list_res2["custom_branches"][0]["id"] == created_id_1


@pytest.mark.asyncio
async def test_doctor_multishift_branch_allocation_and_slot_filtering(fake_db):
    fake_db.db["organizations"] = [{
        "id": ORG_ID,
        "user_id": ORG_USER_ID,
        "name": "Visakha Multispeciality Hospital",
        "verification_status": "verified"
    }]
    fake_db.db["provider_branches"] = [
        {
            "id": BRANCH_ID_1,
            "provider_user_id": ORG_USER_ID,
            "name": "Main Hospital Complex",
            "address": "Maharanipeta, Beach Road",
            "city": "Visakhapatnam",
            "phone": "+91 891 1111111",
            "is_active": True
        },
        {
            "id": BRANCH_ID_2,
            "provider_user_id": ORG_USER_ID,
            "name": "MVP Colony OPD Outpost",
            "address": "Sector 4, MVP Colony",
            "city": "Visakhapatnam",
            "phone": "+91 891 2222222",
            "is_active": True
        }
    ]
    fake_db.db["organization_doctors"] = [{
        "id": str(uuid.uuid4()),
        "organization_id": ORG_ID,
        "doctor_user_id": DOCTOR_USER_ID,
        "consultation_fee": 500
    }]
    fake_db.db["doctor_availability"] = []

    # Configure 2 shifts on Monday (day 1):
    # Morning shift 09:30-11:30 at Branch 1 (Main Hospital)
    # Evening shift 17:00-19:00 at Branch 2 (MVP Colony OPD)
    payload = OrgDoctorScheduleUpdate(
        slot_duration_minutes=15,
        consultation_fee=700,
        shifts=[
            OrgDoctorShift(
                start_time="09:30",
                end_time="11:30",
                days_of_week=[1],
                branch_id=BRANCH_ID_1,
                branch_name="Main Hospital Complex"
            ),
            OrgDoctorShift(
                start_time="17:00",
                end_time="19:00",
                days_of_week=[1],
                branch_id=BRANCH_ID_2,
                branch_name="MVP Colony OPD Outpost"
            )
        ]
    )

    sched_res = await update_org_doctor_schedule(DOCTOR_USER_ID, payload, current_user=ORG_USER)
    assert sched_res.success is True

    # Check rows stored in doctor_availability
    avail_rows = fake_db.db["doctor_availability"]
    assert len(avail_rows) == 2
    b1_avail = [r for r in avail_rows if r.get("template_group_id") == BRANCH_ID_1]
    b2_avail = [r for r in avail_rows if r.get("template_group_id") == BRANCH_ID_2]
    assert len(b1_avail) == 1
    assert len(b2_avail) == 1
    assert b1_avail[0]["location_name"] == "Main Hospital Complex"
    assert b2_avail[0]["location_name"] == "MVP Colony OPD Outpost"

    # Set up doctors table so get_available_slots can resolve DOCTOR_USER_ID
    fake_db.db["doctors"] = [{
        "id": DOCTOR_PROFILE_ID,
        "user_id": DOCTOR_USER_ID,
        "is_available": True
    }]
    fake_db.db["bookings"] = []

    # Target Date: 2026-09-21 is a Monday (day_of_week 1 in Python datetime.weekday() is Monday)
    target_monday = "2026-09-21"

    # 1. Filter by Branch 1 -> Only morning slots (09:30 to 11:30)
    b1_slots_res = await get_available_slots(
        provider_id=DOCTOR_USER_ID,
        target_date=target_monday,
        mode="in_person",
        branch_id=BRANCH_ID_1
    )
    assert b1_slots_res["success"] is True
    b1_slot_times = [s["time"] for s in b1_slots_res["slots"]]
    assert "09:30" in b1_slot_times
    assert "10:00" in b1_slot_times
    assert "11:00" in b1_slot_times
    # Ensure NO evening slots from Branch 2 are returned
    assert "17:00" not in b1_slot_times
    assert "18:00" not in b1_slot_times

    # 2. Filter by Branch 2 -> Only evening slots (17:00 to 19:00)
    b2_slots_res = await get_available_slots(
        provider_id=DOCTOR_USER_ID,
        target_date=target_monday,
        mode="in_person",
        branch_id=BRANCH_ID_2
    )
    assert b2_slots_res["success"] is True
    b2_slot_times = [s["time"] for s in b2_slots_res["slots"]]
    assert "17:00" in b2_slot_times
    assert "17:30" in b2_slot_times
    assert "18:30" in b2_slot_times
    # Ensure NO morning slots from Branch 1 are returned
    assert "09:30" not in b2_slot_times
    assert "10:00" not in b2_slot_times


@pytest.mark.asyncio
async def test_search_organizations_branches_enrichment(fake_db):
    fake_db.db["organizations"] = [{
        "id": ORG_ID,
        "user_id": ORG_USER_ID,
        "name": "Apollo Clinic",
        "city": "Visakhapatnam",
        "address": "Waltair Main Road",
        "organization_type": "clinic",
        "verification_status": "verified",
        "is_active": True
    }]
    fake_db.db["provider_branches"] = [{
        "id": BRANCH_ID_1,
        "provider_user_id": ORG_USER_ID,
        "name": "MVP Colony Branch",
        "address": "Sector 3, MVP Colony",
        "city": "Visakhapatnam",
        "phone": "+91 891 4445556",
        "is_active": True
    }]
    fake_db.db["provider_directory"] = [{
        "id": str(uuid.uuid4()),
        "provider_user_id": ORG_USER_ID,
        "name": "Apollo Clinic",
        "provider_type": "organization",
        "subtype": "clinic",
        "city": "Visakhapatnam",
        "verification_status": "verified",
        "is_active": True,
        "is_listed": True,
    }]
    fake_db.db["organization_doctors"] = []
    fake_db.db["doctor_availability"] = []
    fake_db.db["doctors"] = []

    res = await search_organizations()
    assert res["success"] is True
    assert len(res["organizations"]) == 1
    org = res["organizations"][0]

    assert "branches" in org
    assert org["branch_count"] >= 1
    # Check that branches contains MVP Colony Branch and the synthesized main facility
    branch_names = [b["name"] for b in org["branches"]]
    assert any("MVP Colony" in name for name in branch_names)
    assert any("Apollo Clinic" in name for name in branch_names)
