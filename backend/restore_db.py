import asyncio
import os
import json
from motor.motor_asyncio import AsyncIOMotorClient
from bson import json_util

async def restore():
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient('mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/?appName=Cluster0')
    db = client['mulungushi_rides']
    
    print("Loading backup from backup_db.json...")
    try:
        with open('backup_db.json', 'r') as f:
            data = json.load(f, object_hook=json_util.object_hook)
    except FileNotFoundError:
        print("Error: backup_db.json not found! Cannot restore.")
        return

    users = data.get('users', [])
    rides = data.get('rides', [])
    drivers = data.get('drivers', [])

    print(f"Loaded {len(users)} users, {len(rides)} rides, {len(drivers)} drivers.")

    # Drop existing collections to ensure a clean slate
    print("Clearing current database state...")
    await db.users.delete_many({})
    await db.rides.delete_many({})
    await db.drivers.delete_many({})

    # Restore the data
    if users:
        await db.users.insert_many(users)
    if rides:
        await db.rides.insert_many(rides)
    if drivers:
        await db.drivers.insert_many(drivers)

    print("✅ Database successfully restored to the previous state!")

if __name__ == "__main__":
    asyncio.run(restore())
