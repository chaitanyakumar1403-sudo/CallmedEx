"""
Test suite for Processing Center Staff Auto-Provisioning, Area Editing,
PC Staff Management, and Lab Testing/Report Delivery.
"""
import uuid
from datetime import datetime, timezone
import pytest
from fastapi import HTTPException

from app.routers.processing_center_admin import (
    add_staff as admin_add_staff,
    update_area as admin_update_area,
    delete_area as admin_delete_area,
    StaffIn,
    AreaIn,
    AreaUpdateIn,
)
from app.routers.pc_operations import (
    list_pc_staff,
    create_pc_staff,
    update_pc_staff,
    remove_pc_staff,
    start_sample_processing,
    deliver_lab_report,
    get_sample_by_barcode,
    verify_sample,
    VerifyRequest,
    PCStaffCreateRequest,
    PCStaffUpdateRequest,
    DeliverReportRequest,
)
from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def mock_db(monkeypatch):
    fake = FakeSupabase()
    import app.routers.processing_center_admin as pca_mod
    import app.routers.pc_operations as pco_mod
    monkeypatch.setattr(pca_mod, "supabase", fake)
    monkeypatch.setattr(pco_mod, "supabase", fake)
    return fake


@pytest.mark.asyncio
async def test_admin_add_staff_auto_provisions_unregistered_email(mock_db):
    """When CallMedex admin adds staff with an unregistered email, account is auto-created with role processing_center."""
    center_id = str(uuid.uuid4())
    mock_db.db["processing_centers"] = [{"id": center_id, "code": "VSPK-01", "name": "Vizag Lab"}]
    mock_db.db["users"] = []
    mock_db.db["processing_center_staff"] = []

    res = await admin_add_staff(
        center_id=center_id,
        payload=StaffIn(email="newadmin@vizaglab.com", pc_role="admin"),
        user={"role": "admin", "sub": "admin-1"},
    )

    assert res["ok"] is True
    assert res["auto_created"] is True
    assert res["email"] == "newadmin@vizaglab.com"
    assert res["pc_role"] == "admin"
    assert res["temporary_password"] == "CallMedex@2026"

    # User row was inserted with active status and processing_center role (NO MOU required)
    users = mock_db.db["users"]
    assert len(users) == 1
    assert users[0]["email"] == "newadmin@vizaglab.com"
    assert users[0]["role"] == "processing_center"
    assert users[0]["registration_status"] == "active"

    # Staff row was inserted
    staff = mock_db.db["processing_center_staff"]
    assert len(staff) == 1
    assert staff[0]["processing_center_id"] == center_id
    assert staff[0]["pc_role"] == "admin"
    assert staff[0]["is_active"] is True


@pytest.mark.asyncio
async def test_admin_add_staff_with_existing_user(mock_db):
    """When CallMedex admin adds an existing user by email, assigns role and records prior role."""
    center_id = str(uuid.uuid4())
    existing_user_id = str(uuid.uuid4())
    mock_db.db["users"] = [{
        "id": existing_user_id,
        "email": "doctor.chaitanya@callmedex.com",
        "full_name": "Dr. Chaitanya",
        "role": "doctor",
    }]
    mock_db.db["processing_center_staff"] = []

    res = await admin_add_staff(
        center_id=center_id,
        payload=StaffIn(email="doctor.chaitanya@callmedex.com", pc_role="admin"),
        user={"role": "admin", "sub": "admin-1"},
    )

    assert res["ok"] is True
    assert res["auto_created"] is False
    assert res["user_id"] == existing_user_id

    # Check staff row recorded prior_role
    staff = mock_db.db["processing_center_staff"]
    assert len(staff) == 1
    assert staff[0]["prior_role"] == "doctor"
    assert staff[0]["pc_role"] == "admin"

    # User role updated to processing_center
    assert mock_db.db["users"][0]["role"] == "processing_center"


@pytest.mark.asyncio
async def test_admin_update_and_delete_service_area(mock_db):
    """CallMedex admin can update radius_km, city, priority of service areas and delete them."""
    center_id = str(uuid.uuid4())
    area_id = str(uuid.uuid4())
    mock_db.db["processing_center_areas"] = [{
        "id": area_id,
        "processing_center_id": center_id,
        "city": "visakhapatnam",
        "pincode": "530001",
        "radius_km": 20.0,
        "priority": 100,
        "is_active": True,
    }]

    # Update radius from 20.0 to 50.0 km
    res_update = await admin_update_area(
        center_id=center_id,
        area_id=area_id,
        payload=AreaUpdateIn(radius_km=50.0, priority=50),
        user={"role": "admin"},
    )
    assert res_update["ok"] is True
    assert mock_db.db["processing_center_areas"][0]["radius_km"] == 50.0
    assert mock_db.db["processing_center_areas"][0]["priority"] == 50

    # Delete area
    res_delete = await admin_delete_area(
        center_id=center_id,
        area_id=area_id,
        user={"role": "admin"},
    )
    assert res_delete["ok"] is True
    assert len(mock_db.db["processing_center_areas"]) == 0


@pytest.mark.asyncio
async def test_pc_staff_management_by_pc_admin(mock_db):
    """Processing Center Admin can list, create, update, and remove staff from their centre."""
    center_id = str(uuid.uuid4())
    admin_user_id = str(uuid.uuid4())
    tech_user_id = str(uuid.uuid4())

    mock_db.db["users"] = [
        {"id": admin_user_id, "email": "admin@lab.com", "full_name": "PC Admin", "role": "processing_center"},
        {"id": tech_user_id, "email": "tech@lab.com", "full_name": "Lab Tech", "role": "processing_center"},
    ]
    mock_db.db["processing_center_staff"] = [
        {"id": str(uuid.uuid4()), "processing_center_id": center_id, "user_id": admin_user_id, "pc_role": "admin", "is_active": True},
        {"id": str(uuid.uuid4()), "processing_center_id": center_id, "user_id": tech_user_id, "pc_role": "technician", "is_active": True},
    ]

    # List staff
    list_res = await list_pc_staff(staff={"processing_center_id": center_id, "user_id": admin_user_id, "pc_role": "admin"})
    assert len(list_res["staff"]) == 2
    roles = {s["email"]: s["pc_role"] for s in list_res["staff"]}
    assert roles["admin@lab.com"] == "admin"
    assert roles["tech@lab.com"] == "technician"

    # Add a new technician by email (auto-created)
    create_res = await create_pc_staff(
        payload=PCStaffCreateRequest(email="newtech@lab.com", full_name="New Tech", pc_role="technician"),
        staff={"processing_center_id": center_id, "user_id": admin_user_id, "pc_role": "admin"},
    )
    assert create_res["ok"] is True
    assert create_res["auto_created"] is True
    assert len(mock_db.db["processing_center_staff"]) == 3

    # Update technician to admin
    update_res = await update_pc_staff(
        user_id=tech_user_id,
        payload=PCStaffUpdateRequest(pc_role="admin"),
        staff={"processing_center_id": center_id, "user_id": admin_user_id, "pc_role": "admin"},
    )
    assert update_res["ok"] is True

    # Remove technician
    del_res = await remove_pc_staff(
        user_id=tech_user_id,
        staff={"processing_center_id": center_id, "user_id": admin_user_id, "pc_role": "admin"},
    )
    assert del_res["ok"] is True
    tech_row = [s for s in mock_db.db["processing_center_staff"] if s["user_id"] == tech_user_id][0]
    assert tech_row["is_active"] is False


@pytest.mark.asyncio
async def test_pc_sample_processing_and_report_delivery(mock_db):
    """Processing center technician/admin can transition sample to processing and deliver lab report."""
    center_id = str(uuid.uuid4())
    sample_id = str(uuid.uuid4())
    staff_user_id = str(uuid.uuid4())
    patient_id = str(uuid.uuid4())

    mock_db.db["samples"] = [{
        "id": sample_id,
        "processing_center_id": center_id,
        "status": "verified",
        "barcode": "CMX-260927-123456",
        "patient_id": patient_id,
        "booking_id": str(uuid.uuid4()),
    }]
    mock_db.db["sample_events"] = []
    mock_db.db["report_jobs"] = [{
        "id": str(uuid.uuid4()),
        "sample_id": sample_id,
        "patient_id": patient_id,
        "processing_center_id": center_id,
        "status": "processing",
    }]

    staff_ctx = {"processing_center_id": center_id, "user_id": staff_user_id, "pc_role": "technician"}

    # 1. Start lab processing
    proc_res = await start_sample_processing(sample_id=sample_id, staff=staff_ctx)
    assert proc_res["success"] is True
    assert mock_db.db["samples"][0]["status"] == "processing"

    # Verify event logged
    events = [e for e in mock_db.db["sample_events"] if e["sample_id"] == sample_id]
    assert any(e["event"] == "processing" for e in events)

    # 2. Deliver laboratory report
    deliv_res = await deliver_lab_report(
        sample_id=sample_id,
        body=DeliverReportRequest(
            report_url="https://storage.callmedex.internal/reports/lab_result_123456.pdf",
            notes="Complete Blood Count within normal limits.",
        ),
        staff=staff_ctx,
    )
    assert deliv_res["success"] is True
    assert deliv_res["status"] == "report_ready"

    # Sample updated
    assert mock_db.db["samples"][0]["status"] == "report_ready"
    assert mock_db.db["samples"][0]["report_url"] == "https://storage.callmedex.internal/reports/lab_result_123456.pdf"

    # Report job updated to delivered
    assert mock_db.db["report_jobs"][0]["status"] == "delivered"


@pytest.mark.asyncio
async def test_pc_staff_permanent_removal_and_sample_intake_autolink(mock_db):
    """Test hard purge of misassigned staff and auto-linking sample on barcode scan intake."""
    center_id = str(uuid.uuid4())
    admin_user_id = str(uuid.uuid4())
    phlebo_user_id = str(uuid.uuid4())

    mock_db.db["users"] = [
        {"id": admin_user_id, "email": "admin@lab.com", "full_name": "PC Admin", "role": "processing_center"},
        {"id": phlebo_user_id, "email": "phlebo@field.com", "full_name": "Field Phlebo", "role": "processing_center"},
    ]
    mock_db.db["phlebotomists"] = [
        {"id": str(uuid.uuid4()), "user_id": phlebo_user_id, "processing_center_id": center_id, "on_duty": True, "verification_status": "verified"}
    ]
    mock_db.db["processing_center_staff"] = [
        {"id": str(uuid.uuid4()), "processing_center_id": center_id, "user_id": admin_user_id, "pc_role": "admin", "is_active": True},
        {"id": str(uuid.uuid4()), "processing_center_id": center_id, "user_id": phlebo_user_id, "pc_role": "technician", "prior_role": "phlebotomist", "is_active": False},
    ]

    staff_ctx = {"processing_center_id": center_id, "user_id": admin_user_id, "pc_role": "admin"}

    # 1. Verify list_pc_staff identifies phlebo role and returns bound phlebotomists
    list_res = await list_pc_staff(staff=staff_ctx)
    staff_items = list_res["staff"]
    phlebo_item = [s for s in staff_items if s["user_id"] == phlebo_user_id][0]
    assert phlebo_item["is_phlebotomist"] is True
    assert phlebo_item["prior_role"] == "phlebotomist"
    assert len(list_res["phlebotomists"]) == 1
    assert list_res["phlebotomists"][0]["user_id"] == phlebo_user_id

    # 2. Hard purge misassigned staff member
    del_res = await remove_pc_staff(
        user_id=phlebo_user_id,
        permanent=True,
        staff=staff_ctx,
    )
    assert del_res["ok"] is True
    # Row completely deleted from processing_center_staff
    assert not any(s["user_id"] == phlebo_user_id for s in mock_db.db["processing_center_staff"])
    # User's role restored to prior_role (phlebotomist)
    assert mock_db.db["users"][1]["role"] == "phlebotomist"

    # 3. Sample Intake & Auto-linking test
    unassigned_sample_id = str(uuid.uuid4())
    test_barcode = "CMX-TUBE-999888"
    mock_db.db["samples"] = [{
        "id": unassigned_sample_id,
        "processing_center_id": None, # Unassigned initially
        "barcode": test_barcode,
        "status": "in_transit",
        "expected_tube_type_code": "LAV",
    }]
    mock_db.db["sample_events"] = []

    # Barcode lookup auto-links sample to center_id
    tech_ctx = {"processing_center_id": center_id, "user_id": admin_user_id, "pc_role": "technician"}
    scanned = await get_sample_by_barcode(barcode=test_barcode, staff=tech_ctx)
    assert scanned["id"] == unassigned_sample_id
    assert mock_db.db["samples"][0]["processing_center_id"] == center_id

    # 4. Verify sample in transit automatically marks intake receipt and verifies
    v_res = await verify_sample(
        sample_id=unassigned_sample_id,
        body=VerifyRequest(
            tube_received=True,
            barcode_match=True,
            tube_type_correct=True,
            label_present=True,
            quality_acceptable=True,
        ),
        staff=tech_ctx,
    )
    assert v_res["success"] is True
    assert v_res["status"] == "verified"
    assert mock_db.db["samples"][0]["status"] == "verified"

