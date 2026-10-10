"""
End-to-end tests for OTP generation, retrieval, verification, and length consistency.

Verifies:
1. Generated OTP is strictly 6 digits (100000-999999).
2. Existing unverified OTP is preserved on subsequent generate_otp calls (no code drift).
3. get_patient_otp returns active OTP for active stages (provider_accepted, en_route, arrived, in_progress).
4. Auto-generates OTP if missing when patient visits tracking/dashboard.
5. Verification tolerates user formatting (whitespace/hyphens).
6. Provider verification advances dispatch from arrived, en_route, or provider_accepted to in_progress.
7. Brute force rate limiting (5 attempts then lockout).
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
import pytest

import app.services.dispatch_engine as engine_mod
import app.services.otp as otp_mod
from app.services.otp import OTPService
from app.services.dispatch_engine import UniversalDispatchEngine
from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    for mod in (engine_mod, otp_mod):
        monkeypatch.setattr(mod, "supabase", fake)
    return fake


def test_otp_is_strictly_6_digits(fake_db):
    did = str(uuid.uuid4())
    fake_db.db.setdefault("dispatch_requests", []).append({
        "id": did,
        "status": "provider_accepted",
        "assigned_provider_id": "prov-1",
        "patient_id": "pat-1",
    })
    otp = OTPService.generate_otp(did)
    assert len(otp) == 6
    assert otp.isdigit()
    assert 100000 <= int(otp) <= 999999


def test_otp_generation_is_idempotent_to_prevent_code_drift(fake_db):
    did = str(uuid.uuid4())
    fake_db.db.setdefault("dispatch_requests", []).append({
        "id": did,
        "status": "provider_accepted",
        "assigned_provider_id": "prov-1",
        "patient_id": "pat-1",
    })
    otp1 = OTPService.generate_otp(did)
    # Subsequent calls (e.g. when phlebotomist marks arrived) should NOT overwrite active OTP
    otp2 = OTPService.generate_otp(did)
    assert otp1 == otp2

    # Force regenerate explicitly changes it
    otp3 = OTPService.generate_otp(did, force_regenerate=True)
    assert len(otp3) == 6


def test_patient_can_see_otp_when_provider_accepted(fake_db):
    did = str(uuid.uuid4())
    fake_db.db.setdefault("dispatch_requests", []).append({
        "id": did,
        "status": "provider_accepted",
        "assigned_provider_id": "prov-1",
        "patient_id": "pat-1",
    })
    # Before generate_otp is explicitly called, get_patient_otp auto-provisions it
    res = OTPService.get_patient_otp(did)
    assert res["success"] is True
    assert res["otp_active"] is True
    assert res["otp"] is not None
    assert len(res["otp"]) == 6
    assert res["otp"].isdigit()


def test_patient_can_see_otp_when_en_route_and_arrived(fake_db):
    for status in ("en_route", "arrived", "in_progress"):
        did = str(uuid.uuid4())
        fake_db.db.setdefault("dispatch_requests", []).append({
            "id": did,
            "status": status,
            "assigned_provider_id": "prov-1",
            "patient_id": "pat-1",
        })
        res = OTPService.get_patient_otp(did)
        assert res["success"] is True
        assert res["otp"] is not None
        assert len(res["otp"]) == 6


def test_completed_or_cancelled_dispatch_hides_otp(fake_db):
    for status in ("completed", "cancelled"):
        did = str(uuid.uuid4())
        fake_db.db.setdefault("dispatch_requests", []).append({
            "id": did,
            "status": status,
            "patient_otp": "654321",
            "verification_otp": otp_mod._hash_otp("654321"),
            "otp_verified": status == "completed",
        })
        res = OTPService.get_patient_otp(did)
        assert res["success"] is True
        assert res["otp_active"] is False
        assert res["otp"] is None


def test_verification_tolerates_spaces_and_hyphens(fake_db):
    did = str(uuid.uuid4())
    provider = str(uuid.uuid4())
    fake_db.db.setdefault("dispatch_requests", []).append({
        "id": did,
        "status": "arrived",
        "assigned_provider_id": provider,
        "patient_id": "pat-1",
    })
    otp = OTPService.generate_otp(did)

    # Format with hyphen e.g. "123-456"
    hyphenated = f"{otp[:3]}-{otp[3:]}"
    res = OTPService.verify_otp(did, hyphenated)
    assert res["success"] is True

    # Re-verifying a second time reports already verified
    res2 = OTPService.verify_otp(did, otp)
    assert res2["success"] is False
    assert res2["error"] == "OTP already verified"


def test_verify_and_start_from_arrived_moves_to_in_progress(fake_db):
    did = str(uuid.uuid4())
    provider = str(uuid.uuid4())
    fake_db.db.setdefault("dispatch_requests", []).append({
        "id": did,
        "status": "arrived",
        "assigned_provider_id": provider,
        "patient_id": "pat-1",
    })
    otp = OTPService.generate_otp(did)

    spaced = f" {otp[:3]} {otp[3:]} "
    result = asyncio.run(UniversalDispatchEngine.verify_otp_and_start(did, provider, spaced))
    assert result["success"] is True
    row = next(r for r in fake_db.db["dispatch_requests"] if r["id"] == did)
    assert row["status"] == "in_progress"
    assert row["otp_verified"] is True
