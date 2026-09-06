"""
Tests for Communications Notifications Endpoints & Aliasing
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.utils.security import create_access_token

import uuid

from app.routers.auth import _local_users

client = TestClient(app)

@pytest.fixture
def auth_headers():
    user_id = str(uuid.uuid4())
    email = f"patient_{user_id[:8]}@callmedex.com"
    _local_users[email] = {
        "id": user_id,
        "full_name": "Test Patient",
        "email": email,
        "role": "patient",
        "token_version": 1,
        "is_active": True,
    }
    token = create_access_token({"sub": user_id, "role": "patient"})
    return {"Authorization": f"Bearer {token}"}

def test_notifications_requires_auth():
    res = client.get("/api/communications/notifications")
    assert res.status_code in (401, 403)

    res_comm = client.get("/api/comm/notifications")
    assert res_comm.status_code in (401, 401, 403)

def test_notifications_alias_with_auth(auth_headers):
    res = client.get("/api/communications/notifications", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data.get("success") is True
    assert isinstance(data.get("notifications"), list)

def test_notifications_read_all(auth_headers):
    res = client.post("/api/communications/notifications/read-all", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data.get("success") is True
