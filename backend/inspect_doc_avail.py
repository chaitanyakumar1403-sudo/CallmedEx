import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app.database import get_supabase_client
supabase = get_supabase_client()

doc_id = 'e713e870-4f61-411d-bfe1-1387f0f59c61'
dav = supabase.table('doctor_availability').select('*').eq('doctor_id', doc_id).execute().data or []
print(f"Total availability for Dr Naidu: {len(dav)}")
for d in dav:
    print(d)
