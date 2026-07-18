import asyncio
import os
import sys
from dotenv import load_dotenv

async def check():
    load_dotenv('.env')
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    from motor.motor_asyncio import AsyncIOMotorClient
    from server import get_pending_rides, db
    
    user_b = await db.users.find_one({'email': 'driver_b@qa.com'})
    user = {
        'id': user_b['id'],
        'email': user_b['email'],
        'name': user_b['name'],
        'role': 'driver'
    }
    
    pending = await get_pending_rides(user=user)
    print(f'Pending rides returned for Driver B: {len(pending)}')

asyncio.run(check())
