import asyncio
from dotenv import load_dotenv
import os
import motor.motor_asyncio
load_dotenv()
async def main():
    client = motor.motor_asyncio.AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DB_NAME')]
    res = await db.drivers.update_many({'vehicle_type': 'economy'}, {'$set': {'vehicle_type': 'car'}})
    print(f"Updated {res.modified_count} drivers.")
asyncio.run(main())
