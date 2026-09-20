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
