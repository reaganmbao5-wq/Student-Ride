import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def main():
    MONGO_URL = os.getenv("MONGO_URL", "mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/?appName=Cluster0")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.mulungushi_rides
    
    ride = await db.rides.find_one({}, sort=[("created_at", -1)])
    if ride:
        await db.rides.update_one({"_id": ride["_id"]}, {"$set": {"status": "requested", "driver_id": None}})
        print(f"Ride {ride['id']} reset to requested.")
    else:
        print("No ride found.")

if __name__ == "__main__":
    asyncio.run(main())
