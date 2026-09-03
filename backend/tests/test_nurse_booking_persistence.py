"""
Unit tests for Nurse Bookings Persistence across Dispatch Lifecycle.
Verifies:
  1. POST /api/dispatch/request auto-creates a booking record in `bookings` table with service_type='nurse_visit', status='confirmed' and returns booking_id.
  2. accept_task updates linked booking record to status='in_progress' and assigns provider_id.
  3. update_task_status_lifecycle updates linked booking record to status='completed' on completion.
  4. schema_sync_patch.sql allows bookings.provider_id to be nullable.
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime, timezone
from pathlib import Path


@pytest.mark.asyncio
async def test_dispatch_request_creates_booking_when_missing():
    """Verify that dispatch request creates a booking record if booking_id was None."""
    from app.routers.dispatch import request_dispatch, UniversalDispatchRequest

    fake_patient = {"sub": "pat-1111-2222-3333-4444", "role": "patient"}
    req = UniversalDispatchRequest(
        provider_type="nurse",
        service_subtype="wound_dressing",
        patient_lat=12.9716,
        patient_lng=77.5946,
        patient_address="42 Indiranagar, Bangalore",
        patient_address_details={"city": "Bangalore", "landmark": "Metro Station"},
        notes="Post-op dressing needed",
    )

    mock_supabase = MagicMock()
    mock_bookings_query = MagicMock()
    mock_supabase.table.return_value = mock_bookings_query

    inserted_bookings = []
    mock_bookings_query.insert.side_effect = lambda data: MagicMock(execute=lambda: inserted_bookings.append(data))

    fake_dispatch_result = {
        "dispatch_id": "disp-7777",
        "status": "searching",
        "priority": "normal",
        "provider_type": "nurse",
        "all_candidates": 3,
        "message": "Nurse request queued",
    }

    with patch("app.routers.dispatch.supabase", mock_supabase), \
         patch("app.routers.dispatch.UniversalDispatchEngine.create_dispatch", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = fake_dispatch_result

        res = await request_dispatch(req=req, current_user=fake_patient)

        assert res["success"] is True
        assert "booking_id" in res
        assert res["booking_id"] is not None

        # Verify create_dispatch received the generated booking_id
        mock_create.assert_called_once()
        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs["booking_id"] == res["booking_id"]
        assert call_kwargs["provider_type"] == "nurse"

        # Verify booking record was inserted with correct initial state
        assert len(inserted_bookings) == 1
        b_data = inserted_bookings[0]
        assert b_data["id"] == res["booking_id"]
        assert b_data["patient_id"] == fake_patient["sub"]
        assert b_data["service_type"] == "nurse_visit"
        assert b_data["status"] == "confirmed"
        assert b_data["collection_lat"] == 12.9716
        assert b_data["collection_lng"] == 77.5946
        assert b_data["collection_address"] == "42 Indiranagar, Bangalore"


@pytest.mark.asyncio
async def test_accept_task_syncs_booking_status():
    """Verify accept_task updates the linked booking to in_progress with assigned provider_id."""
    from app.routers.dispatch import accept_task

    fake_provider = {"sub": "nurse-uuid-8888", "role": "nurse"}
    dispatch_id = "disp-uuid-9999"
    booking_id = "book-uuid-7777"

    mock_supabase = MagicMock()
    updated_records = {}

    def table_router(table_name):
        query = MagicMock()
        if table_name == "dispatch_requests":
            # Simulate returning updated dispatch row
            query.update.return_value = query
            query.eq.return_value = query
            query.in_.return_value = query
            query.execute.return_value = MagicMock(data=[{
                "id": dispatch_id,
                "booking_id": booking_id,
                "status": "provider_accepted",
                "assigned_provider_id": fake_provider["sub"],
            }])
        elif table_name == "bookings":
            def capture_booking_update(payload):
                updated_records["bookings_payload"] = payload
                inner = MagicMock()
                inner.eq.return_value = inner
                inner.execute.return_value = MagicMock(data=[payload])
                return inner
            query.update.side_effect = capture_booking_update
        return query

    mock_supabase.table.side_effect = table_router

    with patch("app.database.supabase", mock_supabase):
        res = await accept_task(dispatch_id=dispatch_id, current_user=fake_provider)

        assert res["success"] is True
        assert "bookings_payload" in updated_records
        assert updated_records["bookings_payload"]["status"] == "in_progress"
        assert updated_records["bookings_payload"]["provider_id"] == fake_provider["sub"]


@pytest.mark.asyncio
async def test_update_task_status_lifecycle_syncs_booking_completed():
    """Verify update_task_status_lifecycle updates the linked booking to completed."""
    from app.routers.dispatch import update_task_status_lifecycle, StatusUpdate

    fake_provider = {"sub": "nurse-uuid-8888", "role": "nurse"}
    dispatch_id = "disp-uuid-9999"
    booking_id = "book-uuid-7777"

    mock_supabase = MagicMock()
    updated_records = {}

    def table_router(table_name):
        query = MagicMock()
        if table_name == "dispatch_requests":
            # 1. select current status
            query.select.return_value = query
            query.eq.return_value = query
            query.execute.return_value = MagicMock(data=[{"status": "in_progress"}])
            # 2. update call
            def capture_dispatch_update(payload):
                inner = MagicMock()
                inner.eq.return_value = inner
                inner.execute.return_value = MagicMock(data=[{
                    "id": dispatch_id,
                    "booking_id": booking_id,
                    "status": payload["status"],
                }])
                return inner
            query.update.side_effect = capture_dispatch_update
        elif table_name == "bookings":
            def capture_booking_update(payload):
                updated_records["bookings_payload"] = payload
                inner = MagicMock()
                inner.eq.return_value = inner
                inner.execute.return_value = MagicMock(data=[payload])
                return inner
            query.update.side_effect = capture_booking_update
        return query

    mock_supabase.table.side_effect = table_router

    with patch("app.database.supabase", mock_supabase):
        body = StatusUpdate(status="completed")
        res = await update_task_status_lifecycle(dispatch_id=dispatch_id, body=body, current_user=fake_provider)

        assert res["success"] is True
        assert res["status"] == "completed"
        assert "bookings_payload" in updated_records
        assert updated_records["bookings_payload"]["status"] == "completed"


def test_schema_sync_patch_allows_nullable_provider_id():
    """Verify that schema_sync_patch.sql makes bookings.provider_id nullable for on-demand booking."""
    patch_file = Path(__file__).resolve().parent.parent.parent / "database" / "schema_sync_patch.sql"
    assert patch_file.exists()
    content = patch_file.read_text(encoding="utf-8")

    assert "ALTER TABLE bookings ALTER COLUMN provider_id DROP NOT NULL" in content
