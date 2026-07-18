import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import random
import uuid

async def create_rides():
    load_dotenv('.env')
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ.get('DB_NAME', 'mulungushi_rides')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Delete the broken dummy rides
    await db.rides.delete_many({"student_id": {"$regex": "^dummy_student"}})
    
    # Let's get an ACTUAL student from the db so the frontend can display them!
    student = await db.users.find_one({"role": "student"})
    if not student:
        print("No real student found in DB to use!")
        return
        
    student_id = student['id']
    student_name = student.get('name', 'Real QA Student')
    student_phone = student.get('phone', '0970000000')

    # 1. Create 4 pending students
    for i in range(4):
        new_ride = {
            "id": str(uuid.uuid4()),
            "student_id": student_id,  # Use real student so user query works
            "student_name": f"{student_name} {i+1}",
            "student_phone": student_phone,
            "pickup_location": {
                "address": "Library, Main Campus",
                "lat": -14.393,
                "lng": 28.455
            },
            "dropoff_location": {
                "address": "Hostel 4",
                "lat": -14.390,
                "lng": 28.450
            },
            "distance": 1.2,
            "duration": 5,
            "fare": 35.00,
            "commission": 5.00,
            "driver_earning": 30.00,
            "passenger_count": 1,
            "ride_mode": "shared",
            "status": "requested", # Correct status!
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "driver_id": None
        }
        await db.rides.insert_one(new_ride)
        print("Created requested ride.")

    # 2. Assign one to driver A
    user_a = await db.users.find_one({'email': 'driver_a@qa.com'})
    if user_a:
        user_id = user_a['id']
        driver_a = await db.drivers.find_one({'user_id': user_id})
        
        if driver_a:
            driver_id = driver_a['id']
            accepted_ride = {
                "id": str(uuid.uuid4()),
                "student_id": student_id,
                "student_name": f"{student_name} Accepted",
                "student_phone": student_phone,
                "pickup_location": {
                    "address": "Main Gate",
                    "lat": -14.398,
                    "lng": 28.460
                },
                "dropoff_location": {
                    "address": "Hostel 1",
                    "lat": -14.391,
                    "lng": 28.451
                },
                "distance": 1.5,
                "duration": 6,
                "fare": 40.00,
                "commission": 5.00,
                "driver_earning": 35.00,
                "passenger_count": 1,
                "ride_mode": "shared",
                "status": "driver_accepted", # Correct status for accepted!
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "driver_id": driver_id,
                "accepted_at": datetime.utcnow().isoformat()
            }
            await db.rides.insert_one(accepted_ride)
            
            # also update driver's current_ride_id 
            await db.drivers.update_one({'id': driver_id}, {'$set': {'current_ride_id': accepted_ride['id']}})
            print("Created accepted ride for driver_a@qa.com.")
        else:
            print("driver profile not found for user_a")
    else:
        print("qa_driver_a user not found!")

asyncio.run(create_rides())
