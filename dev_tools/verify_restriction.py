import requests
import json
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

# Connect to DB to force restrict a driver
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')

BASE_URL = "http://localhost:8000/api"
DRIVER_EMAIL = "driver@test.com"
DRIVER_PASS = "driver123"

async def force_restrict_driver():
    if not MONGO_URL:
        print("Error: MONGO_URL missing")
        return

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Find user ID
    user = await db.users.find_one({"email": DRIVER_EMAIL})
    if not user:
        print("Driver user not found.")
        return
        
    print(f"Restricting Driver: {user['id']}")
    
    # Update driver to have low balance
    res = await db.drivers.update_one(
        {"user_id": user["id"]},
        {"$set": {"wallet_balance": -10.0, "wallet_status": "restricted", "is_online": False}}
    )
    print(f"Forced driver to be restricted and offline. Modified: {res.modified_count}")

def verify_restriction():
    # 1. Login
    print("Logging in Driver...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": DRIVER_EMAIL, "password": DRIVER_PASS})
    if resp.status_code != 200:
        print("Login failed")
        return
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Try to go online
    print("Attempting to go online (Should Fail)...")
    resp = requests.post(f"{BASE_URL}/drivers/toggle-online", headers=headers)
    
    print(f"Status: {resp.status_code}, Response: {resp.text}")
    
    if resp.status_code == 403 and "restricted" in resp.text:
        print("SUCCESS: Driver blocked from going online.")
    else:
        print("FAILED: Driver was able to go online or wrong error.")

if __name__ == "__main__":
    asyncio.run(force_restrict_driver())
    verify_restriction()
