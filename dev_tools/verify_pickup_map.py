import asyncio
import sys
import os
import httpx
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR / 'backend'))
load_dotenv(ROOT_DIR / 'backend' / '.env')

API_URL = "http://localhost:8000/api"

# Fix for Windows Unicode output
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import time

async def create_driver_with_status(client, name_suffix, lat, lng, online=True, in_ride=False):
    timestamp = int(time.time())
    email = f"driver_{name_suffix}_{timestamp}@test.com"
    try:
        await client.post(f"{API_URL}/auth/register", json={
            "email": email, "password": "password123", "name": f"Driver {name_suffix}", "phone": "555-00", "role": "driver"
        })
    except:
        pass
    
    await asyncio.sleep(1) # Wait for DB
    resp = await client.post(f"{API_URL}/auth/login", json={"email": email, "password": "password123"})
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        return None, None
        
    token = resp.json().get("access_token")
    user_id = resp.json()["user"]["id"]
    
    # Update location (via API or simplified update for test)
    # We'll use the ws endpoint usually, but for speed, let's assume we can set it via DB or force it
    # Actually, we need to be online and have location.
    # Let's use the toggle-online which checks location.
    # Wait, we need to set location first. 
    # Let's manually set it in DB for the test to be fast and deterministic
    import motor.motor_asyncio
    mongo_url = os.environ['MONGO_URL']
    db = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)[os.environ['DB_NAME']]
    
    await db.drivers.update_one(
        {"user_id": user_id},
        {"$set": {
            "id": f"driver_{name_suffix}", # Ensure ID exists
            "user_id": user_id,
            "is_online": online,
            "is_approved": True,
            "wallet_status": "active",
            "current_ride_id": "ride_123" if in_ride else None,
            "current_location": {"lat": lat, "lng": lng, "heading": 0.0},
            "location": {"type": "Point", "coordinates": [lng, lat]}
        }},
        upsert=True
    )
    
    return token, user_id

async def verify_pickup_map():
    print("Verifying GET /drivers/nearby...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Create Student
        email_s = "student_map@test.com"
        try:
            await client.post(f"{API_URL}/auth/register", json={
                "email": email_s, "password": "password123", "name": "Map Student", "phone": "555", "role": "student"
            })
        except:
            pass
        resp_s = await client.post(f"{API_URL}/auth/login", json={"email": email_s, "password": "password123"})
        token_s = resp_s.json()["access_token"]
        
        # 1. Driver A: Perfect Candidate (Online, Free, Nearby)
        await create_driver_with_status(client, "Perfect", -29.001, 30.001, online=True, in_ride=False)
        
        # 2. Driver B: Offline (Should be hidden)
        await create_driver_with_status(client, "Offline", -29.002, 30.002, online=False, in_ride=False)
        
        # 3. Driver C: Busy (In Ride) (Should be hidden)
        await create_driver_with_status(client, "Busy", -29.003, 30.003, online=True, in_ride=True)
        
        # 4. Driver D: Far Away (Should be hidden/filtered by radius)
        # 20km away
        await create_driver_with_status(client, "Far", -29.200, 30.200, online=True, in_ride=False)

        # Call Endpoint
        print("Fetching nearby drivers (Radius 5km, Center -29.0, 30.0)...")
        resp = await client.get(f"{API_URL}/drivers/nearby", params={"latitude": -29.0, "longitude": 30.0, "radius_km": 5.0}, headers={"Authorization": f"Bearer {token_s}"})
        
        if resp.status_code != 200:
            print(f"❌ Failed to fetch: {resp.text}")
            return
            
        drivers = resp.json()
        print(f"✅ Found {len(drivers)} drivers")
        
        found_perfect = False
        found_offline = False
        found_busy = False
        found_far = False
        
        for d in drivers:
            # We don't have names in response, so identification by ID or logic
            # Let's count
            pass
            
        # Refined check: We executed create_driver, but IDs are dynamic.
        # We expect EXACTLY 1 driver (Driver A "Perfect").
        # Driver A is at -29.001, 30.001 which is very close.
        
        if len(drivers) == 1:
            print("✅ Correct count: 1")
            d = drivers[0]
            if abs(d['latitude'] - (-29.001)) < 0.0001:
                print("✅ Correct driver found (Driver A)")
            else:
                print(f"❌ Unexpected driver found at {d['latitude']}")
        else:
            print(f"❌ Incorrect count. Expected 1, got {len(drivers)}")
            for d in drivers:
                print(f" - Driver at {d['latitude']}, {d['longitude']}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_pickup_map())
