import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.student_ride

async def main():
    users = await db.users.find().to_list(100)
    print("EXISTING USERS:")
    for u in users:
        print(f"- {u.get('email')} : {u.get('role')}")

if __name__ == "__main__":
    asyncio.run(main())
