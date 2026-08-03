import asyncio
import os
import argparse
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def main():
    parser = argparse.ArgumentParser(description="Reset a driver's rides back to driver_accepted")
    parser.add_argument("--email", default="binahsmarthome@gmail.com", help="Driver email")
    args = parser.parse_args()

    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client[os.environ.get('DB_NAME', 'mulungushi_rides')]

    driver_user = await db.users.find_one({"email": args.email})
    if not driver_user:
        print("Driver not found")
        return
        
    driver_profile = await db.drivers.find_one({"user_id": driver_user["id"]})
    driver_id = driver_profile["id"]

    # Find all active or recently completed rides for this driver
    active_states = [
        "driver_accepted", "driver_en_route_to_pickup", "driver_arrived", 
        "passenger_boarding", "ride_started", "ongoing", "ride_in_progress", 
        "arriving_destination", "ride_completed", "completed", "settlement", "ride_archived"
    ]
                     
    cursor = db.rides.find({"driver_id": driver_id, "status": {"$in": active_states}})
    rides = await cursor.to_list(length=None)
    
    print(f"Found {len(rides)} rides for {args.email}.")
    
    for ride in rides:
        # Reset the status back to the moment the driver just accepted the ride
        await db.rides.update_one(
            {"id": ride["id"]},
            {"$set": {"status": "driver_accepted"}}
        )
        print(f"Reset ride {ride['id']} to 'driver_accepted'")
        
    # Delete the driver's trip cache so it fully rebuilds logically from scratch
    await db.driver_trips.delete_one({"driver_id": driver_id})
    
    # Also reset the driver's state back to available
    await db.drivers.update_one(
        {"id": driver_id}, 
        {"$set": {"status": "available"}}
    )
    
    print("Deleted structural driver_trips cache (will be intelligently rebuilt by backend).")
    print("Reset complete! You can now run MasterRouteTester.py again.")

if __name__ == "__main__":
    asyncio.run(main())
