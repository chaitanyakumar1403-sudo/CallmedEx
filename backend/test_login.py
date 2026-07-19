import urllib.request
import urllib.error
import json

url = 'http://localhost:8000/api/auth/login'
data = json.dumps({"email": "test@example.com", "password": "wrong"}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as res:
        print(res.read().decode())
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code} - {e.read().decode()}")
except urllib.error.URLError as e:
    print(f"URLError: {e.reason}")
