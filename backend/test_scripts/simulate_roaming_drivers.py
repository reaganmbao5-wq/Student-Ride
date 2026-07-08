import asyncio
import motor.motor_asyncio
import uuid
import random
import time
import httpx
import math
from dotenv import load_dotenv
import os

load_dotenv()

BASE_LAT = -14.42
BASE_LNG = 28.45
NUM_DRIVERS = 10
MONGO_URL = os.getenv("MONGO_URL")

async def setup_dummy_drivers(db):
    drivers = []
    for i in range(1, NUM_DRIVERS + 1):
        uid = f"ghost-driver-{i}"
        
        # Ensure user exists
        await db.users.update_one(
            {"id": uid},
            {"$set": {
                "id": uid,
                "name": f"Ghost Driver {i}",
                "email": f"ghost{i}@example.com",
                "role": "driver",
                "is_active": True
            }},
            upsert=True
        )
        
        # Ensure driver exists (Spawn within ~300m of Kabwe center for better visibility)
        lat = BASE_LAT + (random.uniform(-0.003, 0.003))
        lng = BASE_LNG + (random.uniform(-0.003, 0.003))
        await db.drivers.update_one(
            {"user_id": uid},
            {"$set": {
                "id": uid,
                "user_id": uid,
                "is_online": True,
                "is_approved": True,
                "wallet_status": "active",
                "current_ride_id": None,
                "current_location": {"lat": lat, "lng": lng, "heading": random.uniform(0, 360)},
                "location": {
                    "type": "Point",
                    "coordinates": [lng, lat]
                }
            }},
            upsert=True
        )
        
        drivers.append({
            "id": uid,
            "lat": lat,
            "lng": lng,
            "heading": random.uniform(0, 360)
        })
    return drivers

async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[os.environ.get('DB_NAME', 'mulungushi_rides')]
    
    print("Setting up ghost drivers in database...")
    drivers = await setup_dummy_drivers(db)
    print("Ghost drivers created. Starting random walk...")
    
    async with httpx.AsyncClient() as http_client:
        while True:
            payload = {}
            for d in drivers:
                # Random walk: move ~10 meters per 2 seconds (18 km/h) for realistic movement
                d["lat"] += random.uniform(-0.0001, 0.0001)
                d["lng"] += random.uniform(-0.0001, 0.0001)
                d["heading"] = (d["heading"] + random.uniform(-20, 20)) % 360
                
                payload[d["id"]] = {
                    "lat": d["lat"],
                    "lng": d["lng"],
                    "heading": d["heading"]
                }
                
                # Update DB every so often to keep is_online=True alive
                # (The memory cache drops them if they aren't pinged, but we ping the memory cache.
                # However, it might still need DB to be is_online=True)
            
            try:
                resp = await http_client.post("http://localhost:8000/api/test/inject_drivers", json={"drivers": payload})
                if resp.status_code != 200:
                    print("Failed to inject:", resp.text)
            except Exception as e:
                print("Error injecting:", e)
                
            await asyncio.sleep(2)

if __name__ == "__main__":
    asyncio.run(main())
