import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import httpx
import uuid
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR / 'backend'))
load_dotenv(ROOT_DIR / 'backend' / '.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')
API_URL = "http://localhost:8000/api"

async def verify_geospatial():
    print("Verifying MongoDB Geospatial Index & Query...")
    
    mongo = AsyncIOMotorClient(MONGO_URL)
    db = mongo[DB_NAME]
    
    # 1. Create Driver
    driver_email = f"driver_geo_{uuid.uuid4().hex[:6]}@test.com"
    driver_id = None
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Register User
        resp = await client.post(f"{API_URL}/auth/register", json={
            "email": driver_email,
            "password": "password123",
            "name": "Geo Driver",
            "phone": "+260999888777",
            "role": "driver"
        })
        if resp.status_code != 200:
            print(f"Register User failed: {resp.text}")
            return
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Register Driver Profile
        resp = await client.post(f"{API_URL}/drivers/register", headers=headers, json={
            "vehicle_type": "car",
            "plate_number": "GEO-123",
            "vehicle_model": "Toyota",
            "vehicle_color": "Green"
        })
        if resp.status_code != 200:
            print(f"Register Driver failed: {resp.text}")
            return
            
        driver_profile = resp.json()
        driver_id = driver_profile["user_id"] # user_id is used for location updates
        
        # Approve & Go Online (Direct DB update to save time)
        await db.drivers.update_one(
            {"user_id": driver_id}, 
            {"$set": {"is_approved": True, "is_online": True, "wallet_balance": 100}}
        )
        
        # 2. Update Location (Mulungushi Logic)
        # Location: Mulungushi Gate (-14.4450, 28.4480)
        location_data = {
            "latitude": -14.4450, 
            "longitude": 28.4480
        }
        resp = await client.post(f"{API_URL}/drivers/location", headers=headers, json=location_data)
        if resp.status_code != 200:
            print(f"Location Update failed: {resp.text}")
            return
        else:
            print("Location Updated via API")

        # 3. Verify GeoJSON in DB
        driver_doc = await db.drivers.find_one({"user_id": driver_id})
        geo = driver_doc.get("location")
        print(f"Stored GeoJSON: {geo}")
        
        if geo and geo["type"] == "Point" and geo["coordinates"] == [28.4480, -14.4450]:
            print("✅ GeoJSON format correct")
        else:
            print("❌ GeoJSON format incorrect")
            return

        # 4. Verify $near Query works
        # Point close to driver: 100 meters away
        query_point = [28.4480, -14.4450] 
        
        drivers_near = await db.drivers.find({
            "location": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": query_point
                    },
                    "$maxDistance": 1000 # 1km
                }
            }
        }).to_list(10)
        
        found = any(d["user_id"] == driver_id for d in drivers_near)
        if found:
            print("✅ $near Query successful: Found driver via geospatial index")
        else:
            print("❌ $near Query failed: Driver not found in search")
            
        # Cleanup
        await db.users.delete_one({"email": driver_email})
        await db.drivers.delete_one({"user_id": driver_id})

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_geospatial())
