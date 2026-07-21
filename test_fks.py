import os
import traceback
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('backend/.env')
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))

queries = [
    ("doctors", "*, users!inner(full_name, email, city)"),
    ("nurses", "*, users!inner(full_name, email, city)"),
    ("provider_locations", "*, users!inner(full_name, role)"),
    ("dispatch_offers", "*, dispatch_requests!inner(patient_address, service_subtype, provider_type, patient_lat, patient_lng)"),
    ("organization_doctors", "*, users!doctor_user_id(id, full_name, email, mobile)"),
    ("organizations", "*, users!inner(id, full_name, city, district, state, address)")
]

print("Testing Foreign Key joins...")
for table, select_str in queries:
    try:
        res = supabase.table(table).select(select_str).limit(1).execute()
        print(f"[OK] {table} -> {select_str}")
    except Exception as e:
        print(f"[ERROR] {table} -> {select_str}")
        print(f"   => {e}")
