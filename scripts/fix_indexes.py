import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from dotenv import load_dotenv

load_dotenv('backend/.env')

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "student_ride_db"

async def create_indexes():
    print(f"--- Creating Indexes on {DB_NAME} ---")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Drivers - Geospatial
    try:
        print("Creating 2dsphere index on drivers.location...")
        await db.drivers.create_index([("location", "2dsphere")])
        print("✅ Driver location index created.")
    except Exception as e:
        print(f"❌ Driver index failed: {e}")

    # Driver - Online/Approved for quick filtering
    try:
        print("Creating compound index on drivers (is_online, is_approved)...")
        await db.drivers.create_index([("is_online", ASCENDING), ("is_approved", ASCENDING)])
        print("✅ Driver status index created.")
    except Exception as e:
        print(f"❌ Driver status index failed: {e}")

    # Rides - Status queries
    try:
        print("Creating index on rides.status...")
        await db.rides.create_index("status")
        print("✅ Ride status index created.")
    except Exception as e:
        print(f"❌ Ride status index failed: {e}")
        
    # Rides - Student/Driver lookups
    try:
        await db.rides.create_index("student_id")
        await db.rides.create_index("driver_id")
        print("✅ Ride relationship indexes created.")
    except Exception as e:
        print(f"❌ Ride ID indexes failed: {e}")

    client.close()
    print("--- Index Creation Complete ---")

if __name__ == "__main__":
    asyncio.run(create_indexes())
