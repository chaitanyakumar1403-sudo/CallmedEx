import os
from dotenv import load_dotenv
import urllib.request
import json

load_dotenv()
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

url = f"{supabase_url}/rest/v1/users?select=email,password_hash,role"
headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}"
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as res:
        users = json.loads(res.read().decode())
        for u in users:
            print(f"Email: {u['email']}, Role: {u['role']}, Hash starts with: {u['password_hash'][:10] if u['password_hash'] else 'None'}")
except Exception as e:
    print(e)
