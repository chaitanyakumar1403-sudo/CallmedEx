"""
Unit tests for /booked-slots endpoint and doctor provider ID mapping/queue sync.
Verifies:
  1. GET /booked-slots returns active booked times for provider on requested date.
  2. _resolve_provider_fee resolves consultation fees whether user_id or id is provided.
"""
import pytest
from unittest.mock import MagicMock, patch


@pytest.mark.asyncio
async def test_get_booked_slots_endpoint():
    """Verify that get_booked_slots queries bookings and returns busy time strings."""
    from app.routers.bookings import get_booked_slots

    mock_supabase = MagicMock()
    # Mock doctor lookup
    mock_doc_query = MagicMock()
    mock_doc_query.select.return_value = mock_doc_query
    mock_doc_query.or_.return_value = mock_doc_query
    mock_doc_query.limit.return_value = mock_doc_query
    mock_doc_query.execute.return_value = MagicMock(data=[
        {"id": "doc-prof-1", "user_id": "doc-user-1"}
    ])

    # Mock active bookings
    mock_b_query = MagicMock()
    mock_b_query.select.return_value = mock_b_query
    mock_b_query.in_.return_value = mock_b_query
    mock_b_query.not_.in_.return_value = mock_b_query
    mock_b_query.execute.return_value = MagicMock(data=[
        {"slot_id": "doc-user-1|2026-09-10|10:00 AM", "slot_start": "2026-09-10T10:00:00+05:30"},
        {"slot_id": "doc-prof-1|2026-09-10|11:30 AM", "slot_start": "2026-09-10T11:30:00+05:30"},
    ])

    def table_side_effect(name):
        if name == "doctors":
            return mock_doc_query
        return mock_b_query

    mock_supabase.table.side_effect = table_side_effect

    with patch("app.routers.bookings.supabase", mock_supabase):
        res = await get_booked_slots(
            provider_id="doc-prof-1",
            date_str="2026-09-10",
        )

    assert res.success is True
    assert "10:00 AM" in res.data["booked_slots"]
    assert "11:30 AM" in res.data["booked_slots"]
    assert len(res.data["booked_slots"]) == 2


def test_resolve_provider_fee_doctor():
    """Verify that _resolve_provider_fee queries doctors table with .or_ for user_id and id."""
    from app.routers.bookings import _resolve_provider_fee

    mock_supabase = MagicMock()
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.or_.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.execute.return_value = MagicMock(data=[
        {"consultation_fee": 750.0, "home_visit_fee": 1200.0}
    ])
    mock_supabase.table.return_value = mock_query

    with patch("app.routers.bookings.supabase", mock_supabase):
        fee = _resolve_provider_fee("doc-profile-or-user-id", "doctor", "teleconsultation")

    assert fee == 750.0
    mock_supabase.table.assert_called_with("doctors")
    mock_query.or_.assert_called_with("user_id.eq.doc-profile-or-user-id,id.eq.doc-profile-or-user-id")


@pytest.mark.asyncio
async def test_get_booked_slots_home_collection_by_city():
    """Verify that get_booked_slots queries bookings by city and service_type=home_collection."""
    from app.routers.bookings import get_booked_slots

    mock_supabase = MagicMock()
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.not_.in_.return_value = mock_query
    mock_query.execute.return_value = MagicMock(data=[
        {
            "slot_id": "callmedex|2026-09-11|05:30",
            "slot_start": "2026-09-11T05:30:00+05:30",
            "collection_city": "Visakhapatnam",
        },
        {
            "slot_id": "callmedex|2026-09-11|07:30",
            "slot_start": "2026-09-11T07:30:00+05:30",
            "collection_city": "Visakhapatnam",
        },
    ])
    mock_supabase.table.return_value = mock_query

    with patch("app.routers.bookings.supabase", mock_supabase):
        res = await get_booked_slots(
            provider_id=None,
            date_str="2026-09-11",
            service_type="home_collection",
            city="Visakhapatnam",
        )

    assert res.success is True
    assert "05:30" in res.data["booked_slots"]
    assert "07:30" in res.data["booked_slots"]
    assert len(res.data["booked_slots"]) == 2


@pytest.mark.asyncio
async def test_my_jobs_enriched_details():
    """Verify that /phlebo/jobs enriches dispatch requests with booking and patient details."""
    from app.routers.roster import my_jobs

    mock_supabase = MagicMock()
    mock_dispatch_query = MagicMock()
    mock_dispatch_query.select.return_value = mock_dispatch_query
    mock_dispatch_query.eq.return_value = mock_dispatch_query
    mock_dispatch_query.not_.in_.return_value = mock_dispatch_query
    mock_dispatch_query.order.return_value = mock_dispatch_query
    mock_dispatch_query.execute.return_value = MagicMock(data=[
        {
            "id": "disp-101",
            "booking_id": "book-101",
            "patient_id": "pat-101",
            "scheduled_for": "2026-09-11",
            "patient_address": "45 Beach Road, Visakhapatnam",
            "service_subtype": "home_collection",
        }
    ])

    mock_booking_query = MagicMock()
    mock_booking_query.select.return_value = mock_booking_query
    mock_booking_query.eq.return_value = mock_booking_query
    mock_booking_query.limit.return_value = mock_booking_query
    mock_booking_query.execute.return_value = MagicMock(data=[
        {
            "id": "book-101",
            "selected_tests": ["Complete Blood Count (CBC)", "HbA1c"],
            "slot_id": "callmedex|2026-09-11|06:30",
            "total_price": 599.0,
        }
    ])

    mock_user_query = MagicMock()
    mock_user_query.select.return_value = mock_user_query
    mock_user_query.eq.return_value = mock_user_query
    mock_user_query.limit.return_value = mock_user_query
    mock_user_query.execute.return_value = MagicMock(data=[
        {"full_name": "Ramesh Varma", "phone": "+919876543210"}
    ])

    def table_router(tbl):
        if tbl == "dispatch_requests":
            return mock_dispatch_query
        elif tbl == "bookings":
            return mock_booking_query
        elif tbl == "users":
            return mock_user_query
        return MagicMock()

    mock_supabase.table.side_effect = table_router

    with patch("app.routers.roster.supabase", mock_supabase):
        res = await my_jobs(
            date="2026-09-11",
            user={"sub": "phlebo-user-1", "role": "phlebotomist"}
        )

    jobs = res["jobs"]
    assert len(jobs) == 1
    assert jobs[0]["patient_name"] == "Ramesh Varma"
    assert jobs[0]["patient_phone"] == "+919876543210"
    assert "Complete Blood Count (CBC)" in jobs[0]["selected_tests"]
    assert jobs[0]["slot_time"] == "06:30"

