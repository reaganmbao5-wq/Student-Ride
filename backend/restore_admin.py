import asyncio
import os
import uuid
from datetime import datetime, timezone
import secrets
import bcrypt

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.student_ride

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

async def restore_admin():
    target_email = "reaganmbao5@gmail.com"
    print(f"Checking for user {target_email}...")
    
    user = await db.users.find_one({"email": target_email})
    
    if user:
        print("User exists. Elevating to super_admin and updating password...")
        hashed_pw = hash_password("reaganmbao31?")
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"role": "super_admin", "password": hashed_pw}}
        )
        print("Successfully elevated to super_admin and password updated to reaganmbao31?!")
    else:
        print("User does not exist. Creating super_admin account...")
        password = "reaganmbao31?"
        hashed_pw = hash_password(password)
        
        new_user = {
            "id": str(uuid.uuid4()),
            "email": target_email,
            "name": "Super Admin",
            "phone": "",
            "password": hashed_pw,
            "role": "super_admin",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
        print("Successfully created super_admin account! You can now log in using Google with this email, or email: reaganmbao5@gmail.com / pass: reaganmbao31?")

if __name__ == "__main__":
    asyncio.run(restore_admin())
