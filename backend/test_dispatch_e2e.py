"""End-to-end test for the dispatch notification fix.
Creates fresh test accounts, links phlebotomist to a processing centre,
books a home collection, and verifies the phlebotomist receives the dispatch offer.

Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (from .env file or shell).
"""
import os
import requests
import sys
import random
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()  # reads backend/.env if run from backend/

BASE = "https://callmedex-backend.onrender.com"
results = []

# Read from environment — never hardcode service keys in source
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("FATAL: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment.")
    print("Hint: run from backend/ dir with a .env file, or set them before running.")
    sys.exit(1)
sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def log(step, ok, detail=""):
    icon = "PASS" if ok else "FAIL"
    print(f"  [{icon}] {step}")
    if detail:
        print(f"       {detail[:300]}")
    results.append((step, ok, detail))


def _rows(result) -> list:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def main():
    print("=" * 60)
    print("END-TO-END DISPATCH NOTIFICATION TEST")
    print("=" * 60)
    print()

    ts = int(random.random() * 1000000)

    # ═══════════════════════════════════════════════════════════════
    # Step 1: Create test patient
    # ═══════════════════════════════════════════════════════════════
    print("1. Create test patient account")
    patient_email = f"testpatient{ts}@test.callmedex.com"
    patient_pass = "Test@12345"

    r = requests.post(f"{BASE}/api/auth/signup", json={
        "email": patient_email,
        "password": patient_pass,
        "confirm_password": patient_pass,
        "full_name": "Test Patient E2E",
        "role": "patient",
        "mobile": f"99999{ts % 100000:05d}",
        "gender": "male",
        "date_of_birth": "1990-01-01",
    })
    patient_token = None
    if r.status_code in (200, 201):
        data = r.json()
        patient_token = data.get("data", {}).get("access_token") or data.get("access_token", "")
        log("Patient signup", True, f"Email: {patient_email}")
    else:
        log("Patient signup", False, f"Status {r.status_code}: {r.text[:200]}")
        patient_email = None

    # ═══════════════════════════════════════════════════════════════
    # Step 2: Create test phlebotomist
    # ═══════════════════════════════════════════════════════════════
    print()
    print("2. Create test phlebotomist account")
    phlebo_email = f"testphlebo{ts}@test.callmedex.com"
    phlebo_pass = "Test@12345"

    r = requests.post(f"{BASE}/api/auth/signup", json={
        "email": phlebo_email,
        "password": phlebo_pass,
        "confirm_password": phlebo_pass,
        "full_name": "Test Phlebotomist E2E",
        "role": "phlebotomist",
        "mobile": f"88888{ts % 100000:05d}",
        "gender": "male",
        "date_of_birth": "1990-01-01",
        "qualification": "MLT",
        "specialization": "Phlebotomy",
        "phlebo_type": "full_time",
    })
    mou_token = None
    phlebo_token = None
    phlebo_user_id = None
    if r.status_code in (200, 201):
        data = r.json()
        mou_token = data.get("data", {}).get("mou_token")
        log("Phlebotomist signup", True, f"Email: {phlebo_email}, mou_token={'yes' if mou_token else 'no'}")
    else:
        log("Phlebotomist signup", False, f"Status {r.status_code}: {r.text[:300]}")

    if mou_token:
        print("   Accepting MOU to activate account...")
        r = requests.post(f"{BASE}/api/auth/accept-mou", json={"token": mou_token})
        log("MOU accepted", r.status_code == 200, f"Status {r.status_code}" if r.status_code != 200 else "")

        print("   Logging in...")
        r = requests.post(f"{BASE}/api/auth/login", json={
            "email": phlebo_email, "password": phlebo_pass,
        })
        if r.status_code == 200:
            data = r.json()
            phlebo_token = data.get("data", {}).get("access_token") or data.get("access_token", "")
            log("Phlebotomist login", bool(phlebo_token))

    if not patient_token:
        print("   Trying login for patient...")
        r = requests.post(f"{BASE}/api/auth/login", json={
            "email": patient_email, "password": patient_pass,
        })
        if r.status_code == 200:
            data = r.json()
            patient_token = data.get("data", {}).get("access_token") or data.get("access_token", "")
            log("Patient login", bool(patient_token))

    if not phlebo_token:
        print("\n   Cannot proceed without phlebotomist token")
        print("\nSUMMARY: EARLY EXIT - could not authenticate phlebotomist")
        return 1

    if not patient_token:
        print("\n   Cannot proceed without patient token")
        print("\nSUMMARY: EARLY EXIT - could not authenticate patient")
        return 1

    # ═══════════════════════════════════════════════════════════════
    # Step 3: Look up processing centre & link phlebotomist
    # ═══════════════════════════════════════════════════════════════
    print()
    print("3. Link phlebotomist to a processing centre")

    # Decode JWT to get user_id (parse the payload)
    jwt_payload = phlebo_token.split(".")[1]
    import base64, json as _json
    padded = jwt_payload + "=" * (4 - len(jwt_payload) % 4)
    try:
        decoded = _json.loads(base64.urlsafe_b64decode(padded))
        phlebo_user_id = decoded.get("sub")
        log("Decoded phlebo user_id from JWT", bool(phlebo_user_id), f"user_id: {phlebo_user_id}")
    except Exception as e:
        log("Decode JWT", False, str(e))

    # Find any active processing centre
    centres = _rows(sb.table("processing_centers").select("id, name, city").eq("status", "active").limit(5).execute())
    if not centres:
        log("Active processing centres found", False, "NONE — cannot link phlebotomist")
        return 1

    centre = centres[0]
    log("Active processing centre found", True, f"{centre.get('name', '?')} ({centre['id'][:12]}...)")

    # Link phlebotomist to this centre
    phlebo_rows = _rows(
        sb.table("phlebotomists").select("id").eq("user_id", phlebo_user_id).limit(1).execute()
    )
    if not phlebo_rows:
        log("Phlebotomist profile found", False, "No phlebotomists row for this user")
        return 1

    phlebo_db_id = phlebo_rows[0]["id"]
    try:
        sb.table("phlebotomists").update({
            "processing_center_id": centre["id"],
            "verification_status": "verified",
        }).eq("id", phlebo_db_id).execute()
        log("Phlebotomist linked to centre", True, f"processing_center_id: {centre['id'][:12]}...")
    except Exception as e:
        log("Link phlebotomist to centre", False, str(e))
        return 1

    # ═══════════════════════════════════════════════════════════════
    # Step 4: Phlebotomist goes online + sends GPS
    # ═══════════════════════════════════════════════════════════════
    print()
    print("4. Phlebotomist goes online + sends GPS location")

    r = requests.post(
        f"{BASE}/api/dispatch/toggle-duty",
        json={"is_online": True},
        headers={"Authorization": f"Bearer {phlebo_token}"}
    )
    log("Toggle duty ON", r.status_code == 200,
        f"Status {r.status_code}" if r.status_code != 200 else "")

    r = requests.post(
        f"{BASE}/api/dispatch/update-location",
        json={"provider_type": "phlebotomist", "lat": 17.6868, "lng": 83.2185},
        headers={"Authorization": f"Bearer {phlebo_token}"}
    )
    log("Update GPS location", r.status_code == 200,
        f"Status {r.status_code}" if r.status_code != 200 else "")

    # ═══════════════════════════════════════════════════════════════
    # Step 5: Verify phlebotomist is found nearby
    # ═══════════════════════════════════════════════════════════════
    print()
    print("5. Verify phlebotomist appears in nearby search")

    r = requests.get(
        f"{BASE}/api/dispatch/nearby?lat=17.6868&lng=83.2185&provider_type=phlebotomist&radius_km=10",
        headers={"Authorization": f"Bearer {patient_token}"}
    )
    if r.status_code == 200:
        providers = r.json().get("providers", [])
        found = any(p.get("name", "").startswith("Test Phlebotomist") for p in providers)
        log("Test phlebotomist in nearby search", found,
            f"Found {len(providers)} total provider(s)")
        if not found:
            log("CRITICAL: phlebotomist invisible to dispatcher", False, "Not in nearby search results")
    else:
        log("Nearby search", False, f"Status {r.status_code}")

    # ═══════════════════════════════════════════════════════════════
    # Step 6: Verify zero pending offers before booking
    # ═══════════════════════════════════════════════════════════════
    print()
    print("6. Verify zero pending offers before booking")

    r = requests.get(
        f"{BASE}/api/dispatch/offers/pending",
        headers={"Authorization": f"Bearer {phlebo_token}"}
    )
    if r.status_code == 200:
        before = len(r.json().get("offers", []))
        log(f"Pending offers before booking: {before}", before == 0,
            f"Expected 0, got {before}")

    # ═══════════════════════════════════════════════════════════════
    # Step 7: Patient books CBC home collection
    # ═══════════════════════════════════════════════════════════════
    print()
    print("7. Patient books CBC home collection")

    r = requests.post(
        f"{BASE}/api/bookings",
        json={
            "provider_id": "",
            "provider_type": "organization",
            "slot_id": "none|2026-08-01|pending",
            "service_type": "lab_test",
            "selected_tests": ["CBC"],
            "preferred_date": "2026-08-01",
            "home": True,
            "city": "Visakhapatnam",
            "collection_address": "Test address, Visakhapatnam",
            "catalog_id": "CBC",
        },
        headers={"Authorization": f"Bearer {patient_token}"}
    )

    if r.status_code == 200:
        booking_data = r.json().get("data", {})
        booking_id = booking_data.get("id", "")
        log("Home collection booking created", True, f"ID: {booking_id}")
        print(f"       Status: {booking_data.get('status')}")
        print(f"       Kind: {booking_data.get('booking_kind', 'N/A')}")

        # Confirm the processing centre was assigned
        b_row = _rows(sb.table("bookings").select("processing_center_id").eq("id", booking_id).limit(1).execute())
        if b_row and b_row[0].get("processing_center_id"):
            assigned_pc = b_row[0]["processing_center_id"]
            log("Booking assigned to processing centre", assigned_pc == centre["id"],
                f"Assigned: {assigned_pc[:12]}..., Expected: {centre['id'][:12]}...")
        else:
            log("Booking has processing_center_id", False, "None assigned")
            booking_id = ""
    else:
        booking_id = ""
        log("Booking", False, f"Status {r.status_code}: {r.text[:400]}")

    # ═══════════════════════════════════════════════════════════════
    # Step 8: Verify dispatch request + offers
    # ═══════════════════════════════════════════════════════════════
    print()
    print("8. Verify dispatch request + offers created")

    if booking_id:
        # Wait a moment for async dispatch to complete
        import time; time.sleep(1)

        r = requests.get(
            f"{BASE}/api/dispatch/debug/booking/{booking_id}",
        )
        if r.status_code == 200:
            state = r.json()
            dr_count = state.get("dispatch_count", 0)
            offer_count = state.get("offer_count", 0)

            log("Dispatch request created", dr_count > 0,
                f"{dr_count} request(s)")
            log("Dispatch offers created", offer_count > 0,
                f"{offer_count} offer(s)")

            if dr_count > 0:
                dr = state["dispatch_requests"][0]
                print(f"       Status: {dr.get('status')}")
                print(f"       Provider type: {dr.get('provider_type')}")

            if offer_count > 0:
                for o in state.get("offers", []):
                    prov = o.get("users", {})
                    print(f"       Offer sent to: {prov.get('full_name', '?')} "
                          f"({prov.get('email', '?')}) "
                          f"- {o.get('distance_km', '?')} km "
                          f"- status: {o.get('status')}")
        else:
            log("Debug endpoint", False, f"Status {r.status_code}")

    # ═══════════════════════════════════════════════════════════════
    # Step 9: CRITICAL — Phlebotomist checks pending offers
    # ═══════════════════════════════════════════════════════════════
    print()
    print("9. CRITICAL: Phlebotomist checks pending offers")

    r = requests.get(
        f"{BASE}/api/dispatch/offers/pending",
        headers={"Authorization": f"Bearer {phlebo_token}"}
    )
    if r.status_code == 200:
        offers = r.json().get("offers", [])
        if len(offers) > 0:
            log("PASS: Phlebotomist RECEIVED the dispatch offer!", True,
                f"{len(offers)} pending offer(s)")
            for o in offers:
                print(f"       Offer ID: {o.get('offer_id')}")
                print(f"       Distance: {o.get('distance_km')} km")
                print(f"       Patient address: {o.get('patient_address')}")
                print(f"       Priority: {o.get('priority')}")
        else:
            log("FAIL: No pending offers for phlebotomist", False,
                "THE BUG IS STILL PRESENT — dispatch engine did not match the phlebotomist")
    else:
        log("Pending offers endpoint", False, f"Status {r.status_code}")

    # ═══════════════════════════════════════════════════════════════
    # Summary
    # ═══════════════════════════════════════════════════════════════
    print()
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"  Passed: {passed}/{len(results)}")
    print(f"  Failed: {failed}/{len(results)}")
    print()
    for step, ok, _ in results:
        icon = "PASS" if ok else "FAIL"
        print(f"  [{icon}] {step}")

    if failed > 0:
        print("\nSee FAIL entries above for issues.")
        return 1
    else:
        print("\nALL TESTS PASSED - dispatch fix is working correctly!")
        return 0


if __name__ == "__main__":
    sys.exit(main())