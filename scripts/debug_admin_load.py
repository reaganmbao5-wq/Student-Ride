
import asyncio
import httpx
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

BASE_URL = "http://localhost:8000/api"
ADMIN_EMAIL = "superadmin@rides.com"
ADMIN_PASS = "admin123"

async def debug_admin_endpoints():
    async with httpx.AsyncClient() as client:
        print(f"--- Debugging Admin Endpoints at {BASE_URL} ---")
        
        # 1. Login
        print(f"Attempting login as {ADMIN_EMAIL}...")
        try:
            res = await client.post(f"{BASE_URL}/auth/login", json={
                "email": ADMIN_EMAIL, "password": ADMIN_PASS
            })
            if res.status_code != 200:
                print(f"Login Failed: {res.status_code} {res.text}")
                return
            token = res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            print("Login Successful")
        except Exception as e:
            print(f"Connection Failed: {e}")
            return

        # 2. Test GET /admin/users
        print("\nTesting GET /admin/users...")
        try:
            res = await client.get(f"{BASE_URL}/admin/users", headers=headers)
            print(f"Status: {res.status_code}")
            if res.status_code != 200:
                print(f"Failed: {res.text}")
            else:
                print(f"Success: {res.json()[:1]}") # Print first user only
        except Exception as e:
            print(f"GET Users Failed: {e}")

        # 3. Test GET /users/me
        print("\nTesting GET /users/me...")
        try:
            res = await client.get(f"{BASE_URL}/users/me", headers=headers)
            print(f"Status: {res.status_code}")
            if res.status_code == 200:
                print(f"User Data: {res.json()}")
            else:
                print(f"Failed: {res.text}")
        except Exception as e:
            print(f"GET Me Failed: {e}")

        # 4. Test GET /admin/drivers
        print("\nTesting GET /admin/drivers...")
        try:
            res = await client.get(f"{BASE_URL}/admin/drivers", headers=headers)
            print(f"Status: {res.status_code}")
            if res.status_code != 200:
                print(f"Failed: {res.text}")
            else:
                 print(f"Success: found {len(res.json())} drivers")
        except Exception as e:
            print(f"GET Drivers Failed: {e}")

        # 5. Test Debug Token
        print("\nTesting POST /admin/debug/token...")
        try:
            res = await client.post(f"{BASE_URL}/admin/debug/token", json={"token": token})
            print(f"Status: {res.status_code}")
            print(f"Response: {res.text}") 
        except Exception as e:
            print(f"Debug Token Failed: {e}")

if __name__ == "__main__":
    asyncio.run(debug_admin_endpoints())
