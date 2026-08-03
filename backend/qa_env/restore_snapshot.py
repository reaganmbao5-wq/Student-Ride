import asyncio
import os
import json
from motor.motor_asyncio import AsyncIOMotorClient
from bson import json_util
from dotenv import load_dotenv

async def main():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client[os.environ.get('DB_NAME', 'mulungushi_rides')]

    with open('backend/qa_env/db_snapshot.json', 'r') as f:
        snapshot = json_util.loads(f.read())

    # Get driver user by email
    driver_user = await db.users.find_one({"email": "binahsmarthome@gmail.com"})
    if not driver_user:
        print("Driver user binahsmarthome@gmail.com not found in database!")
        return

    driver_user_id = driver_user["id"]
    
    # Extract specific driver from snapshot
    target_driver = next((d for d in snapshot.get("drivers", []) if d.get("user_id") == driver_user_id), None)
    if not target_driver:
        print(f"Driver with user_id {driver_user_id} not found in snapshot!")
        return
        
    driver_id = target_driver["id"]
    
    # Extract specific driver_trip and driver_location
    target_trip = next((t for t in snapshot.get("driver_trips", []) if t.get("driver_id") == driver_id), None)
    target_location = next((l for l in snapshot.get("driver_locations", []) if l.get("driver_id") == driver_id), None)
    
    # Get all ride IDs associated with this driver's trip in the snapshot
    ride_ids = []
    if target_trip:
        if target_trip.get("passengers"):
            ride_ids.extend([p["ride_id"] for p in target_trip["passengers"]])
        if target_trip.get("route_queue"):
            ride_ids.extend([q["ride_id"] for q in target_trip["route_queue"]])
    
    ride_ids = list(set(ride_ids))
    
    # Extract specific rides
    target_rides = [r for r in snapshot.get("rides", []) if r.get("id") in ride_ids]

    # Clear ONLY the specific documents in the current collections
    await db.drivers.delete_many({"id": driver_id})
    await db.driver_trips.delete_many({"driver_id": driver_id})
    await db.driver_locations.delete_many({"driver_id": driver_id})
    if ride_ids:
        await db.rides.delete_many({"id": {"$in": ride_ids}})

    # Restore only the targeted snapshot data
    if target_rides: await db.rides.insert_many(target_rides)
    if target_trip: await db.driver_trips.insert_one(target_trip)
    if target_location: await db.driver_locations.insert_one(target_location)
    if target_driver: await db.drivers.insert_one(target_driver)

    print(f"Targeted Snapshot restored successfully! ({len(target_rides)} rides, 1 trip for driver {driver_user['name']})")

if __name__ == "__main__":
    asyncio.run(main())
