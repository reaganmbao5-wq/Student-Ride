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

    # Snapshot collections
    rides = await db.rides.find({}).to_list(length=None)
    driver_trips = await db.driver_trips.find({}).to_list(length=None)
    driver_locations = await db.driver_locations.find({}).to_list(length=None)
    drivers = await db.drivers.find({}).to_list(length=None)

    snapshot = {
        "rides": rides,
        "driver_trips": driver_trips,
        "driver_locations": driver_locations,
        "drivers": drivers
    }

    with open('backend/qa_env/db_snapshot.json', 'w') as f:
        f.write(json_util.dumps(snapshot))

    print(f"Snapshot saved successfully! ({len(rides)} rides, {len(driver_trips)} trips)")

if __name__ == "__main__":
    asyncio.run(main())
