import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))

from supabase import create_client
import uuid
import datetime

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Missing Supabase credentials")
    exit(1)

supabase = create_client(url, key)

from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed_pw = pwd_context.hash("Admin@123")

# Delete old if exists
try:
    supabase.table("users").delete().eq("email", "superadmin@test.com").execute()
    supabase.table("users").delete().eq("email", "supervisor@test.com").execute()
except Exception:
    pass

# Super Admin
super_admin = {
    "id": str(uuid.uuid4()),
    "full_name": "God Mode Admin",
    "email": "superadmin@test.com",
    "mobile": "9999999999",
    "password_hash": hashed_pw,
    "role": "admin",
    "managed_city": None,
    "is_active": True,
    "created_at": datetime.datetime.utcnow().isoformat()
}

# Supervisor
supervisor = {
    "id": str(uuid.uuid4()),
    "full_name": "Hyderabad Manager",
    "email": "supervisor@test.com",
    "mobile": "8888888888",
    "password_hash": hashed_pw,
    "role": "admin",
    "managed_city": "Hyderabad",
    "city": "Hyderabad",
    "is_active": True,
    "created_at": datetime.datetime.utcnow().isoformat()
}

res1 = supabase.table("users").insert(super_admin).execute()
res2 = supabase.table("users").insert(supervisor).execute()

print(f"Created Super Admin: {res1.data[0]['email']}")
print(f"Created Supervisor: {res2.data[0]['email']}")
