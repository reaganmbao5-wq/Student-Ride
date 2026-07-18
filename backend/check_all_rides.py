import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    load_dotenv('.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ.get('DB_NAME', 'mulungushi_rides')]
    
    rides = await db.rides.find({}).to_list(100)
    print("ALL RIDES:")
    for r in rides:
        driver = await db.drivers.find_one({"id": r.get('driver_id')}) if r.get('driver_id') else None
        driver_email = None
        if driver:
            user = await db.users.find_one({"id": driver['user_id']})
            driver_email = user['email'] if user else "Unknown"
        
        print(f"- ID: {r.get('id')} | Status: {r.get('status')} | Driver: {driver_email} | Mode: {r.get('ride_mode')}")

asyncio.run(check())
