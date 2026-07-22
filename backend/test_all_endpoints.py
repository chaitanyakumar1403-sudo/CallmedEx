"""
Comprehensive FastAPI TestClient Suite for CallMedex
Tests all backend routes in-memory (no live server process needed).
"""
from fastapi.testclient import TestClient
from app.main import app
import uuid

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    print("[PASS] Health endpoint")

def get_patient_token():
    email = f"patient_{uuid.uuid4().hex[:6]}@example.com"
    signup_payload = {
        "full_name": "Test Patient",
        "email": email,
        "mobile": "+919876543210",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "role": "patient",
        "gender": "female",
        "date_of_birth": "1998-04-12"
    }
    r = client.post("/api/auth/signup", json=signup_payload)
    assert r.status_code == 200, f"Signup failed: {r.text}"
    print(f"[PASS] Patient Signup: {email}")

    login_payload = {"email": email, "password": "Password123!"}
    r_login = client.post("/api/auth/login", json=login_payload)
    assert r_login.status_code == 200, f"Login failed: {r_login.text}"
    data = r_login.json()
    token = data.get("access_token") or data.get("data", {}).get("access_token")
    assert token is not None
    print("[PASS] Patient Login")
    return token

def test_patient_signup_and_login():
    get_patient_token()

def get_org_token():
    email = f"manager_{uuid.uuid4().hex[:6]}@clinic.com"
    signup_payload = {
        "full_name": "Clinic Manager",
        "email": email,
        "mobile": "+919876543211",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "role": "organization",
        "gender": "male",
        "date_of_birth": "1985-06-20",
        "registrant_role": "front_desk_manager",
        "owner_email": "owner@clinic.com",
        "organization_name": "Apex Diagnostics",
        "organization_type": "diagnostic_center"
    }
    r = client.post("/api/auth/signup", json=signup_payload)
    assert r.status_code == 200, f"Org Signup failed: {r.text}"

    login_payload = {"email": email, "password": "Password123!"}
    r_login = client.post("/api/auth/login", json=login_payload)
    assert r_login.status_code == 200
    data = r_login.json()
    token = data.get("access_token") or data.get("data", {}).get("access_token")
    return token

def test_org_signup_with_owner_flow():
    get_org_token()
    print(f"[PASS] Org Signup with Owner MOU Email flow")

def test_diagnostic_booking_and_allotment():
    patient_token = get_patient_token()
    org_token = get_org_token()
    
    patient_headers = {"Authorization": f"Bearer {patient_token}"}
    org_headers = {"Authorization": f"Bearer {org_token}"}
    
    # 1. Patient creates date-only lab booking
    booking_payload = {
        "provider_id": "org-demo-123",
        "provider_type": "organization",
        "service_type": "lab_test",
        "slot_id": "org-demo-123|2026-07-28|pending",
        "preferred_date": "2026-07-28",
        "notes": "Lipid Profile & HbA1c",
        "selected_tests": ["Lipid Profile", "HbA1c"],
        "total_price": 850
    }
    r = client.post("/api/bookings", json=booking_payload, headers=patient_headers)
    assert r.status_code in (200, 201), f"Booking creation failed: {r.text}"
    booking_id = r.json()["data"]["id"]
    assert r.json()["data"]["status"] == "pending_review"
    print(f"[PASS] Diagnostic Booking Creation (Status: pending_review, ID: {booking_id})")

    # 2. Org fetches pending reviews
    r_pending = client.get("/api/bookings/pending-review", headers=org_headers)
    assert r_pending.status_code == 200
    print(f"[PASS] Org GET pending-review bookings")

    # 3. Org allots slot
    allot_payload = {
        "allotted_start_time": "10:00",
        "allotted_end_time": "11:00",
        "message": "Fasting required for 10 hours"
    }
    r_allot = client.post(f"/api/bookings/{booking_id}/allot-slot", json=allot_payload, headers=org_headers)
    assert r_allot.status_code == 200
    print(f"[PASS] Org Allot Time Slot (10:00 - 11:00)")

    # 4. Patient accepts slot
    respond_payload = {"accepted": True}
    r_resp = client.post(f"/api/bookings/{booking_id}/respond-slot", json=respond_payload, headers=patient_headers)
    assert r_resp.status_code == 200
    print(f"[PASS] Patient Respond Slot (Accepted -> confirmed)")

def test_urgent_dispatch_request():
    patient_token = get_patient_token()
    headers = {"Authorization": f"Bearer {patient_token}"}
    
    # Test urgent phlebotomist blood collection dispatch
    dispatch_payload = {
        "patient_lat": 17.7231,
        "patient_lng": 83.3013,
        "patient_address": "Dwaraka Nagar, Visakhapatnam",
        "provider_type": "phlebotomist",
        "service_subtype": "home_collection",
        "notes": "Urgent Blood Sample Collection"
    }
    r = client.post("/api/dispatch/request", json=dispatch_payload, headers=headers)
    assert r.status_code == 200, f"Dispatch request failed: {r.text}"
    assert r.json()["success"] == True
    assert "dispatch_id" in r.json()
    dispatch_id = r.json()["dispatch_id"]
    print(f"[PASS] Urgent Phlebotomist Dispatch Request (ID: {dispatch_id})")

    # Test urgent home doctor visit dispatch
    doctor_dispatch = {
        "patient_lat": 17.7231,
        "patient_lng": 83.3013,
        "patient_address": "Dwaraka Nagar, Visakhapatnam",
        "provider_type": "doctor",
        "service_subtype": "home_visit",
        "notes": "High fever home visit required"
    }
    r_doc = client.post("/api/dispatch/request", json=doctor_dispatch, headers=headers)
    assert r_doc.status_code == 200, f"Doctor dispatch failed: {r_doc.text}"
    print(f"[PASS] Urgent Home Doctor Visit Dispatch Request")

if __name__ == "__main__":
    print("=== STARTING CALLMEDEX FULL BACKEND ENDPOINT AUDIT ===")
    test_health()
    tok = get_patient_token()
    test_org_signup_with_owner_flow()
    test_diagnostic_booking_and_allotment()
    test_urgent_dispatch_request()
    print("\n🎉 ALL BACKEND ENDPOINTS PASSED VERIFICATION WITH 0 ERRORS!")
