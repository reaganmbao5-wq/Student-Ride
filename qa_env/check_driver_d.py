import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
load_dotenv('../backend/.env')
MONGO_URI = os.environ.get('MONGO_URL').replace('reaganmbao31?', 'reaganmbao31%3F')
DB_NAME = os.environ.get('DB_NAME', 'mulungushi_rides')

async def check():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    count_id = await db.drivers.count_documents({'id': 'qa_driver_d'})
    count_uid = await db.drivers.count_documents({'user_id': 'qa_driver_d'})
    print(f'Driver D count by id: {count_id}')
    print(f'Driver D count by user_id: {count_uid}')
    rides = await db.rides.find({'driver_id': 'qa_driver_d'}).to_list(10)
    statuses = [r.get('status') for r in rides]
    print(f'Rides for qa_driver_d statuses: {statuses}')
    # Check what login returns
    driv = await db.drivers.find_one({'user_id': 'qa_driver_d'}, {'_id': 0})
    print(f'Driver D found by user_id: is_approved={driv.get("is_approved")}, is_online={driv.get("is_online")}, vehicle_type={driv.get("vehicle_type")}')
    client.close()

asyncio.run(check())
