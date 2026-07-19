import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_pharmacy_inventory():
    # Attempting without auth should fail or be mocked depending on the router logic
    # Since we use Depends(get_current_user), it requires a valid token
    # For a staging environment without auth mock, we expect a 403 or 401
    response = client.get("/api/pharmacy/inventory")
    # In FastAPI, Depends(get_current_user) raises 401 if missing token, or 403 if invalid scope
    assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"

def test_search_organizations():
    # This is a public route, should return 200
    response = client.get("/api/providers/search/organizations")
    assert response.status_code == 200
    data = response.json()
    assert "organizations" in data
    assert data["success"] is True
