import requests
import json
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

# Setup
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')

BASE_URL = "http://localhost:8000/api"
DRIVER_EMAIL = "driver@test.com"

async def setup_and_verify():
    if not MONGO_URL:
        print("Error: MONGO_URL missing")
        return

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # 1. Get Driver
    user = await db.users.find_one({"email": DRIVER_EMAIL})
    if not user:
        print("Driver user not found")
        return
    driver = await db.drivers.find_one({"user_id": user["id"]})
    driver_id = driver["id"]
    
    # 2. Ensure Admin
    new_admin_email = "newadmin@test.com"
    new_admin_pass = "admin123"
    
    # Register (Sync request inside async function - blocking but fine for script)
    try:
        requests.post(f"{BASE_URL}/auth/register", json={
            "email": new_admin_email,
            "password": new_admin_pass,
            "name": "Admin Test",
            "phone": "0000000000",
            "role": "student" 
        })
    except:
        pass # Might already exist

    # Promote
    await db.users.update_one({"email": new_admin_email}, {"$set": {"role": "admin"}})
    
    # 3. Login Admin
    print("Logging in Admin...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": new_admin_email, "password": new_admin_pass})
    if resp.status_code != 200:
        print(f"Admin Login Failed: {resp.text}")
        return
    admin_token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 4. Top Up
    print(f"Topping up driver {driver_id} with 100.0...")
    resp = requests.post(f"{BASE_URL}/admin/drivers/{driver_id}/topup", json={"amount": 100.0, "description": "Test Topup"}, headers=headers)
    
    print(f"Topup Response: {resp.status_code} {resp.text}")
    
    if resp.status_code == 200:
        data = resp.json()
        if data["wallet_status"] == "active" and data["new_balance"] >= 50.0:
            print("SUCCESS: Wallet topped up and status active.")
        else:
            print("FAILED: Topup succeeded but status check failed.")
    else:
        print("FAILED: Topup endpoint error.")

if __name__ == "__main__":
    asyncio.run(setup_and_verify())
