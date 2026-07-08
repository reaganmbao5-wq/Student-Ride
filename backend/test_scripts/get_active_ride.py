import asyncio
import motor.motor_asyncio
import json
from dotenv import load_dotenv
import os

load_dotenv()

async def main():
    mongo_url = os.getenv("MONGO_URL")
    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'mulungushi_rides')]
    ride = await db.rides.find_one({"status": "pending"}, sort=[("created_at", -1)])
    if ride:
        print(f"RIDE_LOCATION: {json.dumps(ride.get('pickup_location', {}))}")
        print(f"RIDE_ID: {ride.get('id')}")
    else:
        print("No pending ride")

if __name__ == "__main__":
    asyncio.run(main())
