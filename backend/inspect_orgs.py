import os, sys
# Ensure backend directory is in path and dotenv loaded
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app.database import get_supabase_client
supabase = get_supabase_client()
print("Supabase client initialized:", supabase is not None)

# Check provider_settings
ps = supabase.table('provider_settings').select('*').in_('provider_user_id', ['36063ba5-34c0-41fb-ba56-af837d999e58', '4c27cf20-e922-4412-a6e9-a3613607ce21']).execute().data
print('Provider settings:', ps)

# Check branches
pb = supabase.table('provider_branches').select('*').in_('provider_user_id', ['36063ba5-34c0-41fb-ba56-af837d999e58', '4c27cf20-e922-4412-a6e9-a3613607ce21']).execute().data
print('Branches:', pb)

# Check organizations table
orgs = supabase.table('organizations').select('*').in_('user_id', ['36063ba5-34c0-41fb-ba56-af837d999e58', '4c27cf20-e922-4412-a6e9-a3613607ce21']).execute().data
print('Orgs table:')
for o in orgs:
    print(f"  org_id: {o.get('id')}, user_id: {o.get('user_id')}, name: {o.get('organization_name')}, head: {o.get('head_of_institution')}")

# Check organization_doctors
ods = supabase.table('organization_doctors').select('*').in_('organization_id', [o['id'] for o in orgs]).execute().data
print('Organization doctors:', ods)

# Check doctor availability for doctor_user_id in ods
doc_ids = [od['doctor_user_id'] for od in ods]
if doc_ids:
    dav = supabase.table('doctor_availability').select('*').in_('doctor_id', doc_ids).execute().data
    print(f'Doctor availability records count: {len(dav)}')
    for av in dav:
        print(f"  doc: {av.get('doctor_id')}, day: {av.get('day_of_week')}, time: {av.get('start_time')}-{av.get('end_time')}, branch: {av.get('template_group_id')}, loc: {av.get('location_name')}")
