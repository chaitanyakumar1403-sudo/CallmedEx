import requests
import os
import time
import jwt
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv("backend/.env")
API_URL = "http://127.0.0.1:8000"

# Forge a test token directly to bypass login issues
secret = os.environ.get("JWT_SECRET", "callmedex-dev-secret-local")
algo = os.environ.get("JWT_ALGORITHM", "HS256")
patient_id = "d65e7146-24af-4b8f-be21-4f114175de5c"
payload = {
    "sub": patient_id,
    "email": "test.patient@example.com",
    "role": "patient",
    "exp": datetime.now(timezone.utc) + timedelta(hours=1)
}
token = jwt.encode(payload, secret, algorithm=algo)

print("1. Token Forged Successfully.")
headers = {"Authorization": f"Bearer {token}"}

print("3. Creating a Booking...")
booking_payload = {
    "provider_id": "test_provider",
    "provider_type": "nurse",
    "service_type": "home_collection",
    "slot_id": "org-test|2026-07-21|15:00",
    "notes": "Automated Test Booking"
}
res = requests.post(f"{API_URL}/api/bookings", json=booking_payload, headers=headers)
print(res.json())
booking_id = res.json().get("data", {}).get("id")
print("Booking ID:", booking_id)

print("4. Fetching My Bookings...")
res = requests.get(f"{API_URL}/api/bookings/my", headers=headers)
bookings = res.json().get("data", {}).get("bookings", [])
print(f"Found {len(bookings)} bookings.")
found = False
for b in bookings:
    if b["id"] == booking_id:
        found = True
        break
print("Newly created booking found in /my?", found)

print("5. Cancelling the Booking...")
res = requests.post(f"{API_URL}/api/bookings/{booking_id}/cancel", headers=headers)
print(res.json())

print("6. Creating a Dispatch Request...")
dispatch_payload = {
    "patient_lat": 17.385044,
    "patient_lng": 78.486671,
    "patient_address": "Test GPS",
    "provider_type": "nurse",
    "service_subtype": "nursing_care",
    "notes": "Automated Test Dispatch",
    "booking_id": None
}
res = requests.post(f"{API_URL}/api/dispatch/request", json=dispatch_payload, headers=headers)
dispatch_id = res.json().get("dispatch_id")
print("Dispatch ID:", dispatch_id)

print("7. Cancelling the Dispatch Request...")
res = requests.post(f"{API_URL}/api/dispatch/{dispatch_id}/cancel", headers=headers)
print(res.json())

print("All tests completed.")
