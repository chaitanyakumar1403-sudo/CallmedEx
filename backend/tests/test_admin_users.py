"""
Admin users endpoint tests.

Verifies that the optional q (search) parameter on GET /api/admin/users
correctly filters by email (case-insensitive).
"""
import uuid

import pytest

import app.routers.admin as admin_mod
from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def admin_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(admin_mod, "supabase", fake)
    # Also patch the module-level supabase so check_admin_access doesn't fail
    monkeypatch.setattr("app.routers.admin.supabase", fake)
    return fake


def _seed_users(fake):
    """Seed a handful of test users with various emails."""
    fake.db.setdefault("users", []).extend([
        {"id": str(uuid.uuid4()), "full_name": "Alice Alpha", "email": "alice@test.com",
         "role": "phlebotomist", "city": "hyderabad", "is_active": True,
         "created_at": "2026-01-01T00:00:00Z", "managed_city": None},
        {"id": str(uuid.uuid4()), "full_name": "Bob Beta", "email": "bob@test.com",
         "role": "doctor", "city": "vizag", "is_active": True,
         "created_at": "2026-01-02T00:00:00Z", "managed_city": None},
        {"id": str(uuid.uuid4()), "full_name": "Charlie Gamma", "email": "charlie@example.com",
         "role": "patient", "city": "hyderabad", "is_active": True,
         "created_at": "2026-01-03T00:00:00Z", "managed_city": None},
        {"id": str(uuid.uuid4()), "full_name": "Diana Delta", "email": "diana@test.com",
         "role": "phlebotomist", "city": "vizag", "is_active": True,
         "created_at": "2026-01-04T00:00:00Z", "managed_city": None},
    ])


@pytest.mark.asyncio
async def test_get_users_no_q_returns_all(admin_db):
    _seed_users(admin_db)
    result = await admin_mod.get_users(current_user={"sub": "admin-id", "role": "admin"})
    assert len(result["users"]) == 4


@pytest.mark.asyncio
async def test_get_users_q_filters_by_email(admin_db):
    _seed_users(admin_db)
    result = await admin_mod.get_users(q="alice@test.com",
                                       current_user={"sub": "admin-id", "role": "admin"})
    assert len(result["users"]) == 1
    assert result["users"][0]["email"] == "alice@test.com"


@pytest.mark.asyncio
async def test_get_users_q_filters_by_email_partial(admin_db):
    _seed_users(admin_db)
    result = await admin_mod.get_users(q="test.com",
                                       current_user={"sub": "admin-id", "role": "admin"})
    assert len(result["users"]) == 3  # alice, bob, diana


@pytest.mark.asyncio
async def test_get_users_q_is_case_insensitive(admin_db):
    _seed_users(admin_db)
    result = await admin_mod.get_users(q="ALICE@TEST.COM",
                                       current_user={"sub": "admin-id", "role": "admin"})
    assert len(result["users"]) == 1
    assert result["users"][0]["email"] == "alice@test.com"


@pytest.mark.asyncio
async def test_get_users_q_with_no_matches(admin_db):
    _seed_users(admin_db)
    result = await admin_mod.get_users(q="nonexistent",
                                       current_user={"sub": "admin-id", "role": "admin"})
    assert len(result["users"]) == 0


@pytest.mark.asyncio
async def test_get_users_q_filters_with_role(admin_db):
    _seed_users(admin_db)
    result = await admin_mod.get_users(role="phlebotomist", q="test.com",
                                       current_user={"sub": "admin-id", "role": "admin"})
    # Only Alice and Diana have emails matching "test.com" AND are phlebotomists
    assert len(result["users"]) == 2
    for u in result["users"]:
        assert u["role"] == "phlebotomist"


@pytest.mark.asyncio
async def test_get_users_q_handles_special_chars(admin_db):
    _seed_users(admin_db)
    # Email with @ should still match
    result = await admin_mod.get_users(q="@test.com",
                                       current_user={"sub": "admin-id", "role": "admin"})
    assert len(result["users"]) == 3  # alice, bob, diana