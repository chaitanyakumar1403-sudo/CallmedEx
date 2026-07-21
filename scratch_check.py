import os
import sys
from dotenv import load_dotenv

load_dotenv("backend/.env")

from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("Missing supabase credentials in env")
    sys.exit(1)
    
supabase = create_client(url, key)

res = supabase.table("bookings").select("*").eq("id", "515170d9-79d0-4ce8-96a5-29f9e4af2ef7").execute()
print("Bookings result:", res.data)

res2 = supabase.table("dispatch_requests").select("*").eq("booking_id", "515170d9-79d0-4ce8-96a5-29f9e4af2ef7").execute()
print("Dispatch result:", res2.data)
