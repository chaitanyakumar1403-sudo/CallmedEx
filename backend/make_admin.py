import os
import sys
import urllib.request
import urllib.parse
import json
from dotenv import load_dotenv

def make_admin(email):
    load_dotenv()
    
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: Supabase credentials not found in .env file.")
        return

    # Update users table
    url = f"{supabase_url}/rest/v1/users?email=eq.{urllib.parse.quote(email)}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    data = json.dumps({"role": "admin"}).encode('utf-8')
    
    req = urllib.request.Request(url, data=data, headers=headers, method='PATCH')
    
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            if result:
                print(f"Successfully updated user {email} to admin!")
                print("Note: You may need to log out and log back in for the changes to take effect.")
            else:
                print(f"No user found with email: {email}")
    except Exception as e:
        print(f"Failed to update user: {e}")

if __name__ == "__main__":
    email = input("Enter the email address of the account you want to make admin: ").strip()
    if email:
        make_admin(email)
    else:
        print("Email cannot be empty.")
