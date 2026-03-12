import requests
BASE_URL = "http://localhost:8000/api"
r = requests.post(f"{BASE_URL}/auth/login", json={"email": "reaganmbao5@gmail.com", "password": "reaganmbao31?"})
print(f"Status: {r.status_code}")
if r.status_code == 200:
    print(f"Role: {r.json()['user']['role']}")
    print("ADMIN LOGIN SUCCESS")
else:
    print(f"Error: {r.text}")
