import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def main():
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client.student_ride_db
    drivers = await db.drivers.find({"is_online": True}).to_list(length=20)
    print(f"Found {len(drivers)} online drivers.")
    for d in drivers:
        loc = d.get('current_location', {})
        print(f"Driver {d.get('id')}: lat={loc.get('lat')}, lng={loc.get('lng')}")

if __name__ == "__main__":
    asyncio.run(main())
