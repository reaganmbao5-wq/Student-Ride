import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import uuid
from dotenv import load_dotenv

# Load env
load_dotenv('backend/.env')

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "student_ride_db"

async def audit_database():
    print(f"--- Starting Database Audit on {DB_NAME} ---")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # 1. Verify Indexes
    print("\n[Audit 1] Verifying Indexes...")
    try:
        driver_indexes = await db.drivers.index_information()
        ride_indexes = await db.rides.index_information()
        
        has_2dsphere = any('location_2dsphere' in idx or '2dsphere' in str(val) for idx, val in driver_indexes.items())
        
        if has_2dsphere:
            print("✅ Driver 2dsphere index found.")
        else:
            print("❌ Driver 2dsphere index MISSING!")
            
        print(f"Driver Indexes: {list(driver_indexes.keys())}")
        print(f"Ride Indexes: {list(ride_indexes.keys())}")
        
    except Exception as e:
        print(f"❌ Index check failed: {e}")

    # 2. CRUD Persistence Test
    print("\n[Audit 2] Testing CRUD Persistence...")
    test_id = str(uuid.uuid4())
    try:
        # CREATE
        await db.users.insert_one({
            "id": test_id,
            "name": "__AUDIT_TEST__",
            "email": f"audit_{test_id}@test.com",
            "role": "student",
            "created_at": datetime.now().isoformat()
        })
        print("✅ Create User: Success")
        
        # READ
        user = await db.users.find_one({"id": test_id})
        if user and user["name"] == "__AUDIT_TEST__":
            print("✅ Read User: Success")
        else:
             print("❌ Read User: Failed")
             
        # UPDATE
        await db.users.update_one({"id": test_id}, {"$set": {"name": "__AUDIT_UPDATED__"}})
        updated = await db.users.find_one({"id": test_id})
        if updated and updated["name"] == "__AUDIT_UPDATED__":
            print("✅ Update User: Success")
        else:
            print("❌ Update User: Failed")
            
        # DELETE
        await db.users.delete_one({"id": test_id})
        deleted = await db.users.find_one({"id": test_id})
        if not deleted:
            print("✅ Delete User: Success")
        else:
             print("❌ Delete User: Failed")

    except Exception as e:
        print(f"❌ CRUD Test Failed: {e}")

    # 3. State Consistency (Wallet)
    print("\n[Audit 3] State Consistency (Wallet)...")
    try:
        # Create Dummy Driver
        driver_id = str(uuid.uuid4())
        await db.drivers.insert_one({
            "id": driver_id,
            "wallet_balance": 100.0,
            "total_earnings": 500.0
        })
        
        # Simulate Ride Completion Update (add 50)
        await db.drivers.update_one(
            {"id": driver_id},
            {"$inc": {"wallet_balance": 50.0, "total_earnings": 50.0}}
        )
        
        driver = await db.drivers.find_one({"id": driver_id})
        if driver["wallet_balance"] == 150.0 and driver["total_earnings"] == 550.0:
            print("✅ Wallet Atomic Update: Success")
        else:
            print(f"❌ Wallet Atomic Update: Failed (Bal: {driver['wallet_balance']})")
            
        # Cleanup
        await db.drivers.delete_one({"id": driver_id})
        
    except Exception as e:
        print(f"❌ State Check Failed: {e}")

    client.close()
    print("\n--- Audit Complete ---")

if __name__ == "__main__":
    asyncio.run(audit_database())
