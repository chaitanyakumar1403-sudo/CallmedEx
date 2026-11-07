"""
End-to-end verification flow tests for phlebotomists (and providers).

Covers:
1. Structural verification logic for phlebotomists with certification numbers.
2. VerificationService.run_verification setting status and verified_at timestamp.
3. PUT /api/providers/profile column mapping (certification_number) and auto-verification.
4. GET /api/auth/me auto-healing phlebotomist verification status.
5. Admin verification toggle and GET /api/admin/users verification_status enrichment.
"""
import uuid
from datetime import datetime, timezone

import pytest

from tests.test_sample_lifecycle import FakeSupabase
import app.services.verification as verification_mod
from app.services.verification import VerificationService
import app.routers.provider_management as pm_mod
from app.routers.provider_management import ProviderProfileUpdate, update_provider_profile
import app.routers.auth as auth_mod
from app.routers.auth import get_me
import app.routers.admin as admin_mod
from app.routers.admin import UserUpdate, update_user, get_users


@pytest.fixture
def test_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(verification_mod, "supabase", fake)
    monkeypatch.setattr("app.services.verification.supabase", fake)
    monkeypatch.setattr(pm_mod, "supabase", fake)
    monkeypatch.setattr("app.routers.provider_management.supabase", fake)
    monkeypatch.setattr(auth_mod, "supabase", fake)
    monkeypatch.setattr("app.routers.auth.supabase", fake)
    monkeypatch.setattr(admin_mod, "supabase", fake)
    monkeypatch.setattr("app.routers.admin.supabase", fake)
    return fake


@pytest.mark.asyncio
async def test_structural_verify_phlebotomist_with_cert():
    """Phlebotomist with certification number '6483' passes structural verification."""
    # 1. Valid certification number with specialization
    doc = {
        "certification_number": "6483",
        "specialization": "Cold-Chain Certified (2C-8C)",
        "years_of_experience": 4,
    }
    res = await VerificationService._structural_verify_phlebotomist(doc)
    assert res["status"] == "verified"
    assert all(c["passed"] for c in res["checks"]) is True

    # 2. Valid certification number with qualification
    doc2 = {
        "certification_number": "DMLT-AP-8849",
        "qualification": "Diploma in Medical Lab Technology",
    }
    res2 = await VerificationService._structural_verify_phlebotomist(doc2)
    assert res2["status"] == "verified"
    assert all(c["passed"] for c in res2["checks"]) is True

    # 3. Missing certification number fails structural check
    doc_empty = {
        "certification_number": "",
        "specialization": "General",
    }
    res3 = await VerificationService._structural_verify_phlebotomist(doc_empty)
    assert res3["status"] != "verified"
    assert any(c["check"] == "certification_number" and not c["passed"] for c in res3["checks"])


@pytest.mark.asyncio
async def test_run_verification_sets_status_and_verified_at(test_db):
    """run_verification updates phlebotomists table with 'verified' and timestamp."""
    p_id = str(uuid.uuid4())
    u_id = str(uuid.uuid4())
    test_db.db.setdefault("phlebotomists", []).append({
        "id": p_id,
        "user_id": u_id,
        "certification_number": "6483",
        "specialization": "Cold-Chain Certified",
        "qualification": "Certified Phlebotomist",
        "verification_status": "pending",
        "verified_at": None,
    })

    result = await VerificationService.run_verification(
        user_id=u_id,
        role="phlebotomist",
    )

    assert result["status"] == "verified"
    phleb_row = test_db.db["phlebotomists"][0]
    assert phleb_row["verification_status"] == "verified"
    assert phleb_row["verified_at"] is not None


@pytest.mark.asyncio
async def test_provider_profile_update_phlebotomist_auto_verifies(test_db):
    """Saving profile with certification_number maps correctly and auto-verifies."""
    u_id = str(uuid.uuid4())
    test_db.db.setdefault("users", []).append({
        "id": u_id,
        "email": "syamsundar262@gmail.com",
        "role": "phlebotomist",
        "full_name": "R VENKATA RAMANA MURTHY",
    })
    test_db.db.setdefault("phlebotomists", []).append({
        "id": str(uuid.uuid4()),
        "user_id": u_id,
        "certification_number": None,
        "qualification": None,
        "specialization": None,
        "verification_status": "pending",
    })

    update_payload = ProviderProfileUpdate(
        medical_license_number="6483",  # Passed from form
        specialization="Cold-Chain Certified (2C-8C)",
        qualification="Certified Phlebotomist (Cold-Chain)",
        years_of_experience=5,
        bio="Experienced phlebotomist specializing in cold chain samples",
        hospital_clinic_name="Apollo Clinic",  # Non-existent on phlebotomists, must not cause error
    )

    caller = {"sub": u_id, "role": "phlebotomist"}
    res = await update_provider_profile(update_payload, current_user=caller)

    assert res["success"] is True
    assert res.get("verification_status") == "verified"

    # Verify DB state
    phleb_row = test_db.db["phlebotomists"][0]
    assert phleb_row["certification_number"] == "6483"
    assert phleb_row["verification_status"] == "verified"
    # Ensure invalid columns were NOT inserted into phlebotomists
    assert "hospital_clinic_name" not in phleb_row
    assert "medical_license_number" not in phleb_row


@pytest.mark.asyncio
async def test_get_me_auto_heals_phlebotomist_verification(test_db):
    """GET /api/auth/me self-heals status for phlebotomist with valid certification on file."""
    u_id = str(uuid.uuid4())
    test_db.db.setdefault("users", []).append({
        "id": u_id,
        "email": "syamsundar262@gmail.com",
        "role": "phlebotomist",
        "full_name": "R VENKATA RAMANA MURTHY",
    })
    test_db.db.setdefault("phlebotomists", []).append({
        "id": str(uuid.uuid4()),
        "user_id": u_id,
        "certification_number": "6483",
        "specialization": "Cold-Chain Certified (2C-8C)",
        "verification_status": "pending",  # Stuck in pending
        "verified_at": None,
    })

    caller = {"sub": u_id, "role": "phlebotomist", "email": "syamsundar262@gmail.com"}
    res = await get_me(current_user=caller)

    # get_me should return verified
    assert res.data["verification_status"] == "verified"
    # And database should be healed
    assert test_db.db["phlebotomists"][0]["verification_status"] == "verified"
    assert test_db.db["phlebotomists"][0]["verified_at"] is not None


@pytest.mark.asyncio
async def test_admin_verification_toggle_and_users_enrichment(test_db):
    """Admin can toggle verification_status and GET /users enriches status from role table."""
    admin_id = str(uuid.uuid4())
    phleb_user_id = str(uuid.uuid4())

    test_db.db.setdefault("users", []).extend([
        {
            "id": admin_id,
            "email": "admin@callmedex.com",
            "role": "admin",
            "full_name": "Super Admin",
            "city": "Hyderabad",
            "is_active": True,
            "created_at": "2026-01-01T00:00:00Z",
            "managed_city": None,
        },
        {
            "id": phleb_user_id,
            "email": "phlebo@callmedex.com",
            "role": "phlebotomist",
            "full_name": "Phlebo One",
            "city": "Hyderabad",
            "is_active": True,
            "created_at": "2026-01-02T00:00:00Z",
            "managed_city": None,
        },
    ])
    test_db.db.setdefault("phlebotomists", []).append({
        "id": str(uuid.uuid4()),
        "user_id": phleb_user_id,
        "certification_number": "6483",
        "verification_status": "pending",
        "verified_at": None,
    })

    admin_caller = {"sub": admin_id, "role": "admin"}

    # 1. GET /users before toggle -> should show 'pending' for phlebo
    users_resp = await get_users(current_user=admin_caller)
    phleb_entry = next(u for u in users_resp["users"] if u["id"] == phleb_user_id)
    assert phleb_entry["verification_status"] == "pending"

    # 2. Admin verifies user via PATCH /users/{user_id}
    patch_res = await update_user(phleb_user_id, UserUpdate(verification_status="verified"), current_user=admin_caller)
    assert patch_res["success"] is True
    assert test_db.db["phlebotomists"][0]["verification_status"] == "verified"
    assert test_db.db["phlebotomists"][0]["verified_at"] is not None

    # 3. GET /users after toggle -> should show 'verified'
    users_resp2 = await get_users(current_user=admin_caller)
    phleb_entry2 = next(u for u in users_resp2["users"] if u["id"] == phleb_user_id)
    assert phleb_entry2["verification_status"] == "verified"

    # 4. Admin revokes verification
    revoke_res = await update_user(phleb_user_id, UserUpdate(verification_status="pending"), current_user=admin_caller)
    assert revoke_res["success"] is True
    assert test_db.db["phlebotomists"][0]["verification_status"] == "pending"
