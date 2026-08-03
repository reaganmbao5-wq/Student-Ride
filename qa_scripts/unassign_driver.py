import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def main():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client[os.environ.get('DB_NAME', 'mulungushi_rides')]

    driver_user = await db.users.find_one({"email": "binahsmarthome@gmail.com"})
    if not driver_user:
        print("Driver user not found!")
        return

    driver = await db.drivers.find_one({"user_id": driver_user["id"]})
    if not driver:
        print("Driver profile not found!")
        return

    driver_id = driver["id"]

    # 1. Find all rides assigned to this driver
    assigned_rides = await db.rides.find({"driver_id": driver_id}).to_list(length=None)
    print(f"Found {len(assigned_rides)} rides assigned to driver {driver_user['email']}")

    # 2. Reset those rides back to requested status and unassign driver
    for ride in assigned_rides:
        await db.rides.update_one(
            {"id": ride["id"]},
            {"$set": {
                "status": "requested",
                "driver_id": None,
                "driver": None,
                "accepted_at": None
            }}
        )

    # 3. Clear driver trips queue
    await db.driver_trips.delete_many({"driver_id": driver_id})

    # 4. Reset driver profile capacity
    await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {
            "current_location": {"lat": -10.21597, "lng": 31.16959, "heading": 0},
            "is_online": True
        }}
    )

    print("Successfully unassigned driver from all rides and reset rides to 'requested' status!")

if __name__ == "__main__":
    asyncio.run(main())
