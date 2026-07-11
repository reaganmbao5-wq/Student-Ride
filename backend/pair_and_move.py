import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def find_and_move():
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.get_database(os.getenv("DB_NAME", "student_ride_db"))
    
    # Get the latest ride request
    ride = await db.rides.find_one({}, sort=[("created_at", -1)])
    if not ride:
        print("No rides found. Please request a ride in the app first!")
        return

    print(f"Found ride {ride['id']} for student {ride['student_id']}.")
    
    # Get any driver
    driver = await db.drivers.find_one({})
    if not driver:
        print("No drivers found.")
        return
        
    print(f"Pairing with driver {driver['user_id']}.")
    
    # Accept the ride
    await db.rides.update_one(
        {"_id": ride["_id"]},
        {"$set": {
            "status": "accepted",
            "driver_id": driver["id"]
        }}
    )
    
    # Make driver start 0.005 degrees away from pickup
    target_lat = ride['pickup_location']['lat']
    target_lng = ride['pickup_location']['lng']
    
    current_lat = target_lat - 0.005
    current_lng = target_lng - 0.005
    
    await db.drivers.update_one(
        {"_id": driver["_id"]},
        {"$set": {
            "current_ride_id": ride["id"],
            "latitude": current_lat, 
            "longitude": current_lng,
            "is_online": True
        }}
    )
    
    print("Driver has been paired and moved slightly away from your pickup point.")
    print("Starting driving simulation towards you...")
    
    steps = 40
    lat_step = (target_lat - current_lat) / steps
    lng_step = (target_lng - current_lng) / steps
    
    for i in range(steps):
        current_lat += lat_step
        current_lng += lng_step
        
        await db.drivers.update_one(
            {"_id": driver["_id"]},
            {"$set": {
                "latitude": current_lat, 
                "longitude": current_lng,
                "heading": 45  # Approximation
            }}
        )
        print(f"[{i+1}/{steps}] Driver moving... {current_lat:.5f}, {current_lng:.5f}")
        await asyncio.sleep(1.5)
        
    print("Driver has arrived at the pickup location!")

if __name__ == "__main__":
    asyncio.run(find_and_move())
