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

    # Clear current collections
    await db.rides.delete_many({})
    await db.driver_trips.delete_many({})
    await db.driver_locations.delete_many({})
    await db.drivers.delete_many({})

    # Restore snapshot
    if snapshot.get("rides"): await db.rides.insert_many(snapshot["rides"])
    if snapshot.get("driver_trips"): await db.driver_trips.insert_many(snapshot["driver_trips"])
    if snapshot.get("driver_locations"): await db.driver_locations.insert_many(snapshot["driver_locations"])
    if snapshot.get("drivers"): await db.drivers.insert_many(snapshot["drivers"])

    print(f"Snapshot restored successfully! ({len(snapshot.get('rides', []))} rides, {len(snapshot.get('driver_trips', []))} trips)")

if __name__ == "__main__":
    asyncio.run(main())
