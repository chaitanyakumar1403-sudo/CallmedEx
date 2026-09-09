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
