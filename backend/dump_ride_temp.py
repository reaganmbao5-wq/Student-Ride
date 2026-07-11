import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def main():
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client.student_ride_db
    ride = await db.rides.find_one({}, sort=[("created_at", -1)])
    if ride:
        print(f"Status: {ride.get('status')}")
        print(f"Pickup: {ride.get('pickup_location')}")
        print(f"Dropoff: {ride.get('dropoff_location')}")
        geom = ride.get('verified_geometry')
        if geom:
            print(f"Geometry length: {len(geom)}")
        else:
            print("Geometry missing or empty!")
    else:
        print("No rides found.")

if __name__ == "__main__":
    asyncio.run(main())
