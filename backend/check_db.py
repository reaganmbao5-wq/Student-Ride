import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    load_dotenv('.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ.get('DB_NAME', 'mulungushi_rides')]
    
    requested = await db.rides.find({'status': 'requested'}).to_list(100)
    print(f'Requested rides count: {len(requested)}')
    if len(requested) > 0:
        print(f'First requested ride keys: {list(requested[0].keys())}')
        print(f'Passenger count: {requested[0].get("passenger_count")}')
        print(f'Ride mode: {requested[0].get("ride_mode")}')
        
    accepted = await db.rides.find({'status': 'driver_accepted'}).to_list(100)
    print(f'Accepted rides count: {len(accepted)}')

asyncio.run(check())
