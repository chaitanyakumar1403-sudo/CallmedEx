import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_phlebotomist_dispatch_unauthorized():
    # Attempt to access a phlebotomist route without auth
    response = client.get("/api/dispatch/phlebotomist/active")
    # Expected to be protected by Depends(get_current_user)
    assert response.status_code in [401, 403, 404]

def test_nurse_dispatch_unauthorized():
    # Attempt to access nurse dispatch routes
    response = client.get("/api/dispatch/nurse/active")
    assert response.status_code in [401, 403, 404]

def test_home_doctor_dispatch_unauthorized():
    # Attempt to access home doctor dispatch routes
    response = client.get("/api/dispatch/doctor/active")
    assert response.status_code in [401, 403, 404]
