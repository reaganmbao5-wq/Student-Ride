import asyncio
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv

async def main():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client['mulungushi_rides']
    
    # Clean up existing requested rides to start fresh
    await db.rides.delete_many({"status": "requested"})

    # Fetch 2 students
    s11 = await db.users.find_one({"email": "student11@qa.com"})
    s12 = await db.users.find_one({"email": "student12@qa.com"})
    
    # -------------------------------------------------------------
    # RIDE 1: Student 11
    # Pickup is very close to Student 13's pickup in Kasama
    # Dropoff is ALSO very close to Pickup
    # (This forces the optimizer to drop them off before driving far away)
    # -------------------------------------------------------------
    ride1 = {
        "id": str(uuid.uuid4()),
        "student_id": s11["id"],
        "driver_id": None,
        "status": "requested",
        "ride_mode": "shared",
        "pickup_location": {"lat": -10.21595, "lng": 31.17103, "address": "Kasama Pick n Pay"},
        "dropoff_location": {"lat": -10.21600, "lng": 31.17150, "address": "Kasama Shoprite (Very Close)"},
        "fare": 15.0,
        "distance": 0.5,
        "passenger_count": 1,
        "created_at": datetime.utcnow().isoformat(),
        "verified_geometry": []
    }
    
    # -------------------------------------------------------------
    # RIDE 2: Student 12
    # Pickup is far away (e.g. 5km away towards Mungwi)
    # -------------------------------------------------------------
    ride2 = {
        "id": str(uuid.uuid4()),
        "student_id": s12["id"],
        "driver_id": None,
        "status": "requested",
        "ride_mode": "shared",
        "pickup_location": {"lat": -10.20000, "lng": 31.18000, "address": "Mungwi Road"},
        "dropoff_location": {"lat": -10.19000, "lng": 31.18500, "address": "Mungwi Centre"},
        "fare": 30.0,
        "distance": 3.0,
        "passenger_count": 1,
        "created_at": datetime.utcnow().isoformat(),
        "verified_geometry": []
    }

    await db.rides.insert_many([ride1, ride2])
    
    print("=========================================================")
    print("SUCCESS! Created 2 custom ride requests in the database.")
    print("Because Student 11's destination is extremely close to their pickup,")
    print("the Route Optimizer will forcefully DROP OFF Student 11 before")
    print("driving to Mungwi to pick up Student 12.")
    print("=========================================================")
    print("Student 11 Credentials (To view on Student Dashboard):")
    print("Email: student11@qa.com")
    print("Password: password123")
    print("=========================================================")

if __name__ == "__main__":
    asyncio.run(main())
