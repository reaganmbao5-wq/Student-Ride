import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')
DRIVER_EMAIL = "driver@test.com"

async def cleanup():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    user = await db.users.find_one({"email": DRIVER_EMAIL})
    if not user:
        print("Driver user not found")
        return

    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver:
        print("Driver profile not found")
        return

    print(f"Cleaning rides for driver {driver['id']}...")
    
    # Update all active rides to cancelled
    result = await db.rides.update_many(
        {
            "driver_id": driver["id"],
            "status": {"$in": ["accepted", "driver_arrived", "ongoing"]}
        },
        {"$set": {"status": "cancelled", "cancelled_at": "force_cleanup"}}
    )
    
    print(f"Cancelled {result.modified_count} active rides.")

if __name__ == "__main__":
    asyncio.run(cleanup())
