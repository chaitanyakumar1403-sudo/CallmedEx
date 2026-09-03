"""
Unit & Integration Tests for Phase 0: Mobile Auth Prerequisites & Device Tokens
Verifies:
  1. Phone number normalization (+91, 10-digit, 0-prefix, formatted)
  2. SMS OTP Send & Rate Limiting (MSG91 service adapter)
  3. SMS OTP Verification & Brute-force Lockout Protection
  4. New Patient Auto-Creation via Phone OTP
  5. WhatsApp Headless Account Claiming via Phone OTP
  6. Existing User Phone OTP Login
  7. Refresh Token Rotation & Session Revocation (token_version)
  8. Biometric Registration, Challenge Nonce & Verification Login
  9. Device Push Token Registration & Lifecycle (FCM / APNs)
  10. Backward Compatibility of Existing Email/Password Login
"""
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.services.sms_otp import normalize_indian_phone, sms_otp_service, _otp_cache, _send_rate_cache, _lockout_cache
from app.utils.security import (
    create_access_token, decode_access_token,
    create_refresh_token, decode_refresh_token,
    hash_password,
)
from app.routers.auth import _local_users, _local_profiles

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_test_caches(monkeypatch):
    """Reset in-memory stores before and after each test."""
    monkeypatch.setattr("app.services.sms_otp.settings.OTP_PROVIDER", "mock")
    monkeypatch.setattr("app.services.sms_otp.settings.APP_ENV", "development")
    _otp_cache.clear()
    _send_rate_cache.clear()
    _lockout_cache.clear()
    yield
    _otp_cache.clear()
    _send_rate_cache.clear()
    _lockout_cache.clear()


# ─── 1. Phone Normalization Tests ──────────────────────────────────────────

def test_phone_normalization_formats():
    assert normalize_indian_phone("9876543210") == "+919876543210"
    assert normalize_indian_phone("09876543210") == "+919876543210"
    assert normalize_indian_phone("919876543210") == "+919876543210"
    assert normalize_indian_phone("+919876543210") == "+919876543210"
    assert normalize_indian_phone("+91 98765 43210") == "+919876543210"
    assert normalize_indian_phone(" 98765-43210 ") == "+919876543210"


def test_phone_normalization_invalid():
    with pytest.raises(Exception):
        normalize_indian_phone("12345")
    with pytest.raises(Exception):
        normalize_indian_phone("")


# ─── 2. OTP Send & Rate Limiting Tests ─────────────────────────────────────

def test_send_otp_success():
    res = client.post("/api/auth/otp/send", json={"phone": "9876543210", "role": "patient"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["phone"] == "+919876543210"
    assert "expires_in_seconds" in data["data"]


def test_send_otp_rate_limit_exceeded():
    phone = "9876500001"
    # Send 5 times successfully
    for _ in range(5):
        res = client.post("/api/auth/otp/send", json={"phone": phone})
        assert res.status_code == 200
    
    # 6th attempt within an hour must trigger 429
    res = client.post("/api/auth/otp/send", json={"phone": phone})
    assert res.status_code == 429
    assert "Too many OTP requests" in res.json()["detail"]


# ─── 3. OTP Verification & Lockout Tests ───────────────────────────────────

def test_verify_otp_invalid_code_and_lockout():
    phone = "9876500002"
    send_res = client.post("/api/auth/otp/send", json={"phone": phone})
    assert send_res.status_code == 200

    # 4 invalid attempts
    for _ in range(4):
        bad_res = client.post("/api/auth/otp/verify", json={"phone": phone, "otp": "999999"})
        assert bad_res.status_code == 400
        assert "Invalid OTP code" in bad_res.json()["detail"]

    # 5th invalid attempt triggers 423 lockout
    lock_res = client.post("/api/auth/otp/verify", json={"phone": phone, "otp": "999999"})
    assert lock_res.status_code == 423
    assert "Locked for" in lock_res.json()["detail"]


def test_verify_otp_expired():
    phone = "9876500003"
    send_res = client.post("/api/auth/otp/send", json={"phone": phone})
    dev_otp = send_res.json()["data"].get("dev_otp") or "000000"

    # Manually expire the OTP in cache
    norm_phone = normalize_indian_phone(phone)
    _otp_cache[norm_phone]["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=10)

    res = client.post("/api/auth/otp/verify", json={"phone": phone, "otp": dev_otp})
    assert res.status_code == 400
    assert "expired" in res.json()["detail"]


# ─── 4. New Patient Auto-Creation via Phone OTP ────────────────────────────

def test_verify_otp_creates_new_patient():
    import secrets
    random_digits = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    phone = f"9876{random_digits}"
    send_res = client.post("/api/auth/otp/send", json={"phone": phone})
    dev_otp = send_res.json()["data"].get("dev_otp") or "000000"

    verify_res = client.post("/api/auth/otp/verify", json={
        "phone": phone,
        "otp": dev_otp,
        "full_name": "Ravi Kumar"
    })
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["full_name"] == "Ravi Kumar"
    assert data["user"]["mobile"] == f"+91{phone}"
    assert data["user"]["role"] == "patient"
    assert data["user"]["is_new_user"] is True


# ─── 5. WhatsApp Headless Account Claiming ─────────────────────────────────

def test_verify_otp_claims_whatsapp_headless_account():
    import uuid
    phone = "+919876522222"
    sanitized = "919876522222"
    user_id = str(uuid.uuid4())

    # Pre-seed a headless WhatsApp patient
    _local_users[f"whatsapp+{sanitized}@patients.callmedex.internal"] = {
        "id": user_id,
        "full_name": "WhatsApp Patient",
        "email": f"whatsapp+{sanitized}@patients.callmedex.internal",
        "mobile": phone,
        "password_hash": hash_password("random_secret_pass_123"),
        "role": "patient",
        "registration_status": "active",
        "token_version": 1,
        "is_active": True,
    }

    # Patient logs in with phone OTP
    send_res = client.post("/api/auth/otp/send", json={"phone": phone})
    dev_otp = send_res.json()["data"].get("dev_otp") or "000000"

    verify_res = client.post("/api/auth/otp/verify", json={
        "phone": phone,
        "otp": dev_otp,
        "full_name": "Ananya Sharma"
    })
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["user"]["id"] == user_id
    assert data["user"]["full_name"] == "Ananya Sharma"
    assert data["user"]["is_new_user"] is False


# ─── 6. Refresh Token Rotation Tests ───────────────────────────────────────

def test_refresh_token_rotation_success():
    import uuid
    user_id = str(uuid.uuid4())
    _local_users["refresh_user@callmedex.com"] = {
        "id": user_id,
        "full_name": "Doctor Ramesh",
        "email": "refresh_user@callmedex.com",
        "role": "doctor",
        "password_hash": hash_password("Doctor@123"),
        "token_version": 1,
        "is_active": True,
    }

    # Create initial refresh token
    refresh_tok = create_refresh_token({
        "sub": user_id,
        "email": "refresh_user@callmedex.com",
        "role": "doctor",
    }, token_version=1)

    # Call refresh endpoint
    res = client.post("/api/auth/refresh-token", json={"refresh_token": refresh_tok})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["refresh_token"] != refresh_tok  # Rotated!
    assert data["user"]["id"] == user_id


def test_refresh_token_revocation_on_version_bump():
    import uuid
    user_id = str(uuid.uuid4())
    _local_users["revoked_user@callmedex.com"] = {
        "id": user_id,
        "full_name": "Nurse Maya",
        "email": "revoked_user@callmedex.com",
        "role": "nurse",
        "password_hash": hash_password("Nurse@123"),
        "token_version": 2,  # Bumped! (e.g. password changed or logged out)
        "is_active": True,
    }

    # Old token with version 1
    old_refresh_tok = create_refresh_token({
        "sub": user_id,
        "email": "revoked_user@callmedex.com",
        "role": "nurse",
    }, token_version=1)

    res = client.post("/api/auth/refresh-token", json={"refresh_token": old_refresh_tok})
    assert res.status_code == 401
    assert "revoked" in res.json()["detail"].lower() or "invalid" in res.json()["detail"].lower()


# ─── 7. Biometric Registration & Login Tests ───────────────────────────────

def test_biometric_registration_and_login_flow():
    import uuid
    user_id = str(uuid.uuid4())
    _local_users["bio_user@callmedex.com"] = {
        "id": user_id,
        "full_name": "Vikram Seth",
        "email": "bio_user@callmedex.com",
        "role": "patient",
        "password_hash": hash_password("Patient@123"),
        "token_version": 1,
        "is_active": True,
    }
    jwt_token = create_access_token({
        "sub": user_id,
        "email": "bio_user@callmedex.com",
        "role": "patient",
        "name": "Vikram Seth",
    })

    # 2. Register Biometric Key
    device_id = "iPhone-15-Pro-UUID-ABC"
    reg_res = client.post(
        "/api/auth/biometric/register",
        headers={"Authorization": f"Bearer {jwt_token}"},
        json={
            "device_id": device_id,
            "public_key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0...",
            "platform": "ios",
            "device_name": "Vikram's iPhone",
        },
    )
    assert reg_res.status_code == 200
    assert reg_res.json()["success"] is True

    # 3. Request Biometric Challenge
    chal_res = client.post("/api/auth/biometric/challenge", json={"device_id": device_id})
    assert chal_res.status_code == 200
    challenge = chal_res.json()["challenge"]
    assert len(challenge) > 16

    # 4. Verify Biometric Login
    verify_res = client.post("/api/auth/biometric/verify", json={
        "device_id": device_id,
        "challenge": challenge,
        "signature": "simulated_hardware_enclave_signature_base64",
    })
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["user"]["id"] == user_id
    assert "access_token" in data
    assert "refresh_token" in data


# ─── 8. Device Token Registration (FCM/APNs) ───────────────────────────────

def test_device_push_token_lifecycle():
    import uuid
    user_id = str(uuid.uuid4())
    _local_users["push_user@callmedex.com"] = {
        "id": user_id,
        "full_name": "Push User",
        "email": "push_user@callmedex.com",
        "role": "patient",
        "password_hash": hash_password("PushUser@123"),
        "token_version": 1,
        "is_active": True,
    }
    jwt_token = create_access_token({
        "sub": user_id,
        "email": "push_user@callmedex.com",
        "role": "patient",
        "name": "Push User",
    })
    auth_headers = {"Authorization": f"Bearer {jwt_token}"}

    push_token = "fcm_token_sample_abc123xyz789"

    # Register Token
    reg_res = client.post(
        "/api/notifications/register-device",
        headers=auth_headers,
        json={
            "push_token": push_token,
            "platform": "android",
            "device_name": "Pixel 8 Pro",
            "app_version": "1.0.0",
        },
    )
    assert reg_res.status_code == 200
    assert reg_res.json()["success"] is True

    # List Devices
    list_res = client.get("/api/notifications/devices", headers=auth_headers)
    assert list_res.status_code == 200
    devices = list_res.json()["data"]["devices"]
    assert any(d["push_token"] == push_token for d in devices)

    # Unregister Token
    unreg_res = client.request(
        "DELETE",
        "/api/notifications/unregister-device",
        headers=auth_headers,
        json={"push_token": push_token},
    )
    assert unreg_res.status_code == 200


# ─── 9. Email/Password Login Backward Compatibility ────────────────────────

def test_email_password_login_backward_compatibility():
    import uuid
    user_id = str(uuid.uuid4())
    _local_users["email_user@callmedex.com"] = {
        "id": user_id,
        "full_name": "Dr. Sunita",
        "email": "email_user@callmedex.com",
        "role": "doctor",
        "password_hash": hash_password("ValidPassword@123"),
        "token_version": 1,
        "is_active": True,
        "registration_status": "active",
    }

    res = client.post("/api/auth/login", json={
        "email": "email_user@callmedex.com",
        "password": "ValidPassword@123",
    })
    assert res.status_code == 200
    data = res.json()
    # Must contain both access_token and refresh_token
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "email_user@callmedex.com"

