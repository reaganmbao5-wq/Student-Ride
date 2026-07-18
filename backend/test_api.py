import asyncio
import os
import sys
from dotenv import load_dotenv

async def run_test():
    load_dotenv('.env')
    os.environ['PYTHONPATH'] = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, os.environ['PYTHONPATH'])
    
    from motor.motor_asyncio import AsyncIOMotorClient
    from server import get_pending_rides, get_active_rides_for_driver, db
    
    # Mock user dict
    user_a = await db.users.find_one({'email': 'driver_a@qa.com'})
    user = {
        'id': user_a['id'],
        'email': user_a['email'],
        'name': user_a['name'],
        'role': 'driver'
    }
    
    try:
        pending = await get_pending_rides(user=user)
        print(f'Pending rides: {len(pending)}')
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f'Error getting pending rides: {e}')
        
    try:
        active = await get_active_rides_for_driver(user=user)
        print(f'Active rides: {len(active)}')
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f'Error getting active rides: {e}')

asyncio.run(run_test())
