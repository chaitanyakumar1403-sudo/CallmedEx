import os
import sys
import urllib.request
import urllib.parse
import json
from dotenv import load_dotenv

def verify_provider(email, role):
    load_dotenv()
    
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: Supabase credentials not found in .env file.")
        return

    # First, get the user ID from the email
    users_url = f"{supabase_url}/rest/v1/users?email=eq.{urllib.parse.quote(email)}&select=id"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }
    
    try:
        req = urllib.request.Request(users_url, headers=headers)
        with urllib.request.urlopen(req) as response:
            users = json.loads(response.read().decode('utf-8'))
            
            if not users:
                print(f"No user found with email: {email}")
                return
                
            user_id = users[0]["id"]
            
            # Now update the verification_status in the specific role table
            role_tables = {
                "doctor": "doctors",
                "pharmacy": "pharmacies",
                "phlebotomist": "phlebotomists",
                "organization": "organizations",
                "nurse": "nurses"
            }
            
            if role not in role_tables:
                print(f"Invalid role. Choose from: {', '.join(role_tables.keys())}")
                return
                
            table_name = role_tables[role]
            update_url = f"{supabase_url}/rest/v1/{table_name}?user_id=eq.{user_id}"
            
            update_headers = headers.copy()
            update_headers["Prefer"] = "return=representation"
            
            data = json.dumps({"verification_status": "verified"}).encode('utf-8')
            update_req = urllib.request.Request(update_url, data=data, headers=update_headers, method='PATCH')
            
            with urllib.request.urlopen(update_req) as update_response:
                result = json.loads(update_response.read().decode('utf-8'))
                if result:
                    print(f"Successfully verified {email} as a {role}!")
                    print("Note: The user may need to refresh the dashboard or log back in.")
                else:
                    print(f"Profile for {email} not found in the '{table_name}' table. Have they completed their profile signup?")
                    
    except Exception as e:
        print(f"Failed to verify provider: {e}")

if __name__ == "__main__":
    print("=== Provider Verification Bypass ===")
    email = input("Enter the email address of the provider: ").strip()
    role = input("Enter the role (doctor, pharmacy, phlebotomist, organization, nurse): ").strip().lower()
    
    if email and role:
        verify_provider(email, role)
    else:
        print("Email and role cannot be empty.")
