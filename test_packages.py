import requests

API_URL = "http://127.0.0.1:8000"

print("Fetching public health packages...")
try:
    res = requests.get(f"{API_URL}/api/providers/search/packages")
    print("Status Code:", res.status_code)
    print("Response JSON:", res.json())
except Exception as e:
    print("Error:", e)
