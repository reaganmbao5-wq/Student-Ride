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
    
    rides = await db.rides.find({'driver_id': {'$ne': None}}).to_list(1000)
    for r in rides:
        print(f"Ride: {r.get('_id')} | Status: {r.get('status')} | Driver: {r.get('driver_id')}")
        
        await db.rides.update_one({'_id': r.get('_id')}, {'$set': {'status': 'looking_for_driver', 'driver_id': None}})
        print(" -> Force reset to looking_for_driver in db.rides")
        
asyncio.run(check())
