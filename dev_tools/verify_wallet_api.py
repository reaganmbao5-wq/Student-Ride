import requests
import json

BASE_URL = "http://localhost:8000/api"

# Login as a driver (using one from seed data)
email = "driver@test.com"
password = "driver123"

def verify_wallet():
    # 1. Login
    print(f"Logging in as {email}...")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
        if resp.status_code != 200:
            print(f"Login failed: {resp.text}")
            return
        
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Get Profile
        print("Fetching driver profile...")
        resp = requests.get(f"{BASE_URL}/drivers/me", headers=headers)
        if resp.status_code != 200:
            print(f"Get profile failed: {resp.text}")
            return

        data = resp.json()
        print("Driver Profile Data:")
        print(json.dumps(data, indent=2))
        
        # 3. Check Wallet Fields
        required_fields = ["wallet_balance", "wallet_status", "minimum_required_balance"]
        missing = [f for f in required_fields if f not in data]
        
        if missing:
            print(f"FAILED: Missing fields: {missing}")
        else:
            print("SUCCESS: All wallet fields present.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_wallet()
