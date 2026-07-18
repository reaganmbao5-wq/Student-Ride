import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

async def restore():
    load_dotenv('.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ.get('DB_NAME', 'mulungushi_rides')]
    
    cancelled_shared = await db.rides.find({'status': 'cancelled', 'ride_mode': 'shared'}).sort('created_at', -1).to_list(10)
    
    restored_count = 0
    for r in cancelled_shared:
        if restored_count == 2:
            break
        await db.rides.update_one(
            {'_id': r['_id']},
            {'$set': {
                'status': 'requested',
                'driver_id': None
            }}
        )
        print(f"Restored another ride {r['id']} to pool as requested")
        restored_count += 1
        
asyncio.run(restore())
