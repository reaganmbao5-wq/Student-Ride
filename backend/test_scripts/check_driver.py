import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv()
async def main():
    MONGO_URL = os.getenv("MONGO_URL", "mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/?appName=Cluster0")
    db = AsyncIOMotorClient(MONGO_URL).mulungushi_rides
    driver = await db.drivers.find_one({'user_id': 'ghost-driver-0'})
    print(driver)
asyncio.run(main())
