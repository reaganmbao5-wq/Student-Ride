import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    load_dotenv('.env')
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ.get('DB_NAME', 'mulungushi_rides')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    trips = await db.driver_trips.find({}).to_list(100)
    for t in trips:
        print(f"Deleting trip for driver: {t.get('driver_id')}")
        await db.driver_trips.delete_one({'_id': t.get('_id')})

asyncio.run(check())
