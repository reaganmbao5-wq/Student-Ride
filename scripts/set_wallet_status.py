import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')
DRIVER_EMAIL = "driver@test.com"

async def set_status(status, balance):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    user = await db.users.find_one({"email": DRIVER_EMAIL})
    if not user:
        print("Driver user not found")
        return

    print(f"Updating driver {user['id']} to {status} with balance {balance}...")
    
    await db.drivers.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "wallet_balance": balance,
            "wallet_status": status,
            "is_online": False if status == 'restricted' else True # Force offline if restricted
        }}
    )
    print("Update complete.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python set_wallet_status.py <active|restricted> <balance>")
        sys.exit(1)
        
    status = sys.argv[1]
    balance = float(sys.argv[2])
    asyncio.run(set_status(status, balance))
