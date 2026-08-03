import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.hash import bcrypt
import uuid
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv("../backend/.env")

# Ensure we use test DB if configured, else default to student-ride
MONGO_URI = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "mulungushi_rides")

async def seed_qa_data():
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Hardcoded hash for "password123"
    password_hash = "$2b$12$SKkZHAwVjtW.F5R4c1Yf.ubdzamf.R.uo4Q2y07AYStI0SNCeHT2W"
    now = datetime.now(timezone.utc).isoformat()
    
    # QA Data definitions
    users = [
        {"id": "qa_student_a", "role": "student", "name": "Student A", "email": "student_a@qa.com", "phone": "0990000001", "password": password_hash, "is_active": True, "created_at": now},
        {"id": "qa_student_b", "role": "student", "name": "Student B", "email": "student_b@qa.com", "phone": "0990000002", "password": password_hash, "is_active": True, "created_at": now},
        {"id": "qa_student_c", "role": "student", "name": "Student C", "email": "student_c@qa.com", "phone": "0990000003", "password": password_hash, "is_active": True, "created_at": now},
        {"id": "qa_student_d", "role": "student", "name": "Student D", "email": "student_d@qa.com", "phone": "0990000009", "password": password_hash, "is_active": True, "created_at": now},
        {"id": "qa_driver_a", "role": "driver", "name": "Driver A", "email": "driver_a@qa.com", "phone": "0990000004", "password": password_hash, "is_active": True, "created_at": now},
        {"id": "qa_driver_b", "role": "driver", "name": "Driver B", "email": "driver_b@qa.com", "phone": "0990000005", "password": password_hash, "is_active": True, "created_at": now},
        {"id": "qa_driver_c", "role": "driver", "name": "Driver C", "email": "driver_c@qa.com", "phone": "0990000007", "password": password_hash, "is_active": True, "created_at": now},
        {"id": "qa_driver_d", "role": "driver", "name": "Driver D", "email": "driver_d@qa.com", "phone": "0990000008", "password": password_hash, "is_active": True, "created_at": now},
        {"id": "qa_admin", "role": "admin", "name": "Admin QA", "email": "admin@qa.com", "phone": "0990000006", "password": password_hash, "is_active": True, "created_at": now},
    ]
    
    drivers = [
        {
            "id": "qa_driver_a",
            "user_id": "qa_driver_a",
            "vehicle_type": "car",
            "plate_number": "QA-001",
            "vehicle_model": "Toyota Yaris",
            "vehicle_color": "Blue",
            "vehicle_capacity": 2,
            "rating": 5.0,
            "total_rides": 0,
            "total_earnings": 0.0,
            "is_online": True,
            "is_approved": True,
            "accepts_shared_rides": True,
            "current_ride_id": None,
            "location": {"type": "Point", "coordinates": [28.28, -14.40]},
            "current_location": {"lat": -14.40, "lng": 28.28, "heading": 0},
            "wallet_balance": 100.0,
            "wallet_status": "active"
        },
        {
            "id": "qa_driver_b",
            "user_id": "qa_driver_b",
            "vehicle_type": "car",
            "plate_number": "QA-002",
            "vehicle_model": "Toyota Corolla",
            "vehicle_color": "Silver",
            "vehicle_capacity": 4,
            "rating": 5.0,
            "total_rides": 0,
            "total_earnings": 0.0,
            "is_online": True,
            "is_approved": True,
            "accepts_shared_rides": True,
            "current_ride_id": None,
            "location": {"type": "Point", "coordinates": [28.281, -14.401]},
            "current_location": {"lat": -14.401, "lng": 28.281, "heading": 0},
            "wallet_balance": 100.0,
            "wallet_status": "active"
        },
        {
            "id": "qa_driver_c",
            "user_id": "qa_driver_c",
            "vehicle_type": "car",
            "plate_number": "QA-003",
            "vehicle_model": "Toyota Sienta",
            "vehicle_color": "White",
            "vehicle_capacity": 5,
            "rating": 5.0,
            "total_rides": 0,
            "total_earnings": 0.0,
            "is_online": True,
            "is_approved": True,
            "accepts_shared_rides": True,
            "current_ride_id": None,
            "location": {"type": "Point", "coordinates": [28.282, -14.402]},
            "current_location": {"lat": -14.402, "lng": 28.282, "heading": 0},
            "wallet_balance": 100.0,
            "wallet_status": "active"
        },
        {
            "id": "qa_driver_d",
            "user_id": "qa_driver_d",
            "vehicle_type": "car",
            "plate_number": "QA-004",
            "vehicle_model": "Toyota Hiace",
            "vehicle_color": "White",
            "vehicle_capacity": 7,
            "rating": 5.0,
            "total_rides": 0,
            "total_earnings": 0.0,
            "is_online": True,
            "is_approved": True,
            "accepts_shared_rides": True,
            "current_ride_id": None,
            "location": {"type": "Point", "coordinates": [28.283, -14.403]},
            "current_location": {"lat": -14.403, "lng": 28.283, "heading": 0},
            "wallet_balance": 100.0,
            "wallet_status": "active"
        }
    ]
    
    print("Cleaning up old QA data...")
    qa_user_ids = [u["id"] for u in users]
    await db.users.delete_many({"id": {"$in": qa_user_ids}})
    await db.drivers.delete_many({"id": {"$in": qa_user_ids}})
    await db.rides.delete_many({"student_id": {"$in": qa_user_ids}})
    await db.rides.delete_many({"driver_id": {"$in": qa_user_ids}})
    
    print("Inserting Users...")
    await db.users.insert_many(users)
    
    print("Inserting Drivers...")
    await db.drivers.insert_many(drivers)
    
    print("QA Data seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_qa_data())
