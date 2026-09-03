"""
Unit tests for Telemedicine Active Waiting Queue and Doctor Waiting Room Radar.
Verifies:
  1. CONSULTING_PROVIDER_ROLES allows doctors, dietitians, physiotherapists, and admin, while disallowing non-consulting roles.
  2. TelemedicineService.get_active_consultations enriches waiting consultations with patient demographics and elapsed waiting time.
  3. schema_sync_patch.sql includes 'waiting' in consultations_status_check.
"""
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta


def test_consulting_provider_roles_authorization():
    """Verify that consulting provider roles are properly authorized for the waiting queue."""
    from app.routers.telemedicine import CONSULTING_PROVIDER_ROLES

    allowed = {"doctor", "dietitian", "physiotherapist", "admin"}
    for role in allowed:
        assert role in CONSULTING_PROVIDER_ROLES, f"{role} should be allowed in active consultations queue"

    disallowed = {"nurse", "phlebotomist", "ambulance", "pharmacy_delivery", "patient"}
    for role in disallowed:
        assert role not in CONSULTING_PROVIDER_ROLES, f"{role} should NOT be in consulting provider roles"


@pytest.mark.asyncio
async def test_active_consultation_demographic_enrichment():
    """Verify that get_active_consultations enriches records with patient profile details."""
    from app.services.telemedicine import TelemedicineService

    fake_consultation = {
        "id": "c-12345",
        "patient_id": "p-98765",
        "doctor_id": "doc-5555",
        "service_type": "telemedicine",
        "status": "waiting",
        "video_room_name": "room-callmedex-c-12345",
        "created_at": (datetime.now(timezone.utc) - timedelta(minutes=12)).isoformat(),
        "notes": "Severe migraine and dizziness",
    }
    fake_patient = {
        "id": "p-98765",
        "full_name": "Sita Raman",
        "mobile": "+919876543210",
        "email": "sita@example.com",
        "gender": "Female",
        "date_of_birth": "1994-05-15",
    }

    mock_supabase = MagicMock()
    # Mock consultations query
    mock_c_query = MagicMock()
    mock_c_query.select.return_value = mock_c_query
    mock_c_query.eq.return_value = mock_c_query
    mock_c_query.in_.return_value = mock_c_query
    mock_c_query.order.return_value = mock_c_query
    mock_c_query.execute.return_value = MagicMock(data=[fake_consultation])

    # Mock patients query
    mock_p_query = MagicMock()
    mock_p_query.select.return_value = mock_p_query
    mock_p_query.in_.return_value = mock_p_query
    mock_p_query.execute.return_value = MagicMock(data=[fake_patient])

    def table_side_effect(table_name):
        if table_name == "consultations":
            return mock_c_query
        elif table_name in ("users", "patients"):
            return mock_p_query
        return MagicMock()

    mock_supabase.table.side_effect = table_side_effect

    with patch("app.services.telemedicine.supabase", mock_supabase):
        results = await TelemedicineService.get_active_consultations(doctor_id="doc-5555")

        assert len(results) == 1
        item = results[0]
        assert item["id"] == "c-12345"
        assert item["patient_name"] == "Sita Raman"
        assert item["patient_gender"] == "Female"
        assert item["notes"] == "Severe migraine and dizziness"
        assert item["elapsed_minutes"] >= 11
        assert item["patient_age"] is not None
        assert int(item["patient_age"]) >= 28


def test_schema_sync_patch_includes_waiting_status():
    """Verify that schema_sync_patch.sql permits 'waiting' in consultations_status_check."""
    from pathlib import Path

    patch_file = Path(__file__).resolve().parent.parent.parent / "database" / "schema_sync_patch.sql"
    assert patch_file.exists(), "database/schema_sync_patch.sql must exist"
    content = patch_file.read_text(encoding="utf-8")

    assert "consultations_status_check" in content
    # Look for status check with 'waiting'
    assert "'waiting'" in content, "schema_sync_patch.sql must include 'waiting' in consultations status check"
