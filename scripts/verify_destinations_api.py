import httpx
import asyncio
import sys

API_URL = "http://localhost:8000/api"

async def verify_destinations():
    async with httpx.AsyncClient() as client:
        # 1. Login as Super Admin
        print("Logging in as Super Admin...")
        resp = await client.post(f"{API_URL}/auth/login", json={
            "email": "Reaganmbao5@gmail.com", 
            "password": "superadmin123"
        })
        if resp.status_code != 200:
            print(f"❌ Admin Login Failed: {resp.text}")
            return
        
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Admin Logged In")

        # 2. Create Destination
        dest_name = "Script Verified Gate"
        print(f"Creating destination '{dest_name}'...")
        resp = await client.post(
            f"{API_URL}/admin/destinations",
            headers=headers,
            json={
                "name": dest_name,
                "latitude": -14.123,
                "longitude": 28.321
            }
        )
        if resp.status_code == 200:
            print("✅ Destination Created")
            dest_id = resp.json()["id"]
        elif resp.status_code == 400 and "already exists" in resp.text:
             print("⚠️ Destination already exists (Skipping creation)")
        else:
            print(f"❌ Create Failed: {resp.text}")
            return

        # 3. Fetch as Public User
        print("Fetching destinations (Public)...")
        resp = await client.get(f"{API_URL}/destinations")
        data = resp.json()
        
        found = False
        for d in data:
            if d["name"] == dest_name:
                found = True
                print(f"✅ Found '{dest_name}' in public list")
                # Verify no price in ANY data (API shouldn't return it anyway, but good to check)
                if "estimated_fare" in d:
                    print("❌ Error: API returning 'estimated_fare'")
                else:
                    print("✅ API schema correct (no stored price)")
                break
        
        if not found:
            print(f"❌ '{dest_name}' not found in public list")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_destinations())
