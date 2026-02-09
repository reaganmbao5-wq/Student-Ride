import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import uuid
from datetime import datetime

# Add backend to path to import server utils if needed, but for now we'll just replicate
ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR / 'backend'))

load_dotenv(ROOT_DIR / 'backend' / '.env')
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')
API_URL = "http://localhost:8000/api"

async def verify_super_admin_topup():
    print(f"Connecting to DB: {DB_NAME}")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Generate Test Super Admin
    test_email = f"sa_test_{uuid.uuid4().hex[:8]}@test.com"
    test_pass = "password123"
    
    # Hash password exactly as server does
    hashed = bcrypt.hashpw(test_pass.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    sa_user = {
        "id": str(uuid.uuid4()),
        "email": test_email,
        "name": "Test SA",
        "phone": "+260999999999", # Ensure required fields are present
        "role": "super_admin",
        "password": hashed,
        "is_active": True,
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db.users.insert_one(sa_user)
    print(f"Created Super Admin: {test_email}")
    
    async with httpx.AsyncClient() as client:
        # Login
        try:
            resp = await client.post(f"{API_URL}/auth/login", json={
                "email": test_email,
                "password": test_pass
            })
            
            if resp.status_code != 200:
                print(f"Login Failed: {resp.status_code}")
                print(resp.text)
                return

            token = resp.json()["access_token"]
            print("Login Successful")
            
            # Find a driver
            driver = await db.drivers.find_one({})
            if not driver:
                print("No drivers in DB")
                return
                
            print(f"Testing on driver: {driver['id']} (Current: {driver.get('wallet_balance')})")
            
            # Top Up
            topup_resp = await client.post(
                f"{API_URL}/admin/drivers/{driver['id']}/topup",
                headers={"Authorization": f"Bearer {token}"},
                json={"amount": 5.0, "description": "SA Verification"}
            )
            
            print(f"Top-Up Status: {topup_resp.status_code}")
            print(topup_resp.json())
            
        except Exception as e:
            print(f"Error: {e}")
        finally:
            await db.users.delete_one({"email": test_email})
            print("Cleanup done")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_super_admin_topup())
