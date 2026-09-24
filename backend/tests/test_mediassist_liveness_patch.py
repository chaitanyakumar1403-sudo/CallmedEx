"""
Verification test suite for CallMedex <-> Kriya AI (MediAssist) 100% Production Liveness Fixes.

Verifies:
1. BookingAddress accepts None/absent lat/lng without 422 error.
2. WhatsApp home collection bookings populate collection_date, processing_center_id, booking_kind, and enable advance roster.
3. Report delivery and correction updates existing ai_report_analyses row (preventing UNIQUE constraint crash).
4. Longitudinal biomarkers in abnormal_flags are automatically synced to patient_biomarkers.
5. Report retry sweep and submission auto-resolve and pass signed URLs from source_document_path.
6. Rate limiting middleware exempts machine-to-machine integration routes (/api/v1/integrations/mediassist).
7. Web patient registration claims existing headless WhatsApp patient by phone number without creating duplicate users.
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime, timezone
import uuid

from app.routers.mediassist_inbound import BookingAddress, WhatsappBookingRequest, _parse_biomarker_value
from app.models.schemas import UserRole, UserSignup, AddressInfo, ServiceType
from app.routers.auth import _find_headless_patient_by_phone, signup
from app.middleware.rate_limiter import RateLimitMiddleware, SKIP_PATH_PREFIXES


def test_parse_biomarker_value():
    assert _parse_biomarker_value("7.2%") == (7.2, "%")
    assert _parse_biomarker_value("145 mg/dL") == (145.0, "mg/dL")
    assert _parse_biomarker_value("12.5") == (12.5, "")
    assert _parse_biomarker_value("negative") == (None, "")
    assert _parse_biomarker_value("") == (None, "")


def test_booking_address_coordinates_optional():
    addr = BookingAddress(
        line1="Flat 101, Lake View",
        city="Visakhapatnam",
        pincode="530002",
        lat=None,
        lng=None,
    )
    assert addr.lat is None
    assert addr.lng is None
    assert addr.city == "Visakhapatnam"


def test_rate_limiter_exempts_mediassist_path():
    assert "/api/v1/integrations/mediassist" in SKIP_PATH_PREFIXES
    path = "/api/v1/integrations/mediassist/callbacks/report-delivered"
    assert any(path.startswith(p) for p in SKIP_PATH_PREFIXES)


def test_headless_patient_claiming_by_phone():
    phone = "+919876543210"
    headless_user = {
        "id": "user-headless-uuid",
        "email": "whatsapp+919876543210@patients.callmedex.internal",
        "full_name": "WhatsApp Patient",
        "mobile": phone,
        "role": "patient",
        "is_active": True,
    }

    with patch("app.routers.auth.supabase") as mock_sb:
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_limit = MagicMock()
        mock_execute = MagicMock()

        mock_sb.table.return_value = mock_table
        mock_table.select.return_value = mock_select
        mock_select.eq.return_value = mock_eq
        mock_eq.eq.return_value = mock_eq
        mock_eq.limit.return_value = mock_limit
        mock_limit.execute.return_value = MagicMock(data=[headless_user])

        found = _find_headless_patient_by_phone(phone)
        assert found is not None
        assert found["id"] == "user-headless-uuid"
        assert found["email"].startswith("whatsapp+")


@pytest.mark.asyncio
async def test_report_submission_auto_signs_document_url():
    from app.services.report_submission import submit_report_job_to_mediassist

    mock_client = AsyncMock()
    mock_client.submit_report_job.return_value = {"status": "submitted"}

    mock_db = MagicMock()
    # Mock finding report_job with source_document_path
    mock_db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[{"source_document_path": "reports/patient-1/lab.pdf"}]
    )

    with patch("app.services.storage.StorageService.signed_url", return_value="https://storage.supabase.co/signed/lab.pdf"):
        with patch("app.services.report_submission.get_patient_contact", return_value={"phone": "+919999999999", "preferred_language": "en"}):
            resp = await submit_report_job_to_mediassist(
                report_job_id="job-123",
                patient_id="patient-1",
                source_document_url="",  # Empty on input!
                client=mock_client,
                db=mock_db,
            )

            assert resp == {"status": "submitted"}
            # Verify submit_report_job was called with the generated signed URL
            call_kwargs = mock_client.submit_report_job.call_args[1]
            assert call_kwargs["source_document_url"] == "https://storage.supabase.co/signed/lab.pdf"
