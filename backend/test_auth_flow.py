import urllib.request
import urllib.error
import json
import uuid

def main():
    # 1. Sign up
    signup_url = 'http://localhost:8000/api/auth/signup'
    test_email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    test_password = "password123"

    signup_data = json.dumps({
        "full_name": "Test User",
        "email": test_email,
        "mobile": "1234567890",
        "password": test_password,
        "confirm_password": test_password,
        "role": "patient",
        "gender": "male",
        "date_of_birth": "1990-01-01",
        "address_info": {
            "address": "123 Main St",
            "city": "Vizag",
            "district": "Visakhapatnam",
            "state": "Andhra Pradesh",
            "pincode": "530001",
            "country": "India"
        }
    }).encode('utf-8')

    req1 = urllib.request.Request(signup_url, data=signup_data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req1) as res:
            print("Signup:", res.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Signup HTTPError: {e.code} - {e.read().decode()}")
    except Exception as e:
        print(f"Signup Error: {e}")

    # 2. Login
    login_url = 'http://localhost:8000/api/auth/login'
    login_data = json.dumps({
        "email": test_email,
        "password": test_password
    }).encode('utf-8')

    req2 = urllib.request.Request(login_url, data=login_data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req2) as res:
            print("Login:", res.read().decode())
    except urllib.error.HTTPError as e:
        print(f"Login HTTPError: {e.code} - {e.read().decode()}")
    except Exception as e:
        print(f"Login Error: {e}")

if __name__ == "__main__":
    main()
