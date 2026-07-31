"""
Full dispatch flow test: create booking -> dispatch -> offers -> accept.
Run: python test_dispatch_full.py
"""
import asyncio, uuid, sys
from datetime import datetime, timezone
sys.path.insert(0, '.')
from app.database import supabase
from app.services.dispatch_engine import UniversalDispatchEngine


async def test():
    print("=== Full Dispatch Flow Test ===")

    # Create a booking
    booking_id = str(uuid.uuid4())
    patients = supabase.table("users").select("id").eq("role", "patient").limit(1).execute()
    if not patients.data:
        print("ERROR: No patient found")
        return
    patient_id = patients.data[0]["id"]
    print(f"Patient: {patient_id}")

    now = datetime.now(timezone.utc).isoformat()
    supabase.table("bookings").insert({
        "id": booking_id, "patient_id": patient_id,
        "provider_id": patient_id, "provider_type": "organization",
        "service_type": "home_collection",
        "slot_id": f"test|2026-07-31|10:00",
        "slot_start": "2026-07-31T10:00:00",
        "slot_end": "2026-07-31T10:30:00",
        "status": "confirmed", "booking_kind": "home_collection",
        "created_at": now,
    }).execute()
    print(f"Booking: {booking_id}")

    # Create dispatch
    print("\n--- Creating Dispatch ---")
    result = await UniversalDispatchEngine.create_dispatch(
        patient_id=patient_id,
        patient_lat=17.6868, patient_lng=83.2185,
        patient_address="123 Main Road, Vizag",
        provider_type="phlebotomist",
        service_subtype="home_collection",
        booking_id=booking_id,
        notes="Test: CBC, Lipid Profile",
        priority="normal",
    )
    print(f"Dispatch: {result['dispatch_id']}")
    print(f"Status: {result['status']}")
    print(f"Candidates: {result['all_candidates']}")

    if result["all_candidates"] == 0:
        print("\nNO CANDIDATES FOUND. Checking phlebotomists...")
        phlebos = supabase.table("phlebotomists").select(
            "id,user_id,on_duty,current_lat,current_lng,verification_status"
        ).eq("on_duty", True).execute()
        for p in (phlebos.data or []):
            print(f"  user={p['user_id']} verified={p['verification_status']} lat={p.get('current_lat')} lng={p.get('current_lng')}")
        return

    # Check offers
    offers = supabase.table("dispatch_offers").select("*").eq(
        "dispatch_request_id", result["dispatch_id"]
    ).execute()
    print(f"\nOffers: {len(offers.data or [])}")
    for o in (offers.data or []):
        print(f"  Offer {o['id'][:8]}... provider={o['provider_id'][:8]}... status={o['status']}")

    if offers.data:
        print("\n--- Accepting Offer ---")
        accept = await UniversalDispatchEngine.respond_to_offer(
            offers.data[0]["id"], offers.data[0]["provider_id"], True
        )
        print(f"Accept: {accept}")

        if accept.get("success"):
            dr = supabase.table("dispatch_requests").select(
                "status,assigned_provider_id"
            ).eq("id", result["dispatch_id"]).execute()
            if dr.data:
                d = dr.data[0]
                print(f"\nDispatch: status={d['status']}, assigned={d['assigned_provider_id'][:8]}...")
                if d["assigned_provider_id"] == offers.data[0]["provider_id"]:
                    print("\n*** TEST PASSED: Full flow works! ***")
                else:
                    print("\n*** TEST FAILED: Wrong assignment ***")
    else:
        print("\n*** TEST FAILED: No offers created ***")

    print("\n=== Done ===")


if __name__ == "__main__":
    asyncio.run(test())