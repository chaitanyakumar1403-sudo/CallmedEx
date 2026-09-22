import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app.database import get_supabase_client
supabase = get_supabase_client()

real_uid = '4c27cf20-e922-4412-a6e9-a3613607ce21'
u = supabase.table('users').select('*').eq('id', real_uid).execute().data
print('Real user:', u)

o = supabase.table('organizations').select('*').eq('user_id', real_uid).execute().data
print('Real org:', o)
