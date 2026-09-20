import pytest
from unittest.mock import patch
from app.services.email import EmailService


def test_send_deletion_otp_email():
    """Verify that send_account_deletion_otp_email properly constructs royal blue email and calls _send_real_email."""
    with patch.object(EmailService, "_send_real_email", return_value=True) as mock_send:
        sent = EmailService.send_account_deletion_otp_email(
            to_email="patient@example.com",
            user_name="Rahul Sharma",
            otp="582194"
        )
        assert sent is True
        mock_send.assert_called_once()
        args, _ = mock_send.call_args
        to_email, subject, html_content, text_content = args

        assert to_email == "patient@example.com"
        assert "582194" in subject or "Account Deletion" in subject
        assert "582194" in html_content
        assert "582194" in text_content
        assert "Rahul Sharma" in html_content
        assert "10 minutes" in html_content
        # Verify CallMedex Royal Blue styling presence
        assert "#1e40af" in html_content or "#1d4ed8" in html_content or "#2563eb" in html_content


@pytest.mark.asyncio
async def test_request_otp_blocked_when_active_bookings_exist():
    from app.routers.auth import request_account_deletion_otp
    with patch("app.routers.auth._check_active_clinical_records", return_value=["Booking #BK-101 (confirmed)"]):
        user = {"sub": "user-with-active-booking", "email": "patient@test.com", "role": "patient"}
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await request_account_deletion_otp(current_user=user)
        assert exc_info.value.status_code == 400
        assert "active" in exc_info.value.detail.lower()
        assert "BK-101" in exc_info.value.detail


@pytest.mark.asyncio
async def test_request_otp_succeeds_when_no_active_bookings():
    from app.routers.auth import request_account_deletion_otp, _deletion_otps
    with patch("app.routers.auth._check_active_clinical_records", return_value=[]):
        with patch.object(EmailService, "send_account_deletion_otp_email", return_value=True) as mock_email:
            user = {
                "sub": "clean-user-id",
                "email": "rahul.sharma@example.com",
                "role": "patient",
                "full_name": "Rahul Sharma"
            }
            res = await request_account_deletion_otp(current_user=user)
            assert res["success"] is True
            assert "masked_email" in res
            assert res["masked_email"].startswith("r")
            assert "@example.com" in res["masked_email"]
            assert "clean-user-id" in _deletion_otps
            otp_record = _deletion_otps["clean-user-id"]
            assert len(otp_record["otp"]) == 6
            assert otp_record["otp"].isdigit()
            mock_email.assert_called_once()

