import requests

API_URL = "http://127.0.0.1:8000"
try:
    res = requests.get(f"{API_URL}/openapi.json")
    data = res.json()
    paths = data.get("paths", {})
    for path in paths.keys():
        if "packages" in path.lower() or "search" in path.lower():
            print("Found route:", path)
except Exception as e:
    print("Error:", e)
