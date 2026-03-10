
import asyncio
import sys
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "mulungushi_rides_db")

async def force_accept_ride():
    print("⏳ Searching for pending ride from 'Browser Student'...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # 1. Find Student ID
    student = await db.users.find_one({"email": "browser_student@test.com"})
    if not student:
        print("❌ Student not found")
        return

    # 2. Find Pending Ride
    ride = await db.rides.find_one({
        "student_id": student["id"],
        "status": "requested"
    })
    
    if not ride:
        print("❌ No requested ride found for student")
        # Retry logic?
        return

    print(f"✅ Found Ride {ride['id']} (Fare: {ride['fare']})")
    
    # 3. Find Neon Driver
    driver_user = await db.users.find_one({"email": "neon_driver@test.com"})
    driver_profile = await db.drivers.find_one({"user_id": driver_user["id"]})
    
    # 4. Accept via API (to trigger sockets)
    # Login as driver
    async with httpx.AsyncClient() as http:
        login = await http.post("http://localhost:8000/api/auth/login", json={
            "email": "neon_driver@test.com", "password": "driver123"
        })
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Accept
        res = await http.post(f"http://localhost:8000/api/rides/{ride['id']}/accept", headers=headers)
        if res.status_code == 200:
            print("✅ Driver Accepted Ride! Check Browser!")
        else:
            print(f"❌ Accept Failed: {res.text}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(force_accept_ride())
