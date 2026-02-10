
import asyncio
import sys
import os
from pathlib import Path
import httpx
from datetime import datetime
import uuid

# Load env from backend/.env
from dotenv import load_dotenv
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

async def verify_admin_pricing():
    print("\n--- Verifying Admin Pricing API ---")
    
    email = f"admin_test_{uuid.uuid4().hex[:6]}@example.com"
    password = "password123"
    
    async with httpx.AsyncClient(timeout=30.0) as http:
        # 1. Register/Login as Admin (Need to verify permission)
        # Assuming we can register as admin or use existing.
        # Let's try to register a new admin first (if open) or use super admin account if we knew it.
        # But server doesn't allow public admin reg.
        # So we must use a known admin or hack one.
        # Since this is a dev script, I can insert one directly into DB, or use the one from previous sessions.
        # I'll modify the DB directly using motor to ensure I have an admin.
        
        from motor.motor_asyncio import AsyncIOMotorClient
        MONGO_URL = os.environ.get("MONGO_URL")
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[os.environ.get("DB_NAME", "mulungushi_rides")]
        
        # 1. Register/Login as Admin (Need to verify permission)
        # Register as a normal user first, then promote via DB
        
        # Ensure user doesn't exist
        await db.users.delete_one({"email": email})
        
        # Register as student
        await http.post("http://localhost:8000/api/auth/register", json={
            "email": email, "password": password, "name": "Test Admin Candidate", "phone": "0970000000", "role": "student"
        })
        
        # Promote to Admin via DB
        await db.users.update_one({"email": email}, {"$set": {"role": "admin"}})
        print("✅ Promoted test user to Admin")
        
        # Login
        login_res = await http.post("http://localhost:8000/api/auth/login", json={"email": email, "password": password})
        if login_res.status_code != 200:
            print(f"❌ Login Failed: {login_res.text}")
            return
            
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Test GET Settings
        res = await http.get("http://localhost:8000/api/admin/pricing-settings", headers=headers)
        if res.status_code == 200:
            print(f"✅ GET Settings: {res.json()}")
        else:
            print(f"❌ GET Settings Failed: {res.status_code} {res.text}")
            
        # 3. Test UPDATE Settings
        new_settings = {
            "base_fare": 25.0,
            "per_km_rate": 6.0,
            "per_minute_rate": 3.0,
            "surge_multiplier": 1.5,
            "minimum_fare": 30.0
        }
        res = await http.put("http://localhost:8000/api/admin/pricing-settings", json=new_settings, headers=headers)
        if res.status_code == 200:
            print("✅ UPDATE Settings Success")
            # Verify update
            check = await http.get("http://localhost:8000/api/admin/pricing-settings", headers=headers)
            if check.json()["base_fare"] == 25.0:
                print("✅ Update Verified Persisted")
            else:
                print("❌ Update NOT Persisted")
        else:
            print(f"❌ UPDATE Settings Failed: {res.status_code} {res.text}")
            
        # 4. Test CREATE Fixed Route
        route_data = {
            "pickup_name": "Test Pickup",
            "dropoff_name": "Test Dropoff",
            "pickup_coordinates": {"type": "Point", "coordinates": [28.0, -14.0]},
            "dropoff_coordinates": {"type": "Point", "coordinates": [28.1, -14.1]},
            "tolerance_radius_meters": 100,
            "fixed_price": 50.0
        }
        res = await http.post("http://localhost:8000/api/admin/fixed-routes", json=route_data, headers=headers)
        if res.status_code == 200:
            route_id = res.json()["id"]
            print(f"✅ CREATE Fixed Route Success (ID: {route_id})")
        else:
            print(f"❌ CREATE Fixed Route Failed: {res.status_code} {res.text}")
            return

        # 5. Test GET Routes
        res = await http.get("http://localhost:8000/api/admin/fixed-routes", headers=headers)
        if res.status_code == 200:
            routes = res.json()
            if any(r["id"] == route_id for r in routes):
                 print("✅ GET Fixed Routes Verified")
            else:
                 print("❌ Created Route NOT found in List")
        else:
            print(f"❌ GET Fixed Routes Failed: {res.status_code}")
            
        # 6. Test TOGGLE Route
        res = await http.patch(f"http://localhost:8000/api/admin/fixed-routes/{route_id}/toggle", headers=headers)
        if res.status_code == 200:
            print(f"✅ TOGGLE Route Success (Active: {res.json()['is_active']})")
        else:
            print(f"❌ TOGGLE Route Failed: {res.status_code}")

        # 7. Test DELETE Route
        res = await http.delete(f"http://localhost:8000/api/admin/fixed-routes/{route_id}", headers=headers)
        if res.status_code == 200:
            print("✅ DELETE Route Success")
        else:
            print(f"❌ DELETE Route Failed: {res.status_code}")
            
        # Cleanup Admin
        await db.users.delete_one({"email": email})

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_admin_pricing())
