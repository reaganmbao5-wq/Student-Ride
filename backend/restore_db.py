import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

async def restore():
    load_dotenv('.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ.get('DB_NAME', 'mulungushi_rides')]
    
    # 1. Delete ALL dummy rides that I just created to clean the slate
    await db.rides.delete_many({"student_id": {"$regex": "^dummy_student"}})
    # Also delete the ones where fare was 35.00 because those were my dummy rides
    await db.rides.delete_many({"fare": 35.00})
    await db.rides.delete_many({"fare": 40.00})
    
    # 2. Get Driver A's ID
    user_a = await db.users.find_one({'email': 'driver_a@qa.com'})
    driver_a = await db.drivers.find_one({'user_id': user_a['id']})
    driver_id = driver_a['id']
    
    # 3. Find 4 real rides (shared) that were cancelled and restore them!
    # I will sort by created_at DESC to get the most recent ones the user created
    cancelled_shared = await db.rides.find({'status': 'cancelled', 'ride_mode': 'shared'}).sort('created_at', -1).to_list(4)
    
    if len(cancelled_shared) < 4:
        print("Not enough cancelled shared rides to restore.")
        return
        
    # The first one goes to Driver A!
    ride_for_a = cancelled_shared[0]
    await db.rides.update_one(
        {'_id': ride_for_a['_id']},
        {'$set': {
            'status': 'driver_accepted',
            'driver_id': driver_id
        }}
    )
    print(f"Restored ride {ride_for_a['id']} to Driver A as accepted")
    
    # The other 3 go to the pool!
    for r in cancelled_shared[1:]:
        await db.rides.update_one(
            {'_id': r['_id']},
            {'$set': {
                'status': 'requested',
                'driver_id': None
            }}
        )
        print(f"Restored ride {r['id']} to pool as requested")
        
    print("Database restoration complete. The app should now reflect the correct state.")

asyncio.run(restore())
