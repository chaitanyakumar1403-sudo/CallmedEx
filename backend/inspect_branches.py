import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app.database import get_supabase_client
supabase = get_supabase_client()

all_branches = supabase.table('provider_branches').select('*').execute().data or []
print(f"Total branches in provider_branches: {len(all_branches)}")
for b in all_branches:
    print(b)
