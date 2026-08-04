import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def main():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))
    mongo_url = os.environ.get('MONGO_URL', 'mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/?appName=Cluster0')
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client[os.environ.get('DB_NAME', 'mulungushi_rides')]

    driver_user = await db.users.find_one({"email": "binahsmarthome@gmail.com"})
    if not driver_user:
        print("Driver user not found!")
        return

    driver_id = driver_user["id"]

    # Starting test coordinates (Mulungushi University, Kabwe Main Campus)
    mulungushi_loc = {"lat": -14.294532832852411, "lng": 28.54970049702143, "heading": 0}

    # Reset driver location in db.drivers and db.driver_locations
    await db.drivers.update_one(
        {"user_id": driver_id},
        {"$set": {
            "current_location": mulungushi_loc,
            "location": {"type": "Point", "coordinates": [mulungushi_loc["lng"], mulungushi_loc["lat"]]},
            "is_online": True
        }}
    )

    await db.driver_locations.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "driver_id": driver_id,
            "location": mulungushi_loc,
            "updated_at": asyncio.get_event_loop().time()
        }},
        upsert=True
    )

    print(f"Driver binahsmarthome@gmail.com location reset to Mulungushi ({mulungushi_loc['lat']}, {mulungushi_loc['lng']}) and set online!")

if __name__ == "__main__":
    asyncio.run(main())
