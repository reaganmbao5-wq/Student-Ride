import asyncio
import os
import sys
from dotenv import load_dotenv

async def check():
    load_dotenv('.env')
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    from motor.motor_asyncio import AsyncIOMotorClient
    from server import get_active_ride, get_pending_rides, db, RideResponse
    
    user_a = await db.users.find_one({'email': 'driver_a@qa.com'})
    user = {
        'id': user_a['id'],
        'email': user_a['email'],
        'name': user_a['name'],
        'role': 'driver'
    }
    
    # 1. Test Active Ride
    ride = await get_active_ride(user=user)
    if ride:
        try:
            RideResponse(**ride)
            print('ACTIVE RIDE VALIDATION SUCCESSFUL')
        except Exception as e:
            print('ACTIVE RIDE VALIDATION ERROR:', e)
    else:
        print('NO ACTIVE RIDE RETURNED')
        
    # 2. Test Pending Rides
    pending = await get_pending_rides(user=user)
    if pending:
        try:
            # get_pending_rides already returns RideResponse objects because of the line result.append(RideResponse(**ride))
            print('PENDING RIDES VALIDATION SUCCESSFUL')
        except Exception as e:
            print('PENDING RIDES VALIDATION ERROR:', e)

asyncio.run(check())
