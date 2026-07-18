import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    load_dotenv('.env')
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ.get('DB_NAME', 'mulungushi_rides')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    result = await db.rides.update_many(
        {'status': 'looking_for_driver'},
        {'$set': {'status': 'requested'}}
    )
    print(f"Fixed {result.modified_count} rides from 'looking_for_driver' to 'requested'")

asyncio.run(fix())
