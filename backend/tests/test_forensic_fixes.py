"""
Forensic Regression & Verification Tests for CallMedex Platform Fixes:
1. Organization & Institutional Registration (no gender/dob required).
2. Individual Roles (patient, doctor, dentist) demographic validation preserved.
3. Forgot Password, OTP verification, and password reset endpoints.
4. Provider booking alert email routing.
"""
import pytest
from datetime import date
from pydantic import ValidationError

from app.models.schemas import (
    UserSignup,
    UserRole,
    Gender,
    OrgType,
    OwnershipType,
    VerifyResetOTPRequest,
    ResetPasswordRequest,
)
from app.routers.auth import _build_user_data, _build_profile_data
from app.services.email import EmailService
from app.config import settings


def test_organization_signup_without_gender_and_dob():
    """Organizations must register without personal gender or date of birth."""
    signup_payload = {
        "full_name": "DR L S A NAIDU",
        "email": "directorvmsc@gmail.com",
        "mobile": "+919032282929",
        "password": "Password@123",
        "confirm_password": "Password@123",
        "role": "organization",
        "organization_name": "Venkateswara Medical Scanning Center",
        "organization_type": "diagnostic_center",
        "license_number": "DGN-AP-2024-8849",
        "establishment_year": 2018,
        "registrant_role": "owner",
        "official_email": "directorvmsc@gmail.com",
    }
    user = UserSignup(**signup_payload)
    assert user.role == UserRole.ORGANIZATION
    assert user.gender is None
    assert user.date_of_birth is None
    assert user.official_email == "directorvmsc@gmail.com"

    # Verify _build_user_data does NOT throw AttributeError
    user_data = _build_user_data(user, "test-org-uuid-123")
    assert user_data["gender"] is None
    assert user_data["date_of_birth"] is None
    assert user_data["role"] == "organization"
    assert user_data["official_email"] == "directorvmsc@gmail.com"

    # Verify _build_profile_data captures official_email and organization_name
    profile = _build_profile_data(user, "test-org-uuid-123")
    assert profile["organization_name"] == "Venkateswara Medical Scanning Center"
    assert profile["organization_type"] == "diagnostic_center"
    assert profile["official_email"] == "directorvmsc@gmail.com"


def test_pharmacy_signup_without_gender_and_dob():
    """Pharmacies must register without personal gender or date of birth."""
    pharmacy_payload = {
        "full_name": "Suresh Pharmacy Head",
        "email": "medplus_retail@gmail.com",
        "mobile": "+919876543210",
        "password": "Password@123",
        "confirm_password": "Password@123",
        "role": "pharmacy",
        "pharmacy_name": "CallMedex Direct Pharmacy",
        "license_number": "DL-AP-9921",
    }
    user = UserSignup(**pharmacy_payload)
    assert user.role == UserRole.PHARMACY
    assert user.gender is None
    assert user.date_of_birth is None


def test_individual_signup_requires_gender_and_dob():
    """Doctors, Patients, Dentists must provide gender and date_of_birth."""
    # Omitting gender/dob for a doctor must raise ValidationError
    doc_payload_missing = {
        "full_name": "Dr. Ananya Rao",
        "email": "ananya.doc@gmail.com",
        "mobile": "+919123456780",
        "password": "Password@123",
        "confirm_password": "Password@123",
        "role": "doctor",
    }
    with pytest.raises(ValidationError) as exc:
        UserSignup(**doc_payload_missing)
    assert "gender is required" in str(exc.value)

    # Providing valid gender and dob succeeds
    doc_payload_valid = {
        **doc_payload_missing,
        "gender": "female",
        "date_of_birth": "1988-06-15",
    }
    doc_user = UserSignup(**doc_payload_valid)
    assert doc_user.gender == Gender.FEMALE
    assert doc_user.date_of_birth == date(1988, 6, 15)


def test_verify_reset_otp_request_schema():
    """VerifyResetOTPRequest accepts payloads with or without confirm_password."""
    req1 = VerifyResetOTPRequest(
        email="patient@callmedex.in",
        otp_code="654321",
        new_password="NewPassword@2026",
    )
    assert req1.confirm_password is None

    req2 = VerifyResetOTPRequest(
        email="patient@callmedex.in",
        otp_code="654321",
        new_password="NewPassword@2026",
        confirm_password="NewPassword@2026",
    )
    assert req2.confirm_password == "NewPassword@2026"


def test_provider_booking_alert_email_url_routing(monkeypatch):
    """Booking alert email to provider dynamically targets their role dashboard."""
    recorded = {}

    def mock_send(to_email, subject, html_content, text_content):
        recorded["to_email"] = to_email
        recorded["subject"] = subject
        recorded["html"] = html_content
        return True

    monkeypatch.setattr(EmailService, "_send_real_email", mock_send)

    # 1. Doctor alert
    EmailService.send_booking_alert_email(
        to_email="doctor.demo@callmedex.in",
        recipient_role="provider",
        recipient_name="Dr. Demo",
        booking_details={
            "booking_id": "bk-123456",
            "service_type": "teleconsultation",
            "slot_time": "2026-09-05T10:00:00+05:30",
            "amount": 500,
            "provider_role": "doctor",
            "patient_name": "L S Naidu",
        },
    )
    assert f"{settings.FRONTEND_URL}/dashboard/doctor" in recorded["html"]

    # 2. Dentist alert
    EmailService.send_booking_alert_email(
        to_email="dentist.demo@callmedex.in",
        recipient_role="provider",
        recipient_name="Dr. Smile",
        booking_details={
            "booking_id": "bk-789012",
            "service_type": "root_canal",
            "slot_time": "2026-09-05T11:00:00+05:30",
            "amount": 3500,
            "provider_role": "dentist",
            "patient_name": "Kavita Rao",
        },
    )
    assert f"{settings.FRONTEND_URL}/dashboard/dentist" in recorded["html"]
