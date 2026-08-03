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

    driver_id = driver_user["id"]

    # Starting test coordinates (Kasama)
    kasama_loc = {"lat": -10.21597, "lng": 31.16959, "heading": 0}

    # Reset driver location in db.drivers and db.driver_locations
    await db.drivers.update_one(
        {"user_id": driver_id},
        {"$set": {"current_location": kasama_loc, "is_online": True}}
    )

    await db.driver_locations.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "driver_id": driver_id,
            "location": kasama_loc,
            "updated_at": asyncio.get_event_loop().time()
        }},
        upsert=True
    )

    print(f"Driver binahsmarthome@gmail.com location reset to Kasama ({kasama_loc['lat']}, {kasama_loc['lng']}) and set online!")

if __name__ == "__main__":
    asyncio.run(main())
