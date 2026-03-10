import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
print(f"Connecting to MongoDB at {MONGO_URL}...")

client = AsyncIOMotorClient(MONGO_URL)
db = client.student_ride

async def delete_users():
    print("Deleting all users except super admins...")
    # Delete users where role is NOT 'super_admin'
    result = await db.users.delete_many({"role": {"$ne": "super_admin"}})
    print(f"Deleted {result.deleted_count} users.")
    
    print("Deleting related records (drivers, rides, messages, transactions)...")
    drivers_result = await db.drivers.delete_many({})
    print(f"Deleted {drivers_result.deleted_count} driver profiles.")

    rides_result = await db.rides.delete_many({})
    print(f"Deleted {rides_result.deleted_count} rides.")

    messages_result = await db.messages.delete_many({})
    print(f"Deleted {messages_result.deleted_count} messages.")

    transactions_result = await db.driver_wallet_transactions.delete_many({})
    print(f"Deleted {transactions_result.deleted_count} wallet transactions.")

    print("Cleanup complete.")

if __name__ == "__main__":
    asyncio.run(delete_users())
