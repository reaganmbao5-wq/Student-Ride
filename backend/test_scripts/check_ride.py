import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv()
async def main():
    MONGO_URL = os.getenv("MONGO_URL", "mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/?appName=Cluster0")
    db = AsyncIOMotorClient(MONGO_URL).mulungushi_rides
    ride = await db.rides.find_one({"status": {"$in": ["accepted", "driver_arrived", "ongoing"]}}, sort=[("created_at", -1)])
    print("ACTIVE RIDE:", ride)
asyncio.run(main())
