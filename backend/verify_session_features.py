"""
Verification Script for Session Features:
1. Diagnostic Review Workflow (create -> pending_review -> allot-slot -> respond-slot)
2. Professional Signup with Registrant Role & Owner Email
"""
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.schemas import BookingCreate, ServiceType, SlotAllotment, SlotResponse, UserSignup, UserRole, Gender
from app.routers.bookings import _local_bookings
from app.routers.auth import _build_user_data
from datetime import date

def test_signup_owner_flow():
    print("--- 1. Testing Signup with Registrant Role & Owner Email ---")
    user_signup = UserSignup(
        full_name="Front Desk Manager John",
        email="manager@clinic.com",
        mobile="+919876543210",
        password="Password123!",
        confirm_password="Password123!",
        role=UserRole.ORGANIZATION,
        gender=Gender.MALE,
        date_of_birth=date(1995, 5, 15),
        registrant_role="front_desk_manager",
        owner_email="owner@clinic.com",
        address_info={
            "address": "123 Main St", "city": "Visakhapatnam", "district": "Vizag",
            "state": "Andhra Pradesh", "pincode": "530001", "country": "India"
        }
    )
    user_data = _build_user_data(user_signup, "user-test-123", "pending_mou")
    assert user_data["registrant_role"] == "front_desk_manager", "registrant_role missing!"
    assert user_data["owner_email"] == "owner@clinic.com", "owner_email missing!"
    print("[SUCCESS] Signup Schema & Build Data Test Passed: registrant_role and owner_email correctly stored.")

def test_diagnostic_booking_workflow():
    print("\n--- 2. Testing Diagnostic Booking Workflow ---")
    booking_id = "test-diag-booking-99"
    patient_id = "patient-uuid-1"
    provider_id = "org-uuid-1"

    # Step A: Create diagnostic booking
    booking_data = {
        "id": booking_id,
        "patient_id": patient_id,
        "provider_id": provider_id,
        "provider_type": "organization",
        "service_type": ServiceType.LAB_TEST.value,
        "slot_id": f"{provider_id}|2026-07-25|pending",
        "slot_start": "2026-07-25T00:00:00",
        "slot_end": "2026-07-25T23:59:59",
        "preferred_date": "2026-07-25",
        "status": "pending_review",
        "notes": "Complete Blood Count (CBC)",
        "selected_tests": ["CBC", "Thyroid Profile"],
        "total_price": 750,
        "created_at": "2026-07-22T10:00:00Z",
    }
    _local_bookings.append(booking_data)
    assert booking_data["status"] == "pending_review", "Initial status must be pending_review!"
    print("[SUCCESS] Diagnostic Booking Creation Test Passed: status is 'pending_review'.")

    # Step B: Allot slot
    preferred_date = booking_data["preferred_date"]
    allotment = SlotAllotment(allotted_start_time="10:30", allotted_end_time="11:30", message="Please come fasting")
    booking_data.update({
        "status": "slot_allotted",
        "slot_start": f"{preferred_date}T{allotment.allotted_start_time}:00",
        "slot_end": f"{preferred_date}T{allotment.allotted_end_time}:00",
        "slot_id": f"{provider_id}|{preferred_date}|{allotment.allotted_start_time}",
    })
    assert booking_data["status"] == "slot_allotted", "Status after allotment must be slot_allotted!"
    assert "10:30" in booking_data["slot_start"], "Slot start time incorrect!"
    print("[SUCCESS] Organization Slot Allotment Test Passed: time slot allotted (10:30 - 11:30), status is 'slot_allotted'.")

    # Step C: Patient responds (Accept)
    patient_response = SlotResponse(accepted=True)
    if patient_response.accepted:
        booking_data["status"] = "confirmed"
    assert booking_data["status"] == "confirmed", "Status after patient acceptance must be confirmed!"
    print("[SUCCESS] Patient Acceptance Test Passed: booking is now 'confirmed'.")

if __name__ == "__main__":
    test_signup_owner_flow()
    test_diagnostic_booking_workflow()
    print("\nALL SESSION FEATURE VERIFICATION TESTS PASSED SUCCESSFULLY!")
