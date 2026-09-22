import os, sys, asyncio
from datetime import datetime, timedelta
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app.routers.provider_management import get_available_slots

async def test_slots():
    # Find next weekday (tomorrow or day after)
    d = datetime.now() + timedelta(days=1)
    if d.weekday() == 6: # Sunday
        d = d + timedelta(days=1)
    target_date = d.strftime("%Y-%m-%d")
    doc_id = "e713e870-4f61-411d-bfe1-1387f0f59c61"
    branch_id = "98826877-f85e-4645-927b-c1c914c7e76c"

    print(f"Testing slots for Dr. Naidu on {target_date} (weekday={d.weekday()})...")
    
    # Main Facility
    main_res = await get_available_slots(provider_id=doc_id, target_date=target_date, mode="in_person", branch_id="main")
    main_slots = main_res.get("slots", [])
    print(f"Main Facility slots count: {len(main_slots)}")
    if main_slots:
        print("  Sample main slot:", main_slots[0])

    # MVP Colony Branch
    mvp_res = await get_available_slots(provider_id=doc_id, target_date=target_date, mode="in_person", branch_id=branch_id)
    mvp_slots = mvp_res.get("slots", [])
    print(f"MVP Colony Outpatient slots count: {len(mvp_slots)}")
    if mvp_slots:
        print("  Sample MVP slot:", mvp_slots[0])

asyncio.run(test_slots())
