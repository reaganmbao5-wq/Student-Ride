import asyncio
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv("backend/.env")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

async def seed():
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client[os.getenv("DB_NAME", "mulungushi_rides")]
    
    accounts = [
        {"email": "student@test.com", "name": "Test Student", "role": "student", "phone": "+260971000001"},
        {"email": "driver@test.com", "name": "Test Driver", "role": "driver", "phone": "+260971000002"},
        {"email": "accountant@test.com", "name": "Test Accountant", "role": "accountant", "phone": "+260971000003"},
        {"email": "admin@test.com", "name": "Test Admin", "role": "super_admin", "phone": "+260971000004"}
    ]
    
    for acc in accounts:
        existing = await db.users.find_one({"email": acc["email"]})
        if not existing:
            user_id = str(uuid.uuid4())
            user_doc = {
                "id": user_id,
                "email": acc["email"],
                "password": hash_password("password123"),
                "name": acc["name"],
                "role": acc["role"],
                "phone": acc["phone"],
                "created_at": "2026-08-19T00:00:00Z"
            }
            await db.users.insert_one(user_doc)
            print(f"Created user: {acc['email']} ({acc['role']})")
            
            if acc["role"] == "driver":
                driver_doc = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "vehicle_type": "car",
                    "vehicle_model": "Toyota Prius",
                    "vehicle_color": "Silver",
                    "plate_number": "ABC 1234",
                    "is_approved": True,
                    "is_online": True,
                    "wallet_balance": 150.0,
                    "total_commission_due": 0.0,
                    "current_location": {"lat": -14.4087, "lng": 28.2849},
                    "heading": 0.0,
                    "rating": 5.0,
                    "total_rides": 10
                }
                await db.drivers.insert_one(driver_doc)
                print(f"Created driver profile for: {acc['email']}")
        else:
            await db.users.update_one(
                {"email": acc["email"]},
                {"$set": {"password": hash_password("password123"), "role": acc["role"]}}
            )
            print(f"Updated user: {acc['email']} with password123")
            
    print("QA Test Accounts Seeded Successfully!")

if __name__ == "__main__":
    asyncio.run(seed())
