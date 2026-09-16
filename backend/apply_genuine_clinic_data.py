import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app.database import get_supabase_client
supabase = get_supabase_client()

REAL_UID = '4c27cf20-e922-4412-a6e9-a3613607ce21'
REAL_ORG_ID = 'c2d8b199-77c4-4f7a-9307-59aedf0f4998'
FAKE_UID = '36063ba5-34c0-41fb-ba56-af837d999e58'
FAKE_ORG_ID = '18571ac4-53ba-4d0f-ae4e-57bc8e476c80'
DOC_UID = 'e713e870-4f61-411d-bfe1-1387f0f59c61'

print("--- STEP 1: Update provider_settings ---")
# 1. Unlist fake clinic
supabase.table('provider_settings').upsert({
    'provider_user_id': FAKE_UID,
    'is_listed': False
}).execute()
print(f"Unlisted fake clinic {FAKE_UID}")

# 2. Ensure real clinic is listed
supabase.table('provider_settings').upsert({
    'provider_user_id': REAL_UID,
    'is_listed': True,
    'accepts_online_payment': True,
    'home_service_enabled': False
}).execute()
print(f"Listed genuine clinic {REAL_UID}")

print("--- STEP 2: Configure provider_branches for genuine clinic ---")
# Delete any branch for fake clinic
supabase.table('provider_branches').delete().eq('provider_user_id', FAKE_UID).execute()

# Check existing branches for real clinic
real_branches = supabase.table('provider_branches').select('*').eq('provider_user_id', REAL_UID).execute().data or []
if not real_branches:
    branch_res = supabase.table('provider_branches').insert({
        'provider_user_id': REAL_UID,
        'name': 'MVP Colony Outpatient Clinic',
        'address': 'Sector 4, Beach Road, MVP Colony',
        'city': 'Visakhapatnam',
        'phone': '+91 891 2789100',
        'is_active': True
    }).execute().data
    branch_id = branch_res[0]['id']
    print(f"Created new branch for genuine clinic: {branch_id}")
else:
    branch_id = real_branches[0]['id']
    print(f"Existing branch found for genuine clinic: {branch_id}")

print("--- STEP 3: Configure doctor_availability for Dr. Naidu ---")
# Clear out any stale availability and recreate the clean, genuine 2-branch schedule
supabase.table('doctor_availability').delete().eq('doctor_id', DOC_UID).execute()

new_avails = []
# Monday (1) to Saturday (6):
# Morning: 09:30 - 12:00 at Main Facility (Madhurawada)
# Evening: 17:00 - 20:00 at MVP Colony Outpatient Clinic
for day in range(1, 7):
    # Morning shift at Main Facility
    new_avails.append({
        'doctor_id': DOC_UID,
        'day_of_week': day,
        'start_time': '09:30:00',
        'end_time': '12:00:00',
        'slot_duration_minutes': 10,
        'consultation_mode': 'in_person',
        'max_patients_per_slot': 1,
        'is_active': True,
        'organization_id': REAL_ORG_ID,
        'location_name': 'VISAKHA MULTISPECIALITY CLINICS (Main Facility)',
        'location_address': '# 6-107/1B Beside MAX Fashions Krishna Nagar Chandrampalem Madhurawada Visakhapatnam, Andhra Pradesh - 530041',
        'template_group_id': None
    })
    # Evening shift at MVP Colony Branch
    new_avails.append({
        'doctor_id': DOC_UID,
        'day_of_week': day,
        'start_time': '17:00:00',
        'end_time': '20:00:00',
        'slot_duration_minutes': 10,
        'consultation_mode': 'in_person',
        'max_patients_per_slot': 1,
        'is_active': True,
        'organization_id': REAL_ORG_ID,
        'location_name': 'MVP Colony Outpatient Clinic',
        'location_address': 'Sector 4, Beach Road, MVP Colony',
        'template_group_id': branch_id
    })

ins_res = supabase.table('doctor_availability').insert(new_avails).execute().data
print(f"Inserted {len(ins_res)} availability slots for Dr. Naidu across Main Facility & MVP Colony branch")

# Also ensure organization_doctors link for fake org is removed
supabase.table('organization_doctors').delete().eq('organization_id', FAKE_ORG_ID).execute()
print("Removed doctor associations from fake organization")
