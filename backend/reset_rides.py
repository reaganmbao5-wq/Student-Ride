import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

async def reset():
    load_dotenv('.env')
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ.get('DB_NAME', 'mulungushi_rides')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    result = await db.ride_requests.update_many(
        {'status': 'accepted'},
        {'$set': {'status': 'looking_for_driver', 'driver_id': None}}
    )
    print(f"Reset {result.modified_count} globally accepted rides")

asyncio.run(reset())
