
import asyncio
import sys
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime, timezone
import uuid

# Load env
from dotenv import load_dotenv
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "mulungushi_rides_db")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def setup_accounts():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("--- Setting up Browser Verification Accounts ---")
    
    # 1. Super Admin
    admin_email = "superadmin@rides.com"
    admin_pass = "admin123"
    
    await db.users.delete_one({"email": admin_email})
    await db.users.insert_one({
        "id": str(uuid.uuid4()),
        "email": admin_email,
        "name": "Super Admin",
        "phone": "0000000000",
        "password": pwd_context.hash(admin_pass),
        "role": "super_admin",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    print(f"✅ Admin: {admin_email} / {admin_pass}")

    # 2. Student
    student_email = "browser_student@test.com"
    student_pass = "student123"
    
    await db.users.delete_one({"email": student_email})
    await db.users.insert_one({
        "id": str(uuid.uuid4()),
        "email": student_email,
        "name": "Browser Student",
        "phone": "0971111111",
        "password": pwd_context.hash(student_pass),
        "role": "student",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    print(f"✅ Student: {student_email} / {student_pass}")

    # 3. Driver (Neon Green)
    driver_email = "neon_driver@test.com"
    driver_pass = "driver123"
    driver_user_id = str(uuid.uuid4())
    
    await db.users.delete_one({"email": driver_email})
    await db.users.insert_one({
        "id": driver_user_id,
        "email": driver_email,
        "name": "Neon Driver",
        "phone": "0972222222",
        "password": pwd_context.hash(driver_pass),
        "role": "driver",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Driver Profile
    await db.drivers.delete_one({"user_id": driver_user_id})
    await db.drivers.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": driver_user_id,
        "vehicle_type": "car",
        "plate_number": "NEON-01",
        "vehicle_model": "Tesla Cybertruck",
        "vehicle_color": "Neon Green", # The key verification point
        "is_approved": True,
        "is_online": True,
        "wallet_status": "active",
        "wallet_balance": 1000.0,
        "current_location": {"lat": -14.42, "lng": 28.45}, # Near point A
        "location": {"type": "Point", "coordinates": [28.45, -14.42]},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    print(f"✅ Driver: {driver_email} / {driver_pass} (Color: Neon Green)")

    # 4. Cleanup Fixed Routes
    await db.fixed_routes.delete_many({"pickup_name": "Browser Lib"})
    print("✅ Cleaned up old test routes")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(setup_accounts())
