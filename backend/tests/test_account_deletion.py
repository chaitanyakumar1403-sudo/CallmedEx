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


@pytest.mark.asyncio
async def test_verify_otp_invalid_code():
    from app.routers.auth import verify_account_deletion, _deletion_otps, DeleteAccountVerifyRequest
    from datetime import datetime, timezone, timedelta
    from fastapi import HTTPException

    user_id = "test-user-inv-otp"
    _deletion_otps[user_id] = {
        "otp": "654321",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "attempts": 0,
        "created_at": datetime.now(timezone.utc),
        "email": "test@example.com",
    }

    user = {"sub": user_id, "email": "test@example.com", "role": "patient"}
    payload = DeleteAccountVerifyRequest(otp="999999", reason="Leaving")

    with pytest.raises(HTTPException) as exc_info:
        await verify_account_deletion(payload=payload, current_user=user)
    assert exc_info.value.status_code == 400
    assert "invalid" in exc_info.value.detail.lower()
    assert _deletion_otps[user_id]["attempts"] == 1


@pytest.mark.asyncio
async def test_verify_otp_locks_after_3_attempts():
    from app.routers.auth import verify_account_deletion, _deletion_otps, DeleteAccountVerifyRequest
    from datetime import datetime, timezone, timedelta
    from fastapi import HTTPException

    user_id = "test-user-lock-otp"
    _deletion_otps[user_id] = {
        "otp": "654321",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "attempts": 2,
        "created_at": datetime.now(timezone.utc),
        "email": "test@example.com",
    }

    user = {"sub": user_id, "email": "test@example.com", "role": "patient"}
    payload = DeleteAccountVerifyRequest(otp="000000", reason="Leaving")

    with pytest.raises(HTTPException) as exc_info:
        await verify_account_deletion(payload=payload, current_user=user)
    assert exc_info.value.status_code == 400
    assert "maximum invalid attempts" in exc_info.value.detail.lower() or "revoked" in exc_info.value.detail.lower()
    assert user_id not in _deletion_otps


@pytest.mark.asyncio
async def test_verify_otp_executes_cascade_deletion():
    from app.routers.auth import verify_account_deletion, _deletion_otps, DeleteAccountVerifyRequest, _local_users
    from datetime import datetime, timezone, timedelta

    user_id = "cascade-del-user-id"
    _deletion_otps[user_id] = {
        "otp": "777888",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "attempts": 0,
        "created_at": datetime.now(timezone.utc),
        "email": "cascade@example.com",
    }
    _local_users["cascade@example.com"] = {"id": user_id, "email": "cascade@example.com", "role": "doctor"}

    user = {"sub": user_id, "email": "cascade@example.com", "role": "doctor"}
    payload = DeleteAccountVerifyRequest(otp="777888", reason="Retiring")

    with patch("app.routers.auth.supabase") as mock_sp:
        # Mock table calls
        mock_table = mock_sp.table.return_value
        mock_table.delete.return_value.eq.return_value.execute.return_value = None
        mock_table.delete.return_value.in_.return_value.execute.return_value = None
        mock_table.select.return_value.or_.return_value.execute.return_value.data = []
        mock_table.select.return_value.eq.return_value.execute.return_value.data = []

        res = await verify_account_deletion(payload=payload, current_user=user)
        assert res["success"] is True
        assert "deleted" in res["message"].lower()

        # Check that Supabase Auth admin was called
        mock_sp.auth.admin.delete_user.assert_called_with(user_id)

        # Check local memory user cleared
        assert "cascade@example.com" not in _local_users
        assert user_id not in _deletion_otps


