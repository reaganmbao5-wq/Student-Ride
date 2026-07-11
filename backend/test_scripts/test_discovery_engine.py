import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
import time
import math

# Configuration
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "student_ride_db"
API_URL = "http://localhost:8000/test/inject_drivers"
CENTER_LAT = -14.4087
CENTER_LNG = 28.2849

async def main():
    print("========================================")
    print("🚗 DRIVER DISCOVERY ENGINE TEST SCRIPT 🚗")
    print("========================================")
    
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    # 1. Ensure we have 5 dummy drivers
    print("\n1. Seeding database with 5 online dummy drivers...")
    dummy_driver_ids = []
    
    for i in range(1, 6):
        user_id = f"test-discovery-user-{i}"
        driver_id = f"test-discovery-driver-{i}"
        dummy_driver_ids.append(driver_id)
        
        # Upsert User
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "name": f"Discovery Driver {i}",
                "email": f"discovery{i}@test.com",
                "phone": f"099999990{i}",
                "role": "driver",
                "status": "active"
            }},
            upsert=True
        )
        
        # Upsert Driver
        await db.drivers.update_one(
            {"id": driver_id},
            {"$set": {
                "user_id": user_id,
                "status": "approved",
                "is_online": True,
                "current_ride_id": None,
                "wallet_balance": 100.0,
                "vehicle_model": "Toyota Yaris",
                "vehicle_color": "Silver",
                "plate_number": f"DISC-0{i}"
            }},
            upsert=True
        )
        
    print("   ✅ DB Seeded.")
    
    # 2. Inject their locations into memory cache so `/drivers/nearby` returns them
    print("\n2. Injecting locations into memory cache...")
    drivers_payload = {}
    
    # Scatter them in a tiny circle around the center
    for i, driver_id in enumerate(dummy_driver_ids):
        angle = (i / 5.0) * math.pi * 2
        radius = 0.005 # about 500 meters
        lat = CENTER_LAT + radius * math.cos(angle)
        lng = CENTER_LNG + radius * math.sin(angle)
        
        drivers_payload[driver_id] = {
            "lat": lat,
            "lng": lng,
            "heading": angle * (180 / math.pi)
        }
        
    async with httpx.AsyncClient() as http:
        try:
            r = await http.post(API_URL, json={"drivers": drivers_payload})
            if r.status_code == 200:
                print("   ✅ Locations injected! Drivers should smoothly SPAWN on your screen now.")
            else:
                print(f"   ⚠️ Warning: Inject returned {r.status_code}")
        except Exception as e:
            print(f"   ❌ Failed to hit inject endpoint. Is backend running? {e}")
            return
            
    print("\n⏳ Waiting 10 seconds for you to observe the smooth SPAWN on the Student Dashboard...")
    for i in range(10, 0, -1):
        print(f"   {i}...")
        await asyncio.sleep(1)
        
    # 3. Simulate one driver becoming "BUSY" (accepting a ride)
    print("\n3. Simulating Driver 1 becoming BUSY (Accepting a Ride)...")
    await db.drivers.update_one(
        {"id": dummy_driver_ids[0]},
        {"$set": {"current_ride_id": "dummy-ride-xyz"}}
    )
    print("   ✅ Driver 1 is now BUSY. They should gracefully shrink and DESPAWN.")
    
    print("\n⏳ Waiting 5 seconds...")
    await asyncio.sleep(5)
    
    # 4. Simulate one driver going "OFFLINE"
    print("\n4. Simulating Driver 2 going OFFLINE...")
    await db.drivers.update_one(
        {"id": dummy_driver_ids[1]},
        {"$set": {"is_online": False}}
    )
    print("   ✅ Driver 2 is now OFFLINE. They should gracefully shrink and DESPAWNING.")
    
    print("\n⏳ Waiting 5 seconds...")
    await asyncio.sleep(5)
    
    # 5. Clean up
    print("\n5. Cleaning up (Resetting all test drivers)...")
    await db.drivers.update_many(
        {"id": {"$in": dummy_driver_ids}},
        {"$set": {"is_online": False, "current_ride_id": None}}
    )
    print("   ✅ Cleanup complete! Remaining test drivers will fade out.")
    
    print("\n🎉 Test Script Finished!")

if __name__ == "__main__":
    asyncio.run(main())
